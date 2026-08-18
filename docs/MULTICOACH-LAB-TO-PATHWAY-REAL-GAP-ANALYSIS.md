# MULTICOACH LAB → PATHWAY REAL: DATA INTEGRATION GAP ANALYSIS

**Fecha:** Agosto 2026  
**Propósito:** Mapeo 1:1 entre datos de laboratorio (multicoach.html) y tablas reales de Pathway, sin implementar.  
**Restricción:** Solo análisis. No crear tablas, no hacer migraciones, no tocar RLS/Auth, no modificar Edge Functions, no eliminar multicoach-lab.

---

## EXECUTIVE SUMMARY

**Hallazgo crítico:** MultiCoach ya lleva el código para leer datos reales de Pathway mediante:
1. Edge Function `mi-red` (SERVICE ROLE, lee org + coaches + clientes + citas)
2. Fallback a REST API directo: `organizaciones`, `usuarios`, `candidatos`

**El "lab" es la maqueta de demostración** (`DB = {coaches: [...], clientes: [...]}` en línea 896).

**MC_REAL flag (línea 908):**
- `MC_REAL=false` → Maqueta ("Alex Gómez")
- `MC_REAL=true` → Datos reales de Pathway (cuando hay dueño logueado)

**El mapa ya existe** (funciones mcMapCoach, mcMapCli) pero hay **gaps en los datos** que Pathway debe proporcionar para que MultiCoach funcione sin cambios de código.

---

## 1. TABLA COMPARATIVA: MULTICOACH LAB vs. PATHWAY REAL

### 1.1 DATA STRUCTURE EN MEMORY

**Actualmente en multicoach.html:**
```javascript
var DB = {
  coaches: [
    { id, n, email, tel, ini, nicho, rat, ret, cli, ses, esp, est, foto, tipo, permisos, servicios }
  ],
  clientes: [
    { id, n, email, tel, ini, nicho, coach, est, prog, week, plan, med, lastState, _ts, _created, ult, foto }
  ]
};
var MC_ORG = { id, nombre, plan, max_coaches, max_clientes, fecha_fin_prueba, estado_sub, nicho, marca };
var MC_CITAS = [ { coach_id, nombre, email, tipo, inicio, modalidad, lugar, grupal, estado } ];
var MC_OWNER = { id, nombre, email, org_id, rol };
```

### 1.2 DATA FLOW HOY

```
┌──────────────────────────────────┐
│ mcBoot()                         │
│ (línea 1938)                     │
└────────────┬──────────────────────┘
             │
             ├─ localStorage.mj_user
             │
             ├─ if rol='owner' → mcLoadReal(owner)
             │                         │
             │                         ├─ Edge Function: mi-red (prefiere)
             │                         │   POST /functions/v1/mi-red → {ok, org, coaches, clientes, owner, citas}
             │                         │
             │                         └─ Fallback: REST directo (si mi-red falla)
             │                             ├─ GET organizaciones (by owner email/org_id)
             │                             ├─ GET usuarios (WHERE org_id + rol=coach)
             │                             └─ GET candidatos (WHERE org_id)
             │
             └─ if rol≠'owner' → Maqueta (DB = {...demo...})
```

**En línea 1906-1927:** La lógica del fallback luce así:
```javascript
return mcGet('organizaciones', 'id=eq.'+orgId+'&select=*&limit=1')
  .then(function(orgs){
    var org = orgs[0];
    return Promise.all([
      mcGet('usuarios','org_id=eq.'+orgId+'&rol=eq.coach&select=id,nombre,email,activo,foto_url,configuracion'),
      mcGet('candidatos','org_id=eq.'+orgId+'&select=id,nombre,email,activo,coach_id,semana_activa,foto_perfil,created_at,updated_at&order=created_at.desc')
    ]);
  });
```

---

## 2. COMPARATIVO FIELD-BY-FIELD: COACHES

### Fuente: `usuarios` table (Pathway real) + conteo desde `coach_client_assignments`

| Dato mostrado en UI | Campo en DB.coaches | Tabla Pathway | Columna | Mapeo actual | Validez | Falta |
|---|---|---|---|---|---|---|
| Nombre | `n` | usuarios | nombre | ✅ | Existe | — |
| ID | `id` | usuarios | id | ✅ | Existe | — |
| Email | `email` | usuarios | email | ✅ | Existe | — |
| Teléfono | `tel` | usuarios | configuracion.telefono | ✅ | En JSONB | — |
| Iniciales | `ini` | — | — | Calculado | OK | — |
| Nicho | `nicho` | usuarios | org.nicho (heredado) | ✅ | De org | — |
| Rating | `rat` | usuarios | configuracion.rating | ⚠️ | En JSONB, puede no existir | Valor default 0 |
| Retención | `ret` | usuarios | configuracion.retencion | ⚠️ | En JSONB, puede ser NULL | Cálculo desde sesiones |
| Clientes asignados | `cli` | coach_client_assignments | COUNT WHERE coach_id + estado='activa' | ⚠️ | Se cuenta en línea 1889 | ✅ Existente |
| Sesiones | `ses` | usuarios | configuracion.sesiones | ⚠️ | En JSONB, puede no existir | Cálculo desde sesiones_registro |
| Especialidad | `esp` | usuarios | configuracion.especialidad | ✅ | En JSONB | — |
| Estado | `est` | usuarios | activo | ✅ | Boolean → 'activo'/'inactivo' | — |
| Foto | `foto` | usuarios | foto_url (o configuracion.foto) | ✅ | Existe | Fallback a gris |
| Tipo | `tipo` | usuarios | configuracion.member_role | ✅ | 'coach' o 'colaborador' | Default 'coach' |
| Permisos | `permisos` | usuarios | configuracion.permisos | ⚠️ | JSONB, no documentado | GAP: no existe spec |
| Servicios | `servicios` | usuarios | configuracion.servicios | ⚠️ | JSONB array, no documentado | GAP: no existe en Pathway |
| esOwner | `esOwner` | — | — | Flag local | OK | Marcado en _apply() |

**Decisiones de producto:**
1. ¿Retención (`ret`)? ¿Cómo se calcula? ¿Desde sesiones_registro? ¿Hay métrica en coach_health_snapshots?
2. ¿Permisos (`permisos`)? ¿Qué estructura? ¿Roles de colaborador o granular?
3. ¿Servicios (`servicios`)? ¿Existen en Pathway o es del lab?

---

## 3. COMPARATIVO FIELD-BY-FIELD: CLIENTES

### Fuente: `candidatos` table (Pathway real)

| Dato mostrado en UI | Campo en DB.clientes | Tabla Pathway | Columna | Mapeo actual | Validez | Falta |
|---|---|---|---|---|---|---|
| Nombre | `n` | candidatos | nombre | ✅ | Existe | — |
| ID | `id` | candidatos | id | ✅ | Existe | — |
| Email | `email` | candidatos | email | ✅ | Existe | — |
| Teléfono | `tel` | candidatos | telefono (o tel) | ✅ | Existe | — |
| Iniciales | `ini` | — | — | Calculado | OK | — |
| Nicho | `nicho` | candidatos | (heredado de org) | ⚠️ | No en candidatos, usar org | Usar MC_ORG.nicho |
| Coach asignado | `coach` | candidatos | coach_id | ✅ | Existe | — |
| Estado | `est` | candidatos | activo | ✅ | Boolean → 'activo'/'inactivo' | — |
| Progreso | `prog` | candidatos | (?) | ❌ | No existe | GAP: ¿Dónde guardar? |
| Semana actual | `week` | candidatos | semana_activa | ✅ | Existe | — |
| Plan | `plan` | candidatos | (?) | ❌ | No existe | GAP: ¿Dónde guardar? |
| Medición | `med` | candidatos | (?) | ❌ | No existe | GAP: ¿Dónde guardar? |
| Last state | `lastState` | — | — | Calculado | ⚠️ | Podría ser from sesiones_registro |
| Timestamp | `_ts` | candidatos | updated_at | ✅ | Existe | — |
| Created | `_created` | candidatos | created_at | ✅ | Existe | — |
| Último evento | `ult` | — | — | Calculado desde _ts | ✅ | timeAgo() |
| Foto | `foto` | candidatos | foto_perfil | ✅ | Existe | — |

**Decisiones de producto:**
1. ¿`prog` (progreso)?** Ej. "Onboarding", "CV", "Carta". ¿Nueva columna en candidatos?
2. ¿`plan` (estado del plan)?** "pending", "active", etc. ¿Dónde se guarda? ¿En candidatos o en una tabla de progreso?
3. ¿`med` (estado de medición)?** ¿Referencia a mediciones antropométricas?
4. ¿`lastState` (estado del cliente)?** "fresh", "stale", "mid". ¿Derivado de sesiones o se guarda explícitamente?

---

## 4. COMPARATIVO: ORGANIZACIONES

### Fuente: `organizaciones` table (Pathway real)

| Dato mostrado en UI | Campo en MC_ORG | Tabla Pathway | Mapeo | Validez | Falta |
|---|---|---|---|---|---|
| ID | `id` | organizaciones | id | ✅ | Existe | — |
| Nombre | `nombre` | organizaciones | nombre | ✅ | Existe | — |
| Plan | `plan` | organizaciones | plan (o marca.plan) | ⚠️ | En dos lugares | Consolidar |
| Max coaches | `max_coaches` | organizaciones | max_coaches | ✅ | Existe | — |
| Max clientes | `max_clientes` | organizaciones | max_clientes | ✅ | Existe | — |
| Fecha fin prueba | `fecha_fin_prueba` | organizaciones | fecha_fin_prueba | ✅ | Existe | — |
| Estado suscripción | `estado_sub` | organizaciones | estado_sub | ✅ | Existe | — |
| Nicho | `nicho` | organizaciones | nicho | ✅ | Existe | — |
| Marca (white-label) | `marca` | organizaciones | marca (JSONB) | ✅ | Existe | Contiene color, logo, recursos |

**Validez:** Organizaciones mapea bien. Los datos existen.

---

## 5. COMPARATIVO: ASIGNACIONES COACH-CLIENTE

### Fuente: `coach_client_assignments` table (Pathway real)

| Dato/Operación | Usado en MultiCoach | Tabla Pathway | Columnas | Mapeo | Validez |
|---|---|---|---|---|---|
| Listar clientes por coach | UI: Ficha de coach | coach_client_assignments | coach_id | Línea 1889: `(DB.clientes \|\| []).filter(c => c.coach_id === coach.id)` | ⚠️ Alternativo |
| Reasignar cliente | Drag-drop en UI | coach_client_assignments | UPDATE estado | Edge function: asignar-cliente | ✅ Existe |
| Estado assignment | Filtro (activo/pausado/cerrado) | coach_client_assignments | estado | No usado en DB actualmente | GAP |
| Coach capability check | Conteo clientes | coach_client_assignments | COUNT (*) | En línea 1889 | ✅ Reutilizable |

**Gap:** MultiCoach hoy usa `candidatos.coach_id` (relación directa 1:1), pero Pathway tiene `coach_client_assignments` (relación N:N flexible con estado).

**Recomendación:** Pathway tiene la estructura correcta. MultiCoach debe preferir `coach_client_assignments` para flexibilidad (pausar asignación sin borrar cliente).

---

## 6. COMPARATIVO: CITAS/SESIONES

### Fuente: `citas` table (¿existe en Pathway?) + `sesiones_registro`

| Dato en MultiCoach | Tabla Pathway | Columnas | Mapeo actual | Validez | Falta |
|---|---|---|---|---|---|
| coach_id | citas | coach_id | ✅ | Existe | — |
| nombre (cliente) | citas | (?)  | ⚠️ | No clara | Puede ser JOIN a candidatos |
| email (cliente) | citas | (?) | ⚠️ | No clara | Puede ser JOIN a candidatos |
| tipo (reunión type) | citas | tipo | ✅ | Existe | — |
| inicio (datetime) | citas | inicio | ✅ | Existe | — |
| modalidad | citas | modalidad | ✅ | Existe | — |
| lugar | citas | lugar | ✅ | Existe | — |
| grupal | citas | grupal | ✅ | Existe | — |
| estado | citas | estado | ✅ | Existe | — |

**¿Tabla `citas` existe en Pathway?** La auditoría no la documentó explícitamente. Hay referencias en edge functions (`crear-cita-red` línea 1239). Asumir que existe.

---

## 7. PERMISOS: MULTICOACH vs. PATHWAY RLS

### Multicoach Expectations

| Escenario | Permiso esperado | Pathway RLS hoy | Falta |
|---|---|---|---|
| Owner ve su org | SELECT organizaciones WHERE owner_email/owner_id | ✅ rls_org_owner_reads_own | — |
| Owner ve coaches de su org | SELECT usuarios WHERE org_id | ✅ Implícito (rel. directa) | — |
| Owner ve clientes de su org | SELECT candidatos WHERE org_id | ⚠️ Policy existe pero RLS puede no dejar pasar | ⚠️ Necesita validar |
| Coach ve clientes asignados | SELECT candidatos WHERE coach_client_assignments.estado='activa' | ✅ rls_candidatos_coach_reads_assigned | — |
| Coach NO ve clientes no asignados | (implícito) | ✅ Por policy | — |
| Colaborador (si existe) | Permisos granulares | ❌ No implementado | GAP: roles granulares |
| Validar rol in-band | ¿El owner es realmente owner de esa org? | ⚠️ No validado en edge function | GAP: verificación débil |

**RLS State:** Las policies existen (0105_rls_candidatos_org.sql) pero MultiCoach no verifica que owner realmente pertenezca a su org. Edge function `mi-red` bypasea RLS (SERVICE ROLE).

---

## 8. EDGE FUNCTION: "mi-red" vs. FALLBACK REST

### Ruta preferida: Edge Function `mi-red`

**Ubicación esperada:** `supabase/functions/mi-red/index.ts`

**Que debería hacer (inferido del código):**
```typescript
POST /functions/v1/mi-red
Headers: Authorization: Bearer <JWT>
Response: { ok: true, org, coaches, clientes, owner, citas }
```

**¿Existe?** No documentada en la auditoría. Línea 1905 intenta usarla.

**Funcionalidad esperada:**
- Verifica JWT (owner de qué org)
- Lee organizaciones (la suya)
- Lee usuarios WHERE org_id (coaches)
- Lee candidatos WHERE org_id (clientes) — **bypasea RLS aquí** (SERVICE ROLE)
- Opcionalmente lee citas/sesiones

### Ruta fallback: REST directo

**Implementado en línea 1910-1927:**
1. GET organizaciones by owner email / org_id
2. Promise.all:
   - GET usuarios WHERE org_id + rol=coach
   - GET candidatos WHERE org_id (puede devolver [] si RLS bloquea)
3. Mapea resultados via mcMapCoach, mcMapCli

**Validez:** Fallback es robusto pero puede traer clientes vacíos si RLS estricta.

---

## 9. DECISIONES DE PRODUCTO PENDIENTES

### 9.1 ¿Qué es el "lab"?

**Hoy:** DB = {coaches, clientes} hardcodeado (maqueta "Alex Gómez" con datos ficticios)

**¿Débería permanecer?**
- ✅ SÍ: Necesario para demos, prospects, incrustar en landing (equipos.html con ?demo=1)
- ❌ NO: Solo gasto de mantenimiento, ya no vale la pena

**Recomendación:** Mantener por ahora (costo bajo, valor en marketing)

### 9.2 Estructura de "Progreso" del cliente

**Hoy en MultiCoach:** `prog` ('Onboarding', 'CV', 'Carta', 'LinkedIn', etc.)

**¿Dónde guardarlo en Pathway?**
- Opción A: Nueva columna en candidatos (ej. `progreso TEXT`)
- Opción B: JSONB en candidatos existente (ej. `datos_programa JSONB`)
- Opción C: Tabla separada `cliente_progreso` (si hay ciclos/etapas múltiples)

**Recomendación:** Opción A (columna simple, más rápido de consultar)

### 9.3 "Plan" del cliente y estado de mediciones

**Hoy en MultiCoach:** `plan` ('pending', 'active'), `med` ('pending', 'active')

**¿Qué representan?**
- `plan`: ¿Estado de si tiene plan activo? ¿Diferente del plan de la org?
- `med`: ¿Estado de mediciones antropométricas (fitness)?

**¿Dónde guardar?**
- Opción A: Columnas simples en candidatos
- Opción B: JSONB `estado JSONB` = {plan: 'active', med: 'pending', ...}

**Recomendación:** Crear `estado JSONB` en candidatos para encapsular estados complejos

### 9.4 Retención de coach

**Hoy en MultiCoach:** `ret` (% de retención)

**¿Cómo calcular?**
- Desde `coach_health_snapshots` (métricas diarias del coach)?
- Desde sesiones_registro (días sin sesión)?
- Manual en configuracion.retencion?

**Recomendación:** Usar `coach_health_snapshots` si existe; fallback a configuracion.retencion

### 9.5 Permisos granulares ("colaborador")

**Hoy en MultiCoach:** `tipo` ('coach', 'colaborador'), `permisos` (JSONB, no documentado)

**¿Qué debería permitir un colaborador?**
- ¿Ver clientes solo asignados?
- ¿Crear/editar programas?
- ¿No crear coaches?
- ¿No acceder a facturación?

**Recomendación:** Decisión de producto. Si no se necesita ya, no implementar. Pathway tiene `rol_en_org` pero no lógica de "colaborador".

### 9.6 Servicios del coach

**Hoy en MultiCoach:** `servicios` (array de servicios, no documentado)

**¿Existe en Pathway?** No encontrado en auditoría.

**¿Qué son?** ¿Tipos de coaching? ¿Módulos?

**Recomendación:** Si no existe en Pathway, ¿guardar en configuracion.servicios (JSONB)? ¿O es redundante con nicho?

---

## 10. MAPA DE INTEGRACIÓN: LAB → REAL (Plan progresivo)

### Fase 1: "Ya funciona" (cambio mínimo)

**Sin modificar código de MultiCoach:**

| Componente | Status | Acción |
|---|---|---|
| Cargar org (MC_ORG) | ✅ | Pathway: organizaciones existe y mapea |
| Cargar coaches (DB.coaches) | ✅ | Pathway: usuarios + conteo en línea 1889 funciona |
| Cargar clientes (DB.clientes) | ✅ | Pathway: candidatos existe y mapea |
| Cargar citas (MC_CITAS) | ⚠️ | Si citas table existe, ya funciona |
| White-label (marca JSONB) | ✅ | Pathway: organizaciones.marca existe |
| Reasignar cliente | ✅ | Edge function asignar-cliente existe |

**Prerequisito:** Edge function `mi-red` debe estar deployada O fallback REST directo debe funcionar.

### Fase 2: "Datos faltantes" (1-2 columnas)

**Cambios en Pathway necesarios:**

| Campo MultiCoach | Tabla Pathway | Solución |
|---|---|---|
| cliente.prog | candidatos | Agregar columna `progreso TEXT` (Ej. 'onboarding', 'cv', 'carta', 'linkedin') |
| cliente.plan | candidatos | Agregar JSONB `estado` con {plan: 'pending'/'active', med: 'pending'/'active'} |
| cliente.med | candidatos | (Incluido en `estado` anterior) |
| coach.ret | coach_health_snapshots O usuarios.configuracion | Ya está en configuracion.retencion; mejor de snapshots |
| coach.servicios | usuarios.configuracion | Ya puede guardarse en JSONB; listo |

**Esfuerzo:** 2 nuevas columnas en candidatos (rollout sin downtime).

### Fase 3: "Optimizaciones" (queries, índices)

| Mejora | Hoy | Futuro |
|---|---|---|
| Conteo de clientes por coach | Calcula en app línea 1889 | Índice en coach_client_assignments (ya existe) |
| Filtro de coaches sin clientes | Filter en JS | Query con LEFT JOIN candidatos |
| Métrica de retención | manual | De coach_health_snapshots |
| Actividad reciente | desde updated_at | De sesiones_registro |

---

## 11. TABLA FINAL: QUÉ DEBE CAMBIAR (O NO)

### A: Cambios en Pathway (mínimos)

| Qué | Dónde | Por qué | Tipo |
|---|---|---|---|
| Columna `progreso` | candidatos | Necesaria para tracking de etapas | Schema |
| Columna `estado` (JSONB) | candidatos | Para plan/med/flags múltiples | Schema |
| Edge function `mi-red` (si no existe) | supabase/functions/mi-red | Acelera carga, bypasea RLS | Edge Function |
| Validación de owner en edge function | supabase/functions/mi-red | Seguridad: verificar que JWT pertenezca a org | Code |

### B: Cambios en MultiCoach (ninguno necesario)

**El código ya:** 
- ✅ Intenta `mi-red` primero
- ✅ Fallback a REST directo
- ✅ Mapea campos correctamente
- ✅ Renderiza maqueta si falla

**Qué debe ocurrir:** Cuando Pathway agregue columnas, mcMapCli automáticamente los leerá.

### C: NO cambiar

| Qué | Por qué |
|---|---|
| Eliminar multicoach-lab | Aún necesario para demos |
| Crear tabla multicoach_* | Usar organizaciones, usuarios, candidatos |
| Modificar RLS | Ya funciona; solo validar |
| Cambiar Edge function mi-red | Si no existe, crearla; si existe, no tocar |
| Modificar mcMapCoach/mcMapCli | Funciones de mapeo van bien |

---

## 12. DASHBOARD: ¿QUÉ DATOS ESTÁN LISTOS VS. QUÉ NECESITA CÁLCULO?

### KPIs que MultiCoach muestra hoy

| KPI | Dato necesario | ¿Disponible en Pathway? | Tipo | Acción |
|---|---|---|---|---|
| N° coaches | COUNT(usuarios WHERE org_id) | ✅ | Directo | Usar |
| N° clientes | COUNT(candidatos WHERE org_id) | ✅ | Directo | Usar |
| Coaches activos | COUNT(usuarios WHERE org_id + activo=true) | ✅ | Directo | Usar |
| Clientes activos | COUNT(candidatos WHERE org_id + activo=true) | ✅ | Directo | Usar |
| Capacidad restante | max_coaches - count(coaches) | ✅ | Cálculo | Usar |
| Capacidad clientes | max_clientes - count(clientes) | ✅ | Cálculo | Usar |
| Fecha vencimiento trial | organizaciones.fecha_fin_prueba | ✅ | Directo | Usar |
| Clientes sin coach | COUNT(candidatos WHERE coach_id IS NULL) | ✅ | Directo | Usar |
| Coaches sin clientes | Cálculo a partir de count | ✅ | Cálculo | Usar |

**Acceso inmediato:** Los 10 KPIs pueden calcularse desde organizaciones + usuarios + candidatos sin agregación nueva.

---

## 13. QUERIES REALES QUE MULTICOACH NECESITA HACTUALMENTE

### Query 1: Leer organización del owner
```sql
SELECT * FROM organizaciones WHERE id = owner.org_id LIMIT 1
-- O fallback si no hay owner.org_id:
SELECT * FROM organizaciones WHERE owner_email = owner.email LIMIT 1
```
✅ **Pathway tiene esto.** Fallback REST de multicoach lo hace en línea 1915-1916.

### Query 2: Leer coaches de la org
```sql
SELECT id, nombre, email, activo, foto_url, configuracion
FROM usuarios
WHERE org_id = org.id AND rol IN ('coach', 'owner')
ORDER BY nombre
```
✅ **Pathway tiene esto.** RLS permite leer usuarios de tu org (policy ownership).

### Query 3: Leer clientes de la org
```sql
SELECT id, nombre, email, activo, coach_id, semana_activa, foto_perfil, created_at, updated_at
FROM candidatos
WHERE org_id = org.id
ORDER BY created_at DESC
```
⚠️ **Pathway tiene esto.** RLS owner_reads_org_clients permite, pero puede devolver [] si está estricta. Edge function `mi-red` (SERVICE ROLE) bypasea.

### Query 4: Contar clientes por coach
```sql
SELECT coach_id, COUNT(*) as count
FROM coach_client_assignments
WHERE org_id = org.id AND estado = 'activa'
GROUP BY coach_id
```
✅ **Pathway tiene esto.** MultiCoach lo calcula en línea 1889. Mejor hacer en query.

### Query 5: Leer citas de la org
```sql
SELECT * FROM citas WHERE org_id = org.id AND fecha >= hoy ORDER BY fecha
```
⚠️ **Pathway: ¿existe tabla `citas`?** No documentada. Edge function menciona crear-cita-red. Asumir que existe.

---

## 14. DUPLICACIONES ENCONTRADAS

### Duplicación 1: `organizaciones` vs. `organizations` (legacy)

**Pathway tiene DOS tablas de org:**
- `organizaciones` (legacy, la que usa MultiCoach hoy)
- `organizations` (nueva, con owner_id UUID FK a auth.users)

**MultiCoach usa:** `organizaciones` (plan, max_coaches, max_clientes, marca, estado_sub, fecha_fin_prueba)

**Riesgos:**
- Si migran a `organizations`, MultiCoach se rompe
- Si mantienen dos, queries redundantes

**Recomendación (producto):** Consolidar en `organizaciones` O que MultiCoach prefiera `organizations` y deprecar organizaciones.

### Duplicación 2: `usuarios.configuracion.plan` vs. `organizaciones.plan`

**Hoy se guarda plan en dos lugares:**
- `organizaciones.plan` ('boutique', 'studio', 'pro')
- `usuarios.configuracion.plan` (cuando se convierte coach individual a owner)

**MultiCoach lee:** `organizaciones.plan`

**Riesgo:** Inconsistencia si se actualiza uno y no el otro.

**Recomendación:** Única fuente de verdad en `organizaciones.plan`.

---

## 15. GAPS REALES (Bloqueadores para integración)

### Gap 1: Edge Function `mi-red` NO EXISTE (¿?)

**Evidencia:** Línea 1905 intenta usarla; fallback comienza en línea 1910.

**Estado:** Si existe, oculta a MultiCoach. Si no, fallback REST lo cubre.

**Solución:** Confirmar estado de `mi-red`. Si no existe, crearla (10 líneas de código).

### Gap 2: Tabla `citas` NO DOCUMENTADA

**Usa:** edge function crear-cita-red (línea 1239)

**Multicoach la lee:** Línea 1876 intenta cargar MC_CITAS desde mi-red.

**¿Existe?** Probable sí, pero no en auditoría.

**Solución:** Confirmar schema de `citas`. Si falta org_id, agregarla.

### Gap 3: Campos del cliente (`progreso`, `plan`, `med`) NO EN PATHWAY

**Usa en MultiCoach:**
- `prog`: Etapa de onboarding ("Onboarding", "CV", "Carta", "LinkedIn")
- `plan`: Estado de si tiene plan ("pending", "active")
- `med`: Estado de mediciones ("pending", "active")

**¿Dónde guardar?**
- Hoy MultiCoach lo guarda en memory (DB.clientes) pero no persiste a Pathway
- No hay edición de estos campos en la UI de multicoach.html

**Decisión:** ¿Son estos campos reales o solo para demo? Si reales, agregar a candidatos. Si demo, ignorar.

**Recomendación:** Agregar `progreso` y `estado` (JSONB con plan/med/flags) a candidatos.

### Gap 4: Validación de permisos débil en edge functions

**Hoy:**
```javascript
// convertir-multicoach/admin-coach-op:
const isAdmin = email ILIKE admin OR auth_id = uid AND rol = 'admin'
// Pero NO valida:
//   ¿admin realmente pertenece a la org que está modificando?
//   ¿owner realmente es owner de su org?
```

**Riesgo:** Un owner podría, en teoría, leer datos de otra org via REST si RLS falla.

**Solución:** Validación en-band en mi-red + RLS estricto.

### Gap 5: Permisos de colaborador NO IMPLEMENTADOS

**Pathway tiene:** `usuarios.rol_en_org` ('owner', 'coach', 'colaborador', NULL)

**MultiCoach espera:** `tipo` ('coach', 'colaborador'), `permisos` (JSONB)

**¿Qué hace un colaborador?**
- No documentado en Pathway ni en MultiCoach
- MultiCoach muestra como "colaborador" pero no restringe funciones

**Solución (producto):** Definir qué puede hacer colaborador.

---

## 16. RUTA RECOMENDADA DE INTEGRACIÓN

### Timeline: Sin bloqueadores en desarrollo

**Paso 1 (Inmediato — sin cambios Pathway):**
1. Confirmar que mi-red existe o crear si no
2. Verificar que candidatos RLS permite owner leer (rls_candidatos_owner_reads_org_clients)
3. Test end-to-end: mcBoot() → mcLoadReal(owner) → Edge function mi-red O fallback REST
4. Maqueta del lab sigue funcionando para demos

**Paso 2 (Semana 1 — cambios schema mínimos):**
1. Agregar columna `progreso TEXT` a candidatos (default null, opcionalmente enum)
2. Agregar JSONB `estado` a candidatos (default '{}', encapsular {plan, med, ...})
3. Migración: INSERT candidatos hace rollout sin cortar (con default)
4. MultiCoach AÚN no usa estas columnas; solo sirven para futuro

**Paso 3 (Semana 2 — datos reales):**
1. Edge function `mi-red` lee nuevas columnas
2. MultiCoach mapea automáticamente (mcMapCli ya toma los campos que vea)
3. Test: Owner ve clientes con progreso/estado

**Paso 4 (Cuando sea necesario — lógica de negocio):**
1. Crear permiso de "colaborador" (qué puede hacer)
2. RLS policy para colaborador
3. MultiCoach lee `tipo` y aplica restricciones UI

---

## 17. CONCLUSIONES

### Síntesis

1. **MultiCoach ya lleva el código para leer de Pathway** (en línea 1906-1927).
2. **El "lab" es la maqueta demo, útil para marketing, mantener por ahora.**
3. **El mapa 1:1 existe:** Pathway organizaciones→MC_ORG, usuarios→DB.coaches, candidatos→DB.clientes.
4. **Gaps son mínimos:** 2 columnas en candidatos (progreso, estado JSONB).
5. **Permisos funcionan:** RLS existen; solo falta validación en edge functions.

### Cambios Pathway (prioritarios)

| Prioridad | Qué | Esfuerzo | Impacto |
|---|---|---|---|
| CRÍTICA | Edge function `mi-red` (crear si no existe) | 1 día | Acelera carga, bypasea RLS |
| ALTA | Verificar schema de `citas` (org_id?) | 1 hora | Necesario para cargar agenda |
| MEDIA | Columnas `progreso` + `estado` en candidatos | 1 día | Captura etapas de cliente |
| BAJA | Rol colaborador + permisos granulares | TBD | Futuro, no bloquea MVP |

### Cambios MultiCoach (ninguno necesario)

El código ya está listo. Solo espera que Pathway tenga los datos.

### Cambios Auth/RLS (validar)

- ✅ Policies existen
- ⚠️ Validación de owner en edge function débil
- ⚠️ RLS estricta puede devolver [] en fallback REST; mi-red (SERVICE ROLE) lo resuelve

---

**Documento entregado sin implementación. Listo para revisar con el equipo de producto.**
