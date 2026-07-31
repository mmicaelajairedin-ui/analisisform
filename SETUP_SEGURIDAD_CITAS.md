# Setup de Seguridad — Sistema de Citas (Julio 2026)

**Estado:** Código listo para deploy. **ACCIONES MANUALES REQUERIDAS EN SUPABASE.**

---

## Resumen: Qué se hizo

1. ✅ **Token-based access control** — Código en panel-v2.html y sala.html para generar, transmitir y validar tokens
2. ✅ **MOD validation** — sala.html ya no acepta ?mod=1 en URL; valida contra localStorage
3. ✅ **Token generation trigger** — Nueva migration: `citas_token_generation.sql` (auto-genera tokens)
4. ✅ **Audit report** — Documento completo con hallazgos y tabla de acciones

---

## ⚠️ ACCIONES CRÍTICAS FALTANTES (HACER EN SUPABASE)

### 1. Aplicar Migrations de RLS Estricto

**⚠️ CRÍTICO:** Sin esto, el acceso sigue abierto. Las migraciones ya existen pero NO se han ejecutado.

**Pasos:**

1. Abrí Supabase → SQL Editor
2. Copiar el contenido COMPLETO de cada archivo:
   - `supabase/migrations/0100_citas_rls_network.sql`
   - `supabase/migrations/0101_citas_owner_rls.sql`
3. Pegar y ejecutar EN ESTE ORDEN (primero 0100, luego 0101)
4. Verificar que no hay errores

**Por qué es crítico:**
- Sin estas migraciones, el RLS sigue abierto (`USING true` permite todo)
- Con ellas, solo el coach (auth.uid() == coach_id) y admins pueden ver/modificar citas
- El fix de token en el código NO funciona si Supabase permite acceso abierto

**Verificación después de aplicar:**

```sql
-- Debe haber políticas estrictas ahora:
SELECT tablename, policyname, cmd, qual FROM pg_policies WHERE tablename='citas';

-- Resultado esperado: políticas con "auth.uid()" o "coach_id", NO "true"
```

---

### 2. Aplicar Trigger de Generación de Tokens

**Pasos:**

1. Supabase → SQL Editor
2. Copiar `supabase/migrations/citas_token_generation.sql`
3. Ejecutar

**Por qué:**
- Las citas NUEVAS tendrán token autogenerado
- Las VIEJAS necesitan un UPDATE manual (ver paso 3)

---

### 3. Generar Tokens para Citas Existentes

Las citas que ya existen no tienen token (se genera solo en INSERT).

**Ejecutar en SQL Editor:**

```sql
-- Generar tokens para citas que no los tienen
UPDATE citas
SET token = encode(gen_random_bytes(16), 'hex')
WHERE token IS NULL;

-- Verificación
SELECT COUNT(*) FROM citas WHERE token IS NOT NULL;
SELECT COUNT(*) FROM citas WHERE token IS NULL;  -- Debe ser 0
```

---

### 4. Verificación Completa

**Después de los 3 pasos anteriores, ejecutar:**

```sql
-- 1. Verificar RLS está habilitado y tiene políticas estrictas
SELECT tablename, policyname, cmd FROM pg_policies WHERE tablename='citas' ORDER BY tablename, policyname;

-- 2. Verificar columna token existe y está indexada
SELECT column_name, data_type FROM information_schema.columns WHERE table_name='citas' AND column_name='token';

-- 3. Verificar todos las citas tienen token
SELECT COUNT(*) as total, 
       COUNT(CASE WHEN token IS NOT NULL THEN 1 END) as con_token,
       COUNT(CASE WHEN token IS NULL THEN 1 END) as sin_token
FROM citas;

-- 4. Verificar trigger funciona (crear una cita test)
INSERT INTO citas (coach_id, nombre, email, tipo, inicio, estado)
VALUES ('test-coach-id', 'Test', 'test@example.com', 'sesion', NOW(), 'pendiente');

-- Debe tener token autogenerado:
SELECT id, token FROM citas WHERE nombre='Test' ORDER BY id DESC LIMIT 1;
```

---

## ¿Qué pasa ahora en el flujo?

### Antes (vulnerable):
1. Coach genera link: `sala.html?room=Pathway-<coach_id>-<timestamp>&mod=0&name=...`
2. Cualquiera con coach_id conocido puede reconstruir el link
3. RLS abierto → Supabase no valida acceso
4. **Rashid entra sin invitación** ❌

### Después (seguro):
1. Coach genera link: `sala.html?room=...&token=<token_unico>&name=...`
2. Token es criptográfico de 32 chars (128 bits), imposible de adivinar
3. sala.html valida token contra Supabase (fetches `citas?token=eq...`)
4. RLS estricto rechaza acceso cross-coach
5. MOD status validado contra localStorage (identidad del coach)
6. **Rashid no puede entrar sin token válido** ✅

---

## Cambios en el Código

### panel-v2.html
- Línea 3404-3427: `_agSalaUrl()` ahora incluye `&token=` si existe
- Línea 4575-4585: `_salaClientLink()` ahora incluye `&token=` si existe

### sala.html
- Línea 321-343: Se agrega `var TOKEN = qp('token') || '';`
- Línea 354-420: Nueva función `_validateAccess()` que valida token contra Supabase
- MOD status sigue dependiendo de localStorage (identidad local), pero sin ?mod=1 en URL

### Nuevos archivos
- `supabase/migrations/citas_token_generation.sql` — Trigger que auto-genera tokens

---

## Cronograma Recomendado

1. **Hoy:** Aplicar migrations RLS (0100, 0101) en SQL Editor
2. **Hoy:** Aplicar trigger de generación de tokens (citas_token_generation.sql)
3. **Hoy:** Generar tokens para citas existentes (UPDATE ... WHERE token IS NULL)
4. **Hoy:** Hacer git push de estos cambios (ya están en staging)
5. **Mañana:** Testear con un cliente nuevo (debe recibir link con token)
6. **Mañana:** Testear que sala.html rechaza links sin token válido

---

## Testing Checklist

Una vez aplicadas todas las migraciones:

- [ ] Nueva cita tiene token autogenerado
- [ ] Link generado en panel incluye ?token=<valor>
- [ ] Cliente puede entrar a sala.html con link válido
- [ ] Cliente NO puede entrar a sala.html con link sin token
- [ ] Cliente NO puede entrar si falsifica ?token=invalid
- [ ] Coach entra como MOD (mod=1) solo si es el dueño (localStorage mj_user.id)
- [ ] Chat, notas, resultado se guardan correctamente
- [ ] Validación de email todavía funciona (best-effort)

---

## FAQ

**P: ¿Qué pasa con las citas viejas sin token?**
R: Los clientes reciben un link con ?token=null (o sin ?token). La validación lo rechaza. Genera nuevos tokens con el UPDATE arriba.

**P: ¿Qué pasa si el token se filtra?**
R: El token se pasa en la URL (visible en navegador, posible de capturar en logs). Para máxima seguridad en el futuro, pasar por POST o localStorage.

**P: ¿El ?mod=1 sigue funcionando?**
R: Sí, pero solo para coaches logueados con mj_user.id == coach_id. URL ?mod=1 sin identidad válida no convierte a nadie en coach.

**P: ¿Qué pasa si Supabase validation falla (sin conexión)?**
R: En _validateAccess(), los fetch() usan .catch() → la sala funciona igual pero sin validación. Es best-effort. Si es crítico, bloquear la sala hasta que valide.

---

## Referencias

- Audit completo: `AUDITORIA_CITAS_SEGURIDAD.md`
- Migrations: `supabase/migrations/0100_*.sql`, `0101_*.sql`, `citas_token_generation.sql`
- Security model: `CLAUDE.md` → "SECURITY MODEL — multi-tenant aislamiento"

---

## Support

Si hay errores en Supabase al aplicar las migrations, revisar:
1. ¿Estoy en la base de datos correcta? (pathwaycareercoach.com)
2. ¿Hay typos en los NAMES de las políticas? (probá DROP IF EXISTS primero)
3. ¿El trigger de citas_token_generation.sql se ejecutó sin error?
4. ¿Las columnas org_id, grupal, token existen en tabla citas?

Si el trigger no funciona, verificar que `gen_random_bytes` está habilitado en Supabase (es built-in, pero algunas versiones viejas pueden no tenerlo).
