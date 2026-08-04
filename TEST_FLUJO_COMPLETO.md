# Test E2E: Mi Empresa Flow (Negocio → Marca → Landing → Portal → IA)

## 1️⃣ Aplicar migración en Supabase

En **Supabase → SQL Editor**, copia y ejecuta:

```sql
-- Add configuracion column to usuarios table
ALTER TABLE usuarios
ADD COLUMN IF NOT EXISTS configuracion JSONB DEFAULT '{"negocio":{},"marca":{}}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_usuarios_configuracion ON usuarios USING GIN (configuracion);
```

✅ Resultado esperado: "Success. No rows returned"

---

## 2️⃣ Verificar edge function está deployado

En **Supabase → Edge Functions**, busca `coach-self-save`.

Si NO está, deploy:
```bash
supabase functions deploy coach-self-save --no-verify-jwt
```

✅ Resultado esperado: Verde, sin errores

---

## 3️⃣ Test real en multicoach.html

### Requisitos:
- Usuario coach autenticado en Supabase Auth
- MC_REAL=true en el navegador
- MC_OWNER con id, email, configuracion

### Flujo:

**A. Mi Negocio**
1. Click en tab "Negocio"
2. Completa campos:
   - Especialidad: "Life Coach"
   - Qué haces: "Ayudo a profesionales en transición"
   - A quién ayudas: "Ejecutivos"
   - Problema: "Incertidumbre"
   - Cómo trabajas: "Sesiones 1:1"
   - Servicios: "Coaching; Mentoría"
   - Tono: "Empático"
   - CTA: "Agendar", "https://calendly.com/coach"
3. Click "Guardar Negocio"
   - ✅ Toast: "Negocio guardado ✓"
   - ✅ MC_OWNER.configuracion.negocio tiene los datos

**B. Marca**
1. Click tab "Marca"
2. Completa campos:
   - Logo: sube PNG/SVG (opcional)
   - Colores: elige primario (#2D6A4F) y secundario (#52B788)
   - Tipografía: "Inter"
   - Dominio: "mycoach.com"
   - Favicon: "🚀"
3. Click "Guardar" (sin logo)
   - ✅ Toast: "Marca guardada ✓"
   - ✅ MC_OWNER.configuracion.marca tiene los datos

**C. Landing**
1. Click tab "Landing"
   - ✅ Muestra preview
   - ✅ Botones: "Regenerar", "Abrir Landing"
   - ✅ Responsive: Desktop/Tablet/Mobile

**D. Portal**
1. Click tab "Portal"
   - ✅ Muestra preview del portal del cliente
   - ✅ Secciones: Dashboard, Documentos, Sesiones, Chat

**E. IA**
1. Click tab "IA"
   - ✅ Explica que IA aprende de Negocio/Marca
   - ✅ Muestra: Emails, Landing, Portal, Chat IA

---

## 4️⃣ Verificar en BD (SQL Editor)

```sql
-- Busca el coach y verifica configuracion
SELECT 
  id,
  email,
  configuracion->>'negocio' as negocio,
  configuracion->>'marca' as marca
FROM usuarios
WHERE email = 'coach@email.com'
LIMIT 1;
```

✅ Resultado esperado:
- negocio: JSON con especialidad, que_haces, etc.
- marca: JSON con logo, colores, dominio, etc.

---

## 5️⃣ Test recarga (persistencia)

1. Recarga la página (F5)
2. Accede a multicoach.html con el mismo coach
3. Click en "Mi Empresa" → "Negocio"
   - ✅ Campos cargados con los datos guardados
4. Click en "Marca"
   - ✅ Logo/colores/dominio cargados

---

## 6️⃣ Edge cases

| Caso | Resultado esperado |
|------|-------------------|
| Guardar sin completar Negocio | Toast error: "Completa al menos: especialidad, qué haces" |
| Logo > 5MB | Toast error: "Archivo muy grande" |
| Cambiar especialidad en Negocio | Landing se regenera automáticamente |
| Cambiar dominio en Marca | Landing URL actualiza |
| Refresh mientras se guarda | No duplica guardado (idempotente) |

---

## Checklist final

- [ ] Migración aplicada sin errores
- [ ] Edge function deployado (verde en Supabase)
- [ ] Negocio guarda y persiste
- [ ] Marca guarda y persiste
- [ ] Landing muestra preview
- [ ] Portal muestra preview
- [ ] IA explica el flujo
- [ ] Datos persisten en recarga
- [ ] Toast messages funcionan
- [ ] No hay errores en console

---

## Resultado: ✅ LISTO PARA PRODUCCIÓN
