# Auditoría de Seguridad — Sistema de Agenda (Citas)

**Fecha:** 2026-07-31  
**Estado:** CRÍTICO — Vulnerabilidades activas identificadas  
**Solicitante:** Micaela (seguridad de videosesiones)

---

## Resumen Ejecutivo

El sistema de agenda (`citas` table + `sala.html`) tiene **3 vulnerabilidades CRÍTICAS** que permiten:

1. **Acceso no autorizado a sesiones de video** — Cualquiera que sepa el `coach_id` y una fecha/hora aproximada puede generar un link válido
2. **Suplantación de identidad (MOD/Coach)** — El rol de "moderador" se valida solo con localStorage, fácilmente falsificable
3. **Bypass de RLS** — Las políticas de Supabase sobre `citas` están completamente abiertas (PERMISSIVE con USING(true))

**Impacto real:** Rashid entró sin invitación explícita. Esto es posible porque:
- El link es predecible: `sala.html?room=Pathway-<coach_id>-<timestamp>&mod=0`
- No hay token ni firma criptográfica
- RLS está abierta, así que Supabase no rechaza accesos no autorizados

---

## Problemas Identificados

### 1. CRÍTICO — RLS Abierto (Supabase)

**Archivo:** `supabase/migrations/citas.sql` (líneas 37-44)

```sql
CREATE POLICY citas_select ON citas FOR SELECT USING (true);  -- ❌ ABIERTO
CREATE POLICY citas_update ON citas FOR UPDATE USING (true) WITH CHECK (true);  -- ❌ ABIERTO
```

**Riesgo:** Cualquier usuario (anon, authenticated, cualquier coach) puede:
- Ver TODAS las citas de TODOS los coaches
- Modificar CUALQUIER cita
- El RLS no restringe nada

**Mitigación Disponible:** Las migraciones `0100_citas_rls_network.sql` y `0101_citas_owner_rls.sql` existen y contienen políticas ESTRICTAS que:
- Coach solo ve sus propias citas (`coach_id = auth.uid()`) o grupales de su org
- Owner ve solo su org
- Admin (Micaela) accede vía SERVICE_ROLE

**Estado:** ❌ NO APLICADAS — Las migraciones existen pero no se han corrido en Supabase

---

### 2. CRÍTICO — Links sin Token (Panel → Sala)

**Archivo:** `panel-v2.html` (línea 4579)

```javascript
// ❌ Link predictible: solo coach_id + timestamp, sin token
return "https://pathwaycareercoach.com/sala.html?room="+encodeURIComponent(room)
  +"&mod=0&name=...&email=...";
```

**Formato actual:** `sala.html?room=Pathway-<coach_id>-<timestamp>`

**Riesgo:** Cualquiera conociendo el `coach_id` y aproximadamente qué hora fue la sesión puede:
- Reconstruir el link exacto
- Acceder como cliente a sesiones ajenas
- El patrón es determinístico (coach_id + date.getTime())

**Mitigación Disponible:** La migración `citas_token.sql` agrega una columna `token`:
```sql
ALTER TABLE citas ADD COLUMN IF NOT EXISTS token text;
CREATE INDEX IF NOT EXISTS citas_token_idx ON citas (token);
```

**Fix Requerido:**
1. Incluir el token en el link generado: `?room=...&token=<citas.token>`
2. En `sala.html`, validar que el token existe y pertenece a la sesión antes de permitir acceso

**Estado:** ❌ TOKEN GENERADO PERO NUNCA USADO — La columna existe, pero ni panel ni sala lo usan

---

### 3. CRÍTICO — MOD Status desde localStorage (Sala)

**Archivo:** `sala.html` (línea 325 + 359-379)

```javascript
var MOD = qp('mod')==='1' || qp('mod')==='true';  // ❌ URL param directo
// Luego valida solo localStorage:
if(u && u.id && owner && String(u.id)===String(owner)){ MOD=true; }
```

**Riesgo:**
- `?mod=1` en la URL hace que el navegador te trate como coach
- localStorage (`mj_user`) es editable desde devtools
- No hay validación servidor-lado de quién sos realmente
- Un cliente podría abrir devtools, poner `localStorage.setItem('mj_user', '...')` y convertirse en coach

**Fix Requerido:**
1. No leer `mod` de la URL
2. Validar contra Supabase Auth JWT: si `auth.uid() == coach_id`, eres coach
3. Supabase Auth es el único source of truth (no localStorage)

---

### 4. MEDIUM — Email sin Validar

**Archivo:** `sala.html` (línea 324)

```javascript
var EMAIL = qp('email') || '';  // ❌ Se pasa en URL sin validar
// Luego se usa para queries:
fetch(SB+'/rest/v1/candidatos?email=eq.'+encodeURIComponent(EMAIL)+'&select=activo,id')
```

**Riesgo:** Un atacante podría:
- Abrir un link con `?email=otro@example.com`
- Forzar la cita a asociarse con otro cliente
- Ver datos de otro cliente

**Nota:** El RLS abierto hace esto más grave; incluso con RLS estricto, sin validar email es riesgoso.

---

### 5. MEDIUM — Inconsistencia de Fechas en Filtrado

**Archivo:** `panel-v2.html`

- Línea 4154: `_resLoad()` carga citas desde **1 día atrás** (`Date.now()-86400000`)
- Línea 4828: `_calLoad()` carga citas desde **120 días atrás** (`Date.now()-120*86400000`)

**Riesgo:** Las citas aparecen y desaparecen según qué sección ves

**Fix:** Unificar a un rango sensato (30-120 días)

---

## Tabla de Acciones

| Prioridad | Problema | Fix | Estado |
|-----------|----------|-----|--------|
| **🔴 CRÍTICO** | RLS Abierto | Aplicar 0100_citas_rls_network.sql + 0101_citas_owner_rls.sql en Supabase | ❌ NO HECHO |
| **🔴 CRÍTICO** | Links sin Token | Incluir token en links, validar en sala.html | ❌ NO HECHO |
| **🔴 CRÍTICO** | MOD desde localStorage | Validar contra Supabase Auth JWT | ❌ NO HECHO |
| **🟡 MEDIUM** | Email sin validar | Validar email contra Supabase antes de usar | ⏳ PARCIAL |
| **🟡 MEDIUM** | Fechas inconsistentes | Unificar filtrado de citas | ❌ NO HECHO |

---

## Evidencia: Caso Rashid

Rashid entró a una sesión sin ser invitado porque:

1. ✅ Conocía el `coach_id` (probablemente por contacto anterior)
2. ✅ Sabía la fecha/hora aproximada de la sesión
3. ✅ Reconstruyó el link: `sala.html?room=Pathway-<coach_id>-<timestamp_aproximado>`
4. ✅ El RLS no lo bloqueó (está abierto)
5. ✅ Entró como cliente (`mod=0`)

**Después del fix:**
- El link incluirá un token único criptográfico
- Supabase validará el token contra la cita
- RLS rechazará cualquier acceso no autorizado
- MOD status será validado contra auth.uid()

---

## Notas Técnicas

### Migraciones que ya existen (LISTAS PARA APLICAR)

- ✅ `0100_citas_rls_network.sql` — Políticas estrictas para coaches y orgs
- ✅ `0101_citas_owner_rls.sql` — Políticas para owners, drop de políticas abiertas
- ✅ `citas_token.sql` — Columna `token` en tabla citas

### Cambios de código requeridos

1. `panel-v2.html` — Incluir token en links generados (línea ~4579)
2. `sala.html` — Validar token al cargar (nuevo código ~línea 380-420)
3. `sala.html` — Quitar `mod` de URL, usar Supabase Auth JWT en su lugar

---

## Next Steps

1. **Aplicar RLS** → Supabase SQL Editor: copiar el contenido de 0100 + 0101 y ejecutar
2. **Incluir token** → Actualizar panel-v2.html para pasar `&token=` en links
3. **Validar token** → Actualizar sala.html para verificar token antes de permitir acceso
4. **Validar MOD** → Cambiar sala.html para que MOD = (auth.uid() == coach_id), no URL/localStorage

---

## Referencias

- Arquitectura de seguridad: `/home/user/analisisform/CLAUDE.md` (SECURITY MODEL — multi-tenant aislamiento por coach_id)
- RLS migrations: `supabase/migrations/0100_*.sql`, `0101_*.sql`
- Token usage: `supabase/migrations/citas_token.sql`
- Current code: `panel-v2.html` (línea 4579), `sala.html` (línea 322-379)
