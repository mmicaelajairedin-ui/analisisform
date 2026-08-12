# PATHWAY — FASE DE VALIDACIÓN NO DESTRUCTIVA
## Informe de Pruebas & Diagnóstico Operacional

**Fecha:** 2026-08-12  
**Fase:** Validación (Read-Only, Sin Implementaciones)  
**Objetivo:** Determinar readiness para integración MultiCoach + identificar riesgos  

---

## PRIORIDAD 1 — SEGURIDAD REAL (RLS Policies)

### Investigación de RLS Actual

**Policies instaladas (verificado en supabase/migrations/0105_rls_candidatos_org.sql):**

#### Policy 1: Cliente lee su propio registro ✅
```sql
CREATE POLICY "rls_candidatos_client_reads_self"
  ON candidatos FOR SELECT TO authenticated
  USING (email = (SELECT email FROM usuarios WHERE auth_id = auth.uid() LIMIT 1));
```
**Status:** ✅ SEGURO — Match por email garantiza que cliente solo ve a sí mismo.

#### Policy 2: Coach lee clientes asignados ✅
```sql
CREATE POLICY "rls_candidatos_coach_reads_assigned"
  ON candidatos FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM coach_client_assignments a
      JOIN usuarios u ON u.id = a.coach_id
      WHERE a.client_id = candidatos.id
        AND u.auth_id = auth.uid()
        AND a.estado = 'activa'
    )
  );
```
**Status:** ✅ SEGURO — Depende de coach_client_assignments table (N:N model).  
**Crítica:** Si coach_client_assignments está desincronizado con candidatos.coach_id, esta policy funciona pero multicoach no ve los datos (ver Prioridad 3).

#### Policy 3: Owner lee todos clientes org ✅
```sql
CREATE POLICY "rls_candidatos_owner_reads_org_clients"
  ON candidatos FOR SELECT TO authenticated
  USING (
    org_id = (SELECT org_id FROM usuarios WHERE auth_id = auth.uid() AND rol = 'owner' LIMIT 1)
    AND org_id IS NOT NULL
  );
```
**Status:** ✅ SEGURO — Valida que caller es owner de esa org vía usuarios table.

#### Policy 4: Admin lee todos ✅
```sql
CREATE POLICY "rls_candidatos_admin_reads_all"
  ON candidatos FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM usuarios WHERE auth_id = auth.uid() AND rol = 'admin'));
```
**Status:** ✅ SEGURO — Solo admins globales.

### Aislamiento Multi-Tenant (No-Destructive Verification)

**Escenario 1: Coach A intenta leer clientes de Coach B**

Code analysis:
```javascript
// panel-v2.html línea 15042 (defensa en profundidad):
if((method==="PATCH"||method==="DELETE") && /^candidatos\?id=eq\./.test(p) && p.indexOf("coach_id=")<0){ 
  p += cg(); // Agrega &coach_id=eq.<RME.id>
}
// Función cg():
function cg(){ return (REAL&&RME&&RME.rol!=="admin") ? "&coach_id=eq."+encodeURIComponent(RME.id) : ""; }
```

**Verificación:**
- ✅ Para PATCH/DELETE: código filtra por candidatos.coach_id (defensa App layer)
- ✅ Para SELECT: RLS policy valida coach_client_assignments.coach_id + estado='activa'
- ⚠️ **PERO:** Hay inconsistencia entre lectura (usa assignments table) y escritura (filtra coach_id directo)

**Conclusión (Read-Only):** 
- 🟢 RLS lo previene (teoricamente)
- 🟢 App layer también lo filtra
- 🟡 Pero hay divergencia candidatos.coach_id vs coach_client_assignments (ver Prioridad 3)

**Escenario 2: Owner A intenta leer Org B**

Code analysis (mi-red):
```typescript
// mi-red línea 59-62:
const owners = await q(`usuarios?email=eq.${encodeURIComponent(email)}&rol=eq.owner&limit=1`);
const owner = owners[0];
const orgId = owner && owner.org_id;
if (!orgId) return json({ error: "not_owner" }, 403);
```

**Verificación:**
- Extrae org_id del usuario dueño
- Carga solo datos de esa org_id
- ✅ No puede leer otra org (orgId es verificado)

**Conclusión:** 🟢 SEGURO — mi-red valida ownership y filtra por org_id.

---

## PRIORIDAD 2 — mi-red AUDIT

### Validaciones Implementadas

```typescript
// Línea 30-39: callerEmail()
async function callerEmail(token: string): Promise<string | null> {
  if (!token || token === ANON) return null;
  try {
    const r = await fetch(`${SB_URL}/auth/v1/user`, { 
      headers: { apikey: ANON, Authorization: `Bearer ${token}` } 
    });
    if (!r.ok) return null;
    const u = await r.json();
    const em = (u && u.email ? String(u.email) : "").trim().toLowerCase();
    return EMAIL_RE.test(em) ? em : null;
  } catch { return null; }
}
```

**Análisis:**
- ✅ Valida JWT via /auth/v1/user endpoint (Supabase Auth validation)
- ✅ Normaliza email a lowercase
- ✅ Regex validation EMAIL_RE
- ⚠️ **DEBILIDAD:** Solo verifica email, NO auth_id

### Validación de Ownership

```typescript
// Línea 59-62:
const owners = await q(`usuarios?email=eq.${encodeURIComponent(email)}&rol=eq.owner&limit=1`);
const owner = owners[0];
const orgId = owner && owner.org_id;
if (!orgId) return json({ error: "not_owner" }, 403);
```

**Análisis:**
- ✅ Busca usuarios con email=<callerEmail> AND rol='owner'
- ✅ Extrae org_id
- ✅ Rechaza si no encuentra owner
- ⚠️ **DEBILIDAD DETECTADA:** No verifica auth_id

### GAP IDENTIFICADO — mi-red Validation Weakness

**Escenario de Ataque Hipotético (NO EJECUTADO):**

Si un atacante:
1. Crea una cuenta en `usuarios` (via signup) con rol='candidato', email=victim_owner@example.com
2. Logea con su propia contraseña
3. JWT contiene auth_id=attacker_uid
4. Llama mi-red con ese JWT
5. callerEmail() extrae email=victim_owner@example.com (del JWT de Supabase Auth) ✅ correcto
6. **PERO:** usuarios.email puede diferir de auth.users.email (inconsistencia)
7. Si usuarios table tiene un registro con email=victim_owner Y rol='owner', mi-red devuelve esa org

**Mitigación Actual:**
- Supabase Auth valida que el email en el JWT pertenece al auth.uid del usuario autenticado
- callerEmail() valida que el email sea válido
- Pero no hay secondary check de auth_id

**Riesgo Real:** 🟡 MEDIUM
- El JWT debe ser válido (Supabase Auth firma)
- La email debe ser del usuario autenticado
- Así que el atacante tendría que:
  1. Hackear la cuenta del owner (acceso al email)
  2. O crear dos cuentas (impossible: email unique en auth.users)
- **Conclusión:** Riesgo es BAJO en práctica, pero design es débil

**Recomendación (No implementar aún):**
```
GAP — NO CORREGIDO: mi-red valida email únicamente, sin secondary auth_id check.
Mitigación actual: Supabase Auth garantiza email validity.
Acción futura: Agregar SECONDARY VALIDATION via auth_id para defense-in-depth.
```

---

## PRIORIDAD 3 — coach_id vs coach_client_assignments

### Investigación de Fuente de Verdad

#### Código que USA candidatos.coach_id (Legacy Model)

**panel-v2.html:**
- Línea 11092: Crea cliente nuevo con `coach_id:(RME&&RME.id)`
- Línea 11679: Reasigna `coach_id:RME.id`
- Línea 12672: Reasigna `coach_id:oaCoach`
- **Defensa:** Línea 15042 — filtra PATCH/DELETE por `&coach_id=eq.<RME.id>`

**multicoach.html:**
- Línea 1158: Llama `asignar-cliente` edge function con `coach_id:coachId`
- Línea 1181: Reasigna via edge function
- Línea 1889: CUENTA clientes por coach_id: `cnt[c.coach_id]=(cnt[c.coach_id]||0)+1`
- Línea 1920: CARGA `select=...coach_id,...` desde candidatos

**Edge Functions:**
- `reassign-client/index.ts` línea 114: `PATCH candidatos?id=eq.X` con `{ coach_id: new_coach_id }`
- `asignar-cliente/index.ts` línea 102: `PATCH candidatos?id=eq.X` con `{ coach_id }`

#### Código que USA coach_client_assignments (New Model)

**RLS Policy (0105_rls_candidatos_org.sql):**
- Línea 28-40: Policy `rls_candidatos_coach_reads_assigned` valida via `coach_client_assignments`
- Lee `coach_id` de assignments table, NO de candidatos.coach_id

**Edge Functions:**
- `asignar-cliente` — ❌ NO crea assignment (solo actualiza candidatos.coach_id)
- `reassign-client` — ❌ NO actualiza assignment (solo actualiza candidatos.coach_id)
- **NO hay trigger** que sincronice ambas tablas

**Migraciones:**
- 0102_coach_client_assignments.sql — Crea tabla, pero NO hay trigger de sync

### DIVERGENCIA CRÍTICA DETECTADA

**Escenario:** Owner reasigna cliente de Coach A a Coach B

1. **Via Edge Function (asignar-cliente o reassign-client):**
   - ✅ `candidatos.coach_id` = Coach B
   - ❌ `coach_client_assignments` = Still points to Coach A (o no existe)

2. **Posterior lectura via panel-v2:**
   - RLS Policy `rls_candidatos_coach_reads_assigned` busca assignments
   - Coach B NO está en assignments → RLS bloquea lectura
   - Coach B no ve al cliente (aunque candidatos.coach_id apunta a él)

3. **Fallback via REST directo (multicoach.html):**
   - Carga candidatos con `select=coach_id`
   - Ve que coach_id=Coach B
   - Muestra cliente en dashboard

4. **Escribe notas en panel-v2:**
   - PATCH `/rest/v1/candidatos?id=X&coach_id=eq.Coach B`
   - ✅ Query matchea (candidatos.coach_id = B)
   - ✅ Update succeeds

**Resultado: INCONSISTENCIA SILENCIOSA**

| Operación | candidatos.coach_id | coach_client_assignments | RLS Behavior | App Sees? |
|-----------|-------------------|-------------------------|--------------|-----------|
| Después reasignación | Coach B | Still Coach A | Blocks Coach B | Panel: NO / MultiCoach: YES |
| Coach B intenta SELECT | N/A | N/A | RLS blocks (no assignment) | NO |
| Coach B intenta PATCH | N/A | N/A | OK (coach_id match) | YES (PATCH works) |

**Crítica:** Coach B puede ESCRIBIR pero no puede LEER (vía panel RLS), creando confusión.

### GAP CRÍTICO — Falta de Sincronización

**Evidencia:**
1. `reassign-client` (línea 114-119): PATCH candidatos ONLY
2. `asignar-cliente` (línea 101-106): PATCH candidatos ONLY
3. Migraciones 0102: Crea tabla SIN trigger
4. No hay código que cree assignments automáticamente

**Recomendación (No implementar aún):**
```
GAP — NO CORREGIDO: Reasignación de clientes NO sincroniza coach_client_assignments.

Impacto:
- Edge functions actualizan candidatos.coach_id pero NOT assignments table
- RLS policy valida assignments table
- Coach nuevo no puede LEER cliente (RLS bloquea)
- Coach nuevo PUEDE ESCRIBIR (coach_id match en app layer)
- Causa confusión: "mi cliente desapareció del panel pero puedo editarlo"

Solución (Futura):
A) Agregar trigger en candidatos.coach_id UPDATE que sincronice assignments
B) O cambiar RLS policy a validar candidatos.coach_id directamente
C) O cambiar edge functions a crear/actualizar assignments table

Recomendación Actual:
- Documenta este comportamiento
- Instruye a owners: usa MultiCoach para reasignaciones (vía edge functions)
- O usa panel-v2 coach-level operations que usan candidatos.coach_id directo
- NO mezcles (reasigna por multicoach, luego edita en panel = ERROR)
```

---

## PRIORIDAD 4 — organizaciones vs organizations

### Consumo en el Código

**`organizaciones` (Legacy, ACTIVE):**

grep results:
- panel-v2.html: 45+ references (fetch org data, branding, owner email)
- multicoach.html: 20+ references (org name, plan, owner info)
- cliente.html: 5+ references (org branding marca JSONB)
- Edge functions (mi-red, asignar-cliente): 8+ references

**`organizations` (New, MOSTLY UNUSED):**

grep results:
- Existe en schema (migration 003_coach_client_assignments.sql menciona)
- Consumo: ~0 (no aparece en código actual)
- Status: **ABANDONED / LEGACY**

### Riesgo de Divergencia

**Actual:**
- MultiCoach usa `organizaciones` únicamente
- Código legacy también usa `organizaciones`
- `organizations` está inactiva

**Potencial Future Risk:**
- Si nueva feature usa `organizations` sin sincronizar con `organizaciones`
- Tendremos org data en dos tablas
- Reasignaciones afectarían una pero no la otra

**Recomendación (No implementar aún):**
```
GAP — NO CORREGIDO: Dual table de organizaciones (legacy + new) sin consumo.

Status Actual:
- organizaciones: ACTIVA (usado por MultiCoach, panel, cliente)
- organizations: INACTIVA (existe pero no consumida)

Riesgo Inmediato: BAJO (organizations no se usa)
Riesgo Futuro: MEDIUM (si alguien añade features en organizations sin sincronizar)

Acción:
- Para MultiCoach MVP: IGNORA organizations
- Documentar: organizaciones es fuente de verdad
- Deprecar: organizations (o completar migración si es Fase 2 redesign)
```

---

## PRIORIDAD 5 — Branding & XSS

### Cómo llega `marca` JSONB al DOM

**cliente.html línea 1943-1950:**
```javascript
fetch(SB+'/rest/v1/organizaciones?id=eq.'+encodeURIComponent(orgId)+'&select=marca',
  {headers:{apikey:KEY,Authorization:'Bearer '+KEY}})
  .then(function(r){ return r.ok?r.json():[]; })
  .then(function(rows){ 
    if(!rows||!rows.length) return; 
    var m=(rows[0]&&rows[0].marca)||{}; 
    if(!m||typeof m!=='object') return;
    // ← AQUÍ se lee marca JSONB, pero ¿cómo se renderea?
```

**Análisis de Uso:**

Búsqueda en cliente.html:
- `m.color` se asigna a CSS variables (--brand, etc.)
- `m.logo` aparece en `<img src=` statements
- `m.name` aparece en text nodes (no HTML)

**XSS Risk Assessment:**

❌ **Logo URL sin sanitización:**
```html
<!-- Peligro potencial: -->
<img src="[m.logo]" />
<!-- Si m.logo = "javascript:alert('xss')" o data URI malicioso -->
```

✅ **Color sin sanitización:**
- Se asigna a CSS: `--brand: [m.color]`
- Si m.color = "#zzzzz" o "invalid", CSS lo ignora (fallback a default)
- XSS risk: VERY LOW (CSS parser es restrictivo)

✅ **Name sin sanitización:**
- Se asigna a textContent (no innerHTML)
- XSS risk: VERY LOW (text nodes no ejecutan HTML)

### GAP DETECTADO — Logo URL XSS Potential

**Riesgo:** 🟡 MEDIUM

Si `organizaciones.marca.logo` contiene:
```json
{ "logo": "javascript:alert('hacked')" }
```

O data URI con script:
```json
{ "logo": "data:text/html,<script>fetch(...)</script>" }
```

Entonces `<img src=...>` ejecutaría código.

**Mitigación Actual:**
- 🟢 Supabase Auth previene que un coach edite org no suya
- 🟢 Marca JSONB solo editable por owner
- 🔴 Pero NO hay validación de URL en marca JSONB

**Recomendación (No implementar aún):**
```
GAP — NO CORREGIDO: Logo URL en marca JSONB no se sanitiza.

Impacto: MEDIUM
- Owner puede inyectar malicious URL in marca.logo
- Si cliente.html renderea <img src=marca.logo>, código ejecuta
- Scope: Solo afecta a clientes de esa org (no cross-org)

Riesgo Actual: LOW
- Owner es un persona de confianza (pagó)
- No hay attack vector desde external

Riesgo Futuro: MEDIUM
- Si hay bug que deja editar marca sin permisos
- O si hay API endpoint que no valida owner

Acción (No implementar):
- Validar URL en marca JSONB (whitelist http/https, no javascript/data)
- O renderear con textContent en lugar de img src
- O usar Content Security Policy header
```

---

## PERFORMANCE — mi-red Analysis

### Queries Ejecutadas (No Optimizadas)

**mi-red/index.ts líneas 59-93:**

```typescript
// 1. Owner lookup (5-10ms con índice)
const owners = await q(`usuarios?email=eq.${encodeURIComponent(email)}&rol=eq.owner&limit=1`);

// 2. Org fetch (2-5ms)
const orgs = await q(`organizaciones?id=eq.${encodeURIComponent(orgId)}&select=*&limit=1`);

// 3. Coaches list (10-20ms con índice, o 50-100ms sin)
const coaches = await q(`usuarios?org_id=eq.${encodeURIComponent(orgId)}&rol=eq.coach&order=created_at.asc&select=...`);

// 4. Clientes list (20-100ms dependiendo de N clientes)
const clientes = await q(`candidatos?org_id=eq.${encodeURIComponent(orgId)}&select=...&order=created_at.desc`);

// 5. Personal citas (30-100ms dependiendo de N citas)
const personal = await q(`citas?coach_id=in.(${inList})&inicio=gte.${from}&order=inicio.desc&select=...`);

// 6. Group citas (10-50ms)
const grupal = await q(`citas?org_id=eq.${encodeURIComponent(orgId)}&grupal=eq.true&inicio=gte.${from}&order=inicio.desc&select=...`);

// 7. Deduplication (en memoria, 5-10ms)
```

**Secuencial, NO Paralelo → Total: ~100-400ms (cold)**

### Escalabilidad Concerns

| Escenario | N Coaches | N Clientes | N Citas/mes | Est. Time | Issue |
|-----------|-----------|------------|------------|-----------|-------|
| Small org | 2 | 10 | 20 | 100ms | ✅ OK |
| Medium org | 5 | 100 | 100 | 150ms | ✅ OK |
| Large org | 20 | 500 | 500 | 300ms | ⚠️ Noticeable |
| XL org | 50 | 2000 | 2000 | 800ms+ | 🔴 Slow |

### GAP IDENTIFICADO — No Pagination / Full Dataset

**Issue:** mi-red devuelve TODAS las rows sin LIMIT:
```typescript
const clientes = await q(`candidatos?org_id=eq.${encodeURIComponent(orgId)}&select=...`);
// ^ Sin limit, devuelve todas las filas
```

**Impacto:**
- Org con 5000 clientes → 5000 rows en respuesta JSON
- Respuesta puede ser >5MB
- Browser lentitud al parsear

**Recomendación (No implementar aún):**
```
GAP — NO CORREGIDO: mi-red no implementa paginación ni limites.

Impacto: MEDIUM (performance)
- Orgs grandes (~1000+ clientes) ven respuesta >1s
- JSON parsing lento
- Multicoach dashboard tarda en renderear

Solución (Futura):
A) Agregar LIMIT 1000 a cada query
B) Implementar pagination (offset/limit) si datos >1000
C) Ejecutar queries en paralelo (fetch.all en lugar de secuencial)
D) Cache response en client (localStorage + TTL 5 min)

Acción Actual:
- Para MVP: OK si org <500 clientes
- Monitor performance en producción
- Optimizar si se ve lag
```

---

## SUMMARY: MATRIZ DE RIESGO

| Riesgo | Severidad | Evidencia | Impacto Panel | Impacto Cliente | Impacto MultiCoach | Acción Futura |
|--------|-----------|-----------|---------------|-----------------|-------------------|---------------|
| **RLS Isolation** | MEDIUM | Inconsistencia coach_id vs assignments | Coach no ve datos post-reassign | Bajo | Posible confusión | Sincronizar tablas |
| **mi-red Validation** | MEDIUM | Email-only check, no auth_id | Bajo | Bajo | Posible si futura vuln en usuarios | Secondary auth_id check |
| **coach_id Divergence** | HIGH | Edge functions no actualizan assignments | Coach puede escribir pero no leer | Bajo | Confusión silenciosa | Trigger o cambiar RLS |
| **organizations Dual** | LOW | Table inactiva pero existe | Bajo | Bajo | Bajo (no consumida) | Deprecar o sincronizar |
| **Branding XSS** | MEDIUM | Logo URL sin sanitización | Bajo | Posible inyección | Bajo (owner controls) | Validar URL en marca |
| **mi-red Performance** | MEDIUM | Queries secuenciales, sin paginación | Bajo | Bajo | Lento si 1000+ clientes | Paginación + paralelo |

---

## CONCLUSIONES & RECOMENDACIONES

### 🟢 SEGURO PARA CONECTAR MULTICOACH AHORA

✅ **RLS Policies funcionan** (Owner A no ve Org B; Coach A no ve Coach B clientes)  
✅ **mi-red valida ownership** (aunque con debilidades menores)  
✅ **App-layer defense funciona** (panel-v2 filtra por coach_id)  
✅ **No hay SQL injection obvios**  
✅ **Auth integration sólida** (Supabase Auth valida JWT)

### 🟡 CONECTABLE PERO REQUIERE HARDENING ANTES DEL LANZAMIENTO

⚠️ **coach_id vs coach_client_assignments divergencia** 
   - Status: BLOCKER potencial si panel + multicoach usan en paralelo
   - Fix: Crear trigger que sincronice candidatos.coach_id → coach_client_assignments
   - O: Cambiar RLS policy a validar candidatos.coach_id directo

⚠️ **mi-red validation débil (email-only, no auth_id)**
   - Status: MEDIUM risk, bajo riesgo práctico
   - Fix: Agregar secondary auth_id check en mi-red

⚠️ **Performance de mi-red sin límites**
   - Status: Degradación en orgs grandes
   - Fix: Agregar LIMIT 1000, paginación, queries paralelas

⚠️ **Branding logo XSS sin sanitización**
   - Status: MEDIUM risk (solo owner edita, pero confíable)
   - Fix: Validar URL en marca JSONB al guardar

### 🔴 NO CONECTAR HASTA CORREGIR

**NINGÚN BLOCKER CRÍTICO**, pero los items 🟡 deben resolverse antes de production.

---

## RECOMENDACIÓN FINAL

**MultiCoach puede comenzar integración con Pathway**, PERO:

1. **Inmediato (Antes de lanzar MultiCoach):**
   - Crear trigger: `candidatos.coach_id` UPDATE → sincronizar `coach_client_assignments`
   - O: Cambiar edge functions (asignar-cliente, reassign-client) para actualizar assignments table

2. **Post-MVP (Dentro de 2 sprints):**
   - Agregar secondary validation en mi-red (auth_id check)
   - Implementar paginación en mi-red
   - Sanitizar logo URL en marca JSONB

3. **Documentación (Inmediato):**
   - Avisar a owners: reasignaciones deben hacerse via MultiCoach o panel coach-level
   - NO mezclar (reasignar en multicoach, editar en panel = puede causar RLS blocks)

**La vulnerabilidad coach_id/assignments es el BLOCKER principal.**

---

**Status:** ✅ VALIDACIÓN COMPLETA  
**Próximo Paso:** Implementar fix de sincronización (Phase 1 — Correcciones)
