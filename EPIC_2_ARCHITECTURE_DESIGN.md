# EPIC 2: Arquitectura de Integración MultiCoach × Pathway

**Fase:** Diseño (pre-implementación)  
**Objetivo:** Validar arquitectura sin escribir código  
**Audiencia:** Revisión de Micaela antes de proceder

---

## 1. Arquitectura de Integración

### Modelo de Dos Mundos Separados

```
┌─────────────────────────────────────────────────────────────┐
│                     SUPABASE PROJECT                        │
├─────────────────────────┬───────────────────────────────────┤
│   SCHEMA: public        │   SCHEMA: multicoach              │
│   (Pathway Legacy)      │   (MultiCoach New)                │
│                         │                                   │
│  • usuarios             │  • organizaciones                 │
│  • candidatos           │  • usuarios (con org_id)          │
│  • coach_client_...     │  • candidatos (con org_id)        │
│  • [otros]              │  • coach_client_assignments       │
│  (69 users, 37 clients) │  (test data + productivo)         │
│                         │                                   │
│  REGLA: READ-ONLY       │  REGLA: WRITE ALLOWED             │
│  (congelado)            │  (desarrollo libre)               │
└─────────────────────────┴───────────────────────────────────┘
```

### Capas de Aplicación

```
NIVEL 1: PRESENTACIÓN (Frontend)
├── index.html (Landing pública — ambos productos)
├── soy-coach.html (Marketing MultiCoach)
├── panel-v2.html (Coach individual — Pathway Legacy)
│   └─ Lee: public.usuarios, public.candidatos
│   └─ Escribe: public.* (best-effort chat, game points)
│
├── multicoach.html (Owner de red — MultiCoach New)
│   └─ Lee: multicoach.* (org, usuarios, candidatos, assignments)
│   └─ Escribe: multicoach.* (asignaciones, comunidad, etc)
│
└── cliente.html (Client portal — ambos)
    └─ Lee: (su perfil de public.* O multicoach.*, según org)
    └─ Escribe: multicoach.* (si es de empresa) O public.* (si legacy)

NIVEL 2: AUTENTICACIÓN
├── Supabase Auth (JWT sobre public.usuarios.auth_id)
│   └─ Legacy coaches: auth_id mapea a public.usuarios
│   └─ MultiCoach: auth_id mapea a multicoach.usuarios
│
└─ Policy: Cada app se loguea con su auth_id scope

NIVEL 3: DATOS
├── public.* (Read-only, congelado)
│   └─ Pathway en producción con clientes reales
│   └─ Cualquier escritura = riesgo de corrupción
│
└── multicoach.* (Write-allowed)
    └─ Datos de la red (org, coaches, clients asignados)
    └─ Datos compartidos (comunidad, recursos, chat)
```

---

## 2. Componentes y Acceso a Datos

### 2.1 ¿Qué Componentes Leen `public.*`?

**Código que SOLO lee (SELECT):**

| Componente | Lectura | Escritura | Razón |
|-----------|---------|-----------|-------|
| **panel-v2.html** | public.usuarios, public.candidatos | public.mensajes, public.usuarios (cols: game_pts, last_seen) | Coach legacy — sus clientes están en public |
| **cliente.html** | Ambos (según org_id) | multicoach.* (si empresa) | Portal unificado para legacy + new |
| **login.html** | public.usuarios (auth) | Ninguno | Autenticación legacy |
| **index.html** | public.candidatos (feed dummy) | Ninguno | Marketing, datos públicos |
| **Edge Function: generar-informe** | public.candidatos (read test data) | Ninguno | IA análisis, solo lectura |

**Acceso crítico:**
- `panel-v2.html`: Depende de `public.usuarios` + `public.candidatos` para que los 69 coaches legacy vean sus clientes
- `cliente.html`: Debe leer AMBOS schemas según contexto (legacy vs. enterprise)

**RIESGO CRÍTICO:** Si `public.candidatos` se corrompe → todos los 37 clientes legacy pierden acceso.

---

### 2.2 ¿Qué Componentes Escriben SOLO en `multicoach.*`?

**Código que escribe:**

| Componente | Escribe en | Nunca Toca | Razón |
|-----------|-----------|-----------|-------|
| **multicoach.html** | multicoach.usuarios, multicoach.candidatos, multicoach.coach_client_assignments, multicoach.* | public.* | Owner de red — su universo es multicoach |
| **Edge Fn: crear-coach** (legacy path) | public.usuarios | multicoach.* | Legacy flow, 69 coaches ya en public |
| **Edge Fn: crear-coach** (multicoach path) | multicoach.usuarios + multicoach.organizaciones | public.* | New flow, crea dentro de la org |
| **Edge Fn: mensaje-red** | multicoach.mensajes_owner_coach | public.* | Chat de red, solo multicoach |
| **Edge Fn: canal-red** | multicoach.mensajes_red_canal | public.* | Comunidad, solo multicoach |
| **cliente.html** (si enterprise) | multicoach.candidatos (su perfil) | public.* | Client de empresa, datos en multicoach |
| **panel-v2.html** (nuevo: heartbeat) | public.usuarios (cols: last_seen, game_pts) | multicoach.* | Legacy coach, best-effort tracking |

**Nota:** `panel-v2.html` writes ONLY 2 columnas a `public.usuarios` (last_seen, game_pts) via best-effort. Si fallan (403 RLS), no rompe nada.

---

## 3. Separación: Cómo Evitar Afectar Pathway

### Principio de No-Mezcla

```
REGLA 1: `public.*` es WRITE-PROTECTED
├─ Solo lectura de panel-v2, login, cliente (legacy)
├─ Escrituras MÍNIMAS: game_pts, last_seen (best-effort)
└─ NUNCA: ALTER, DROP, TRUNCATE, batch INSERT en public

REGLA 2: `multicoach.*` es LIBRE para escritura
├─ Owner del panel multicoach.html puede crear/editar coaches, clientes
├─ Edge functions escriben en multicoach.*
└─ NUNCA: tocar public.* desde multicoach

REGLA 3: Login determina schema
├─ auth_id en public.usuarios → acceso a public.* (legacy coach)
├─ auth_id en multicoach.usuarios → acceso a multicoach.* (owner/coach enterprise)
└─ client.html: ¿dónde está el auth_id? → lee ese schema
```

### Guardrails Anti-Corrupción

**Nivel 1: RLS (Base de datos)**
```
- public.*: policies permiten lectura anon/authenticated
  (escritura solo a 2 columnas específicas via GRANT)
- multicoach.*: policies filtran por org_id + auth_id
  (coach solo ve su org, owner solo su org)
```

**Nivel 2: Código (Frontend + Edge)**
```
- multicoach.html: SIEMPRE filtra por MY.org_id
  Ejemplo: SELECT * FROM multicoach.candidatos WHERE org_id = MY.org_id
  
- panel-v2.html: SIEMPRE usa coachGuard() para legacy
  Ejemplo: PATCH candidatos?id=eq.UUID&coach_id=eq.ME.id
  
- Edge functions: Valida auth_id antes de escribir
  Ejemplo: if (auth.uid() !== user.auth_id) throw "Unauthorized"
```

**Nivel 3: Migraciones (Estructura)**
```
- Migrations que tocan public.* → SOLO lectores/índices
  (jamás schema changes que rompan existing apps)
  
- Migrations que crean multicoach.* → aditivas, nunca rompen existentes
  (greenfield development, cero retrocompatibilidad)
  
- Política: 2-approvers antes de ANY migration a public.*
```

---

## 4. Flujos de Usuario y Datos

### Diagrama Completo: Owner → MultiCoach

```
┌─ MICAELA (Admin) da de alta OWNER
│
├─→ Crea org en multicoach.organizaciones
│   (id, nombre, plan, estado_sub, fecha_fin_prueba)
│
├─→ Crea owner en multicoach.usuarios
│   (id, auth_id, email, rol='owner', org_id)
│
└─→ Owner se loguea → panel multicoach.html
    │
    ├─ JWT: auth_id matching multicoach.usuarios.auth_id
    │
    ├─ Dashboard: VE su org (1 org)
    │  └─ multicoach.html queries:
    │     SELECT * FROM multicoach.organizaciones
    │     WHERE id = JWT.org_id (de multicoach.usuarios)
    │
    ├─ VE sus coaches (solo de su org)
    │  └─ SELECT * FROM multicoach.usuarios
    │     WHERE org_id = JWT.org_id AND rol = 'coach'
    │
    ├─ VE sus clientes (solo de su org, asignados)
    │  └─ SELECT * FROM multicoach.candidatos
    │     WHERE org_id = JWT.org_id
    │
    ├─ Puede ASIGNAR cliente a coach
    │  └─ INSERT INTO multicoach.coach_client_assignments
    │     (coach_id, client_id, org_id, estado)
    │
    └─ Puede CREAR comunidad (avisos, revista)
       └─ INSERT INTO multicoach.empresa_revista
          (org_id, titulo, contenido, ...)
```

### Diagrama: Coach Legacy → panel-v2.html

```
┌─ Coach LEGACY (69 en producción) se loguea
│
├─ JWT: auth_id matching public.usuarios.auth_id
│
├─ Dashboard: VE sus clientes
│  └─ panel-v2.html queries:
│     SELECT * FROM public.candidatos
│     WHERE coach_id = public.usuarios.id (suyo)
│
├─ Puede editar cliente
│  └─ PATCH public.candidatos?id=eq.{uuid}&coach_id=eq.{su_id}
│
├─ Heartbeat: Actualiza last_seen (best-effort)
│  └─ PATCH public.usuarios
│     SET last_seen = now()
│     WHERE id = (su id) — falla silenciosamente si 403
│
└─ Chat: Escribe en public.mensajes_admin_coach
   └─ INSERT (edge function valida auth_id)
```

### Diagrama: Coach Enterprise → multicoach + panel-v2

```
┌─ Coach ENTERPRISE (dentro de una red) se loguea
│
├─ JWT: auth_id matching multicoach.usuarios.auth_id
│
├─ Dashboard: VE solo sus clientes asignados
│  └─ multicoach.html queries:
│     SELECT * FROM multicoach.candidatos c
│     WHERE c.id IN (
│       SELECT client_id FROM multicoach.coach_client_assignments
│       WHERE coach_id = multicoach.usuarios.id (suyo)
│     )
│
├─ Puede editar su cliente (en multicoach.candidatos)
│  └─ PATCH multicoach.candidatos?...
│
├─ Ve comunidad de su empresa (read-only)
│  └─ SELECT * FROM multicoach.empresa_revista
│     WHERE org_id = (su org_id)
│
└─ Chat con owner: 1-a-1 en multicoach.mensajes_owner_coach
   └─ VE en su bandeja de panel-v2 como hilo "Dueño de tu red"
```

### Diagrama: Cliente → cliente.html (Legacy vs Enterprise)

```
┌─ Cliente LEGACY
│  └─ JWT: public.candidatos.auth_id
│     │
│     ├─ Ve su perfil (public.candidatos)
│     ├─ Ve su coach (public.usuarios, coach_id join)
│     ├─ Ve sesiones de panel-v2 (shared)
│     └─ Ve recursos legacy (public tables)
│
└─ Cliente ENTERPRISE
   └─ JWT: multicoach.candidatos.auth_id
      │
      ├─ Ve su perfil (multicoach.candidatos)
      ├─ Ve su coach (multicoach.usuarios, coach_id join)
      ├─ Ve comunidad de la empresa (multicoach.empresa_revista)
      ├─ Ve sesiones (edge function, compartidas)
      └─ Ve recursos de su coach + de la empresa
```

---

## 5. Matriz de Acceso a Datos

| Actor | Lee public.* | Escribe public.* | Lee multicoach.* | Escribe multicoach.* | Notas |
|-------|--------------|------------------|------------------|----------------------|-------|
| Owner Legacy | NO | NO | NO | NO | No existe en Pathway |
| Coach Legacy | ✅ (candidatos, usuarios) | ⚠️ (game_pts, last_seen only) | NO | NO | 69 en producción |
| Coach Enterprise | NO | NO | ✅ (filtered by org) | ✅ (assigned clients only) | Nueva red |
| Client Legacy | ✅ (su perfil) | NO | NO | NO | Lee public.candidatos |
| Client Enterprise | NO | NO | ✅ (su perfil) | NO | Lee multicoach.candidatos |
| Admin Micaela | ✅ | NO (manual scripts) | ✅ | ✅ (provisioning) | Acceso directo para admin |

---

## 6. Riesgos y Mitigaciones

### RIESGO 1: Corrupción de `public.candidatos` (CRÍTICO)

**Escenario:** Bug en multicoach.html escribe accidentalmente a public.candidatos

**Impacto:** 
- 37 clientes legacy pierden acceso
- panel-v2.html rompe para 69 coaches
- Pathway down

**Mitigación:**
- ✅ RLS policies: multicoach roles NO TIENEN permiso en public.*
- ✅ Código: multicoach.html NUNCA importa public.* en queries
- ✅ Audit: Trigger en public.* que alerta si se escribe desde multicoach.* (anómalo)
- ✅ Backup: Snapshots automáticas cada 6 horas

**Verificación:** 
- Test: Intentar INSERT a public.* desde multicoach auth_id → debe fallar con 403
- Monitoring: Alert si COUNT(*) de public.candidatos/usuarios cambia

---

### RIESGO 2: RLS Bypass vía SQL Editor

**Escenario:** Usuario con SQL Editor access intenta SELECT * sin filtro en multicoach.candidatos

**Impacto:**
- Ver clientes de otra org (fuga de privacidad)
- Modificar datos de otra org (no posible si RLS está bien)

**Mitigación:**
- ✅ RLS policies: USING filters por (auth.uid() IN (...) AND org_id = MY.org_id)
- ✅ SQL Editor: Restricted role (read-only, específicas tablas)
- ✅ Audit logs: Cada query en SQL Editor se registra + requiere approval para datos de prod

---

### RIESGO 3: Coach Legacy intenta escribir en `multicoach.*`

**Escenario:** Bug en panel-v2 intenta PATCH a multicoach.candidatos con legacy JWT

**Impacto:**
- 403 Forbidden (esperado) — sin impacto
- O: data corruption si RLS está roto

**Mitigación:**
- ✅ RLS: INSERT/UPDATE/DELETE denegado sin matching org_id
- ✅ Code review: panel-v2 NUNCA abierto a multicoach.* queries
- ✅ Test: RLS validation script (EPIC 1.5) prueba esto cada release

---

### RIESGO 4: JWT Leak / Impersonation

**Escenario:** Auth_id de coach1 se filtra; alguien lo usa para loguear

**Impacto:**
- Acceso como coach1 a multicoach.candidatos (si ese coach está en org)
- O: Acceso como legacy coach a public.candidatos

**Mitigación:**
- ✅ JWT expiration: 1 hora (Supabase default)
- ✅ Refresh tokens: Rotado cada 7 días
- ✅ HTTPS-only: Cookies no accesibles via JS (HttpOnly)
- ✅ CSP headers: Prevenir XSS que robe token
- ✅ Monitoring: Alert si un auth_id loguea desde 2 IPs en < 1 min

---

### RIESGO 5: Migración Accidental Rompe `public.*`

**Escenario:** Developer ejecuta migration que ALTER TABLE public.usuarios DROP COLUMN...

**Impacto:**
- panel-v2.html falla (no encuentra la columna)
- 69 coaches offline
- Pathway down

**Mitigación:**
- ✅ Policy: NO migrations a public.* sin 2-approver review
- ✅ Code: Migrations nuevas SIEMPRE crean multicoach.*, NUNCA tocan public
- ✅ Pre-deploy: Script valida que public.* schema matches expected (smoke test)
- ✅ Approval gate: Merge bloqueado hasta migration aprobada

---

### RIESGO 6: MultiCoach Owner accede otro Owner's Data

**Escenario:** Owner de org A intenta ver org B's clientes

**Impacto:**
- Multi-tenant fuga de datos

**Mitigación:**
- ✅ RLS: Candidatos filtrados por (org_id = auth.user's org_id)
- ✅ Code: multicoach.html SIEMPRE filtra WHERE org_id = MY.org_id
- ✅ Test: EPIC 1.5 valida esto; parte del RLS test suite
- ✅ Audit: Cada query a multicoach.candidatos se registra

---

### RIESGO 7: Edge Functions Write Sin Validación

**Escenario:** Edge function `mensaje-red` no valida auth_id, cualquiera escribe

**Impacto:**
- Spam/flood en mensajes de la red
- O: Inyección de datos falsos

**Mitigación:**
- ✅ Code: Todas las edge functions validan `auth.uid()`
- ✅ RLS: INSERT policies requieren org_id = auth.user's org
- ✅ Testing: Unit tests de edge functions validan validación
- ✅ Audit: Logs de cada INSERT/UPDATE/DELETE vía función

---

## 7. Checklist Antes de EPIC 2 Implementación

- [ ] Arquitectura revisada por Micaela
- [ ] Riesgos entendidos y mitigaciones aceptadas
- [ ] RLS policies validadas en QA (✅ EPIC 1.5)
- [ ] Pathway en producción considerado "congelado" (✅ BD_FREEZE_POLICY)
- [ ] Test data en multicoach.* está limpio (✅ consolidado en 1 org)
- [ ] Decisión: ¿Mantener separadas las UI o fusionarlas?
  - [ ] Opción A: 3 UIs separadas (multicoach.html, panel-v2.html, cliente.html)
  - [ ] Opción B: UI unificada que detecta org_id y cambia flujo
- [ ] Backups automáticos de public.* en lugar (✅ Supabase Cloud)
- [ ] Monitoring/alerts para public.* escrituras activos

---

## 8. Decisión Pendiente: Arquitectura UI

### Opción A: UIs Separadas (Hoy)
```
multicoach.html  ← Owner de red
panel-v2.html    ← Coach individual (legacy)
cliente.html     ← Client (universal, pero queries distintas)
```
**Ventajas:** Foco, control, fácil mantener separados  
**Desventajas:** Code duplication, confuso para user

### Opción B: UI Unificada (Futuro)
```
panel-unificado.html
  if (org_id) {
    // MultiCoach owner view
  } else {
    // Legacy coach view (public.*)
  }
```
**Ventajas:** Single entry point, consistent UX  
**Desventajas:** Complejidad, riesgo de crosstalk

**Recomendación:** Empezar con A (separadas), migrar a B si necesario.

---

**Próximo paso:** Revisión de Micaela. Una vez aprobada esta arquitectura, proceder a EPIC 2.1 (Implementación del panel MultiCoach).
