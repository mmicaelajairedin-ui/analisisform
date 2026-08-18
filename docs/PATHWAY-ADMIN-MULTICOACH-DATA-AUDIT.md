# PATHWAY ADMIN → MULTICOACH: AUDITORÍA DE ARQUITECTURA DE DATOS

**Fecha:** Agosto 2026  
**Alcance:** Investigación técnica del sistema actual de Admin/Pathway y sus fuentes de datos, sin modificaciones.  
**Propósito:** Documentar exactamente cómo funciona Pathway Admin hoy para informar el desarrollo de MultiCoach.

---

## 1. EXECUTIVE SUMMARY

Pathway es un sistema **multi-tenant en transición** entre dos modelos de datos:

- **Modelo viejo (legado):** Tabla `organizaciones` con `owner_email` (TEXT)
- **Modelo nuevo (migraciones 001-107):** Tablas `organizations`, `organizations_billing`, `organization_branding` con `owner_id` (UUID FK a `auth.users`)

**El admin actual:**
- NO es una pantalla visible (no hay un `admin.html` dedicado)
- El panel-v2.html es el panel del **coach individual**
- El `multicoach.html` es el panel del **owner de una organización** (multicoach)
- Administración real: a través de **edge functions** que corren con SERVICE ROLE

**El modelo es jerárquico:**
```
Pathway Admin (rol='admin')
  ├─ puede crear/modificar coaches (crear-coach, admin-coach-op)
  ├─ puede crear/convertir multicoach (crear-multicoach, convertir-multicoach)
  └─ puede operar sobre cualquier organización

Multicoach Owner (rol='owner', org_id=su_org)
  ├─ ve sus coaches (usuarios con org_id y rol='coach')
  ├─ ve sus clientes (candidatos con org_id)
  └─ puede crear/asignar coaches, reasignar clientes

Coach independiente (rol='coach', org_id=NULL)
  └─ ve solo sus clientes (candidatos con coach_id=él)
```

---

## 2. ADMIN ACTUAL: ESTRUCTURA Y ACCESO

### 2.1 Archivos Principales

| Archivo | Función | Rol |
|---------|---------|-----|
| `panel-v2.html` | Panel del coach individual (legacy) | Coach individual |
| `multicoach.html` | Panel del owner multicoach | Owner (rol='owner') |
| `owner-dashboard-v3.html` | Panel de estadísticas (v3, deprecated) | Owner |
| `owner-coaches.html` | Listado de coaches (UI alternativa) | Owner |
| No existe `admin.html` dedicado | Admin usa edge functions | Admin (rol='admin') |

### 2.2 Acceso a Admin

**No hay un panel visual centralizado.** El admin de Pathway opera por:

1. **Edge functions con SERVICE ROLE** (bypasean RLS):
   - `admin-coach-op` — operaciones sobre coaches (extend_trial, mark_paid, set_plan, set_active, delete_coach, set_logo)
   - `crear-coach` — alta de coaches
   - `crear-multicoach` — alta de multicoach (create org + promote user)
   - `convertir-multicoach` — convertir coach individual → multicoach
   - `cambiar-plan-org` — cambiar plan de organización
   - `suspender-org` — suspender/reactivar organización
   - `remove-member-org` — remover coach de organización
   - `cambiar-owner` / `change-owner-org` — cambiar owner de organización

2. **Verificación de admin:**
   ```typescript
   // En cada edge function (admin-coach-op, crear-multicoach, etc.):
   // Valida JWT → extrae email/uid
   // Consulta: SELECT id FROM usuarios WHERE (email ILIKE... OR auth_id=...) AND rol='admin'
   // Si no encontrado → 403 (not_admin)
   ```

### 2.3 Identidad del Admin

**Dos vías de verificación** (porque el auth_id puede no estar vinculado en transición):

```typescript
// admin-coach-op.ts, línea ~63
async function isAdmin(email: string | null, uid: string | null): Promise<boolean> {
  const ors: string[] = [];
  if (email) ors.push(`email.ilike.${email}`);      // Login email (ej. mmicaela@gmail.com)
  if (uid) ors.push(`auth_id.eq.${uid}`);           // auth.users.id
  // Query: SELECT id FROM usuarios WHERE (email ILIKE... OR auth_id=...) AND rol='admin'
}
```

---

## 3. MODELO DE DATOS: ORGANIZACIONES

### 3.1 Tabla `organizaciones` (Modelo Legado)

**Creada en:** `supabase/migrations/organizaciones.sql`  
**Estado:** Activo, en transición a `organizations` nueva

```sql
CREATE TABLE organizaciones (
  id              UUID PRIMARY KEY,
  nombre          TEXT NOT NULL,
  owner_email     TEXT NOT NULL,              -- Email del dueño (TEXT, NO FK)
  plan            TEXT DEFAULT 'prueba',       -- prueba | red | red_pro
  nicho           TEXT,                        -- fitness | carrera | finanzas | multi
  marca           JSONB DEFAULT '{}',          -- White-label (logo, color, etc.)
  max_coaches     INT,                         -- Límite de coaches (NULL = ilimitado)
  max_clientes    INT,                         -- Límite de clientes
  estado_sub      TEXT DEFAULT 'prueba',       -- prueba | activa | vencida | inactiva
  fecha_fin_prueba DATE,                       -- Cuándo vence la prueba
  activo          BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- Índices:
CREATE INDEX idx_organizaciones_owner_email ON organizaciones(owner_email);
```

### 3.2 Tablas `organizations` (Modelo Nuevo)

**Creadas en:** `supabase/migrations/001-005_organizations*.sql`

#### `organizations`
```sql
CREATE TABLE organizations (
  id                  UUID PRIMARY KEY,
  owner_id            UUID NOT NULL REFERENCES auth.users(id),  -- FK a auth.users
  name                VARCHAR(255) NOT NULL,
  logo_emoji          CHAR(2),
  sector              VARCHAR(100),
  country             VARCHAR(50),
  timezone            VARCHAR(50) DEFAULT 'UTC',
  plan                VARCHAR(50) DEFAULT 'starter',  -- starter | pro | enterprise
  status              VARCHAR(50) DEFAULT 'active',    -- active | trial | suspended | cancelled
  stripe_customer_id  VARCHAR(255),
  stripe_subscription_id VARCHAR(255),
  brand_color         VARCHAR(7) DEFAULT '#8C7B80',
  contact_email       VARCHAR(255),
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);
```

#### `organizations_billing`
```sql
CREATE TABLE organizations_billing (
  id                  UUID PRIMARY KEY,
  org_id              UUID NOT NULL UNIQUE REFERENCES organizations(id),
  plan                VARCHAR(50) NOT NULL DEFAULT 'starter',
  price_usd           DECIMAL(10, 2),
  billing_interval    VARCHAR(10) DEFAULT 'month',
  subscription_started_at TIMESTAMPTZ,
  subscription_ended_at TIMESTAMPTZ,
  next_billing_date   DATE,
  coaches_used        INT DEFAULT 0,
  coaches_limit       INT DEFAULT 5,
  clients_used        INT DEFAULT 0,
  clients_limit       INT DEFAULT 50,
  storage_used_gb     DECIMAL(10, 2) DEFAULT 0,
  storage_limit_gb    INT DEFAULT 100,
  status              VARCHAR(50) DEFAULT 'active',  -- active | past_due | cancelled
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);
```

#### `organization_branding`
```sql
CREATE TABLE organization_branding (
  id              UUID PRIMARY KEY,
  org_id          UUID NOT NULL UNIQUE REFERENCES organizations(id),
  brand_name      VARCHAR(255),
  logo_emoji      CHAR(2),
  tagline         VARCHAR(255),
  primary_color   VARCHAR(7) DEFAULT '#8C7B80',
  secondary_color VARCHAR(7) DEFAULT '#D4CCCA',
  accent_color    VARCHAR(7) DEFAULT '#8C7B80',
  custom_domain   VARCHAR(255),
  favicon_emoji   CHAR(2),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);
```

### 3.3 Migración `0107_organizaciones_owner_id.sql`

**Propósito:** Agregar FK a `organizaciones.owner_id` sin romper compatibilidad

```sql
ALTER TABLE organizaciones ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES usuarios(id);
-- Migración de datos:
UPDATE organizaciones o
  SET owner_id = u.id
  FROM usuarios u
  WHERE u.email = o.owner_email AND o.owner_id IS NULL;
-- Resultado: ambos campos existen por ahora (transición)
```

**Estado:** `owner_email` se mantiene por compatibilidad; `owner_id` es la nueva fuente de verdad.

---

## 4. COACHES Y USUARIOS

### 4.1 Tabla `usuarios` (Extensión para MultiCoach)

**Base:** Tabla original de Pathway (auth, password_hash, etc.)  
**Extensiones (migraciones 002, 0101):**

```sql
-- Agregados en 002_usuarios_extend.sql:
ALTER TABLE usuarios ADD COLUMN org_id UUID REFERENCES organizaciones(id);
ALTER TABLE usuarios ADD COLUMN avatar CHAR(2);
ALTER TABLE usuarios ADD COLUMN especialidad VARCHAR(100);
ALTER TABLE usuarios ADD COLUMN last_login TIMESTAMPTZ;
ALTER TABLE usuarios ADD COLUMN capacity INT DEFAULT 10;

-- Agregado en 0101_usuarios_rol_en_org.sql:
ALTER TABLE usuarios ADD COLUMN rol_en_org TEXT;  -- owner | coach | colaborador | NULL
```

### 4.2 Campos Clave de `usuarios`

| Campo | Tipo | Significado |
|-------|------|-------------|
| `id` | UUID | PK (no el auth.users.id) |
| `auth_id` | UUID | FK a auth.users.id (JWT sub) |
| `email` | TEXT | Email del usuario |
| `rol` | TEXT | coach \| admin \| cliente (rol global) |
| `org_id` | UUID | FK a organizaciones.id (NULL = coach individual) |
| `rol_en_org` | TEXT | owner \| coach \| colaborador (rol dentro de org) |
| `activo` | BOOLEAN | Si puede entrar |
| `configuracion` | JSONB | Datos del coach (plan, fecha_fin_prueba, etc.) |

### 4.3 "Coach independiente" vs "Coach MultiCoach"

| Atributo | Coach Individual | Coach MultiCoach |
|----------|-----------------|-----------------|
| `org_id` | NULL | UUID (referencia a su org) |
| `rol` | 'coach' | 'coach' (si es miembro) o 'owner' (si es dueño) |
| `rol_en_org` | NULL | 'coach' (miembro) o 'owner' (dueño) |
| Clientes | candidatos.coach_id = él | candidatos.org_id = su org + coach_client_assignments |
| Visibilidad | Ve solo sus clientes | Puede ver clientes de su org (si owner) o asignados (si coach) |

---

## 5. CLIENTES Y ASIGNACIONES

### 5.1 Tabla `candidatos`

**Base:** Original de Pathway  
**Extensiones:**

```sql
-- Agregado en organizaciones.sql:
ALTER TABLE candidatos ADD COLUMN org_id UUID REFERENCES organizaciones(id);

-- Agregados en 004_candidatos_files.sql:
ALTER TABLE candidatos ADD COLUMN archivo_plan JSONB;
ALTER TABLE candidatos ADD COLUMN archivos_progreso JSONB;
ALTER TABLE candidatos ADD COLUMN archivos_sesion JSONB;
```

### 5.2 Tabla `coach_client_assignments` (Nueva)

**Creada en:** `supabase/migrations/0102_coach_client_assignments.sql`  
**Propósito:** Mapeo explícito de coach → cliente dentro de una org

```sql
CREATE TABLE coach_client_assignments (
  id              UUID PRIMARY KEY,
  org_id          UUID NOT NULL REFERENCES organizaciones(id),
  coach_id        UUID NOT NULL REFERENCES usuarios(id),
  client_id       UUID NOT NULL REFERENCES candidatos(id),
  estado          TEXT DEFAULT 'activa',   -- activa | pausada | cerrada
  assigned_at     TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ,
  UNIQUE(org_id, coach_id, client_id)
);
```

**Uso:** RLS policy valida que un coach puede ver un cliente solo si existe un assignment activo.

### 5.3 Relación Cliente-Coach

**Coach individual:**
```
candidatos.coach_id = coach.id
candidatos.org_id = NULL
```

**Coach MultiCoach:**
```
candidatos.org_id = org.id
coach_client_assignments: org_id, coach_id, client_id, estado='activa'
```

---

## 6. PLANES Y LÍMITES

### 6.1 Plans (Histórico)

En `crear-multicoach/index.ts` líneas 46-54:

```typescript
function planLimits(plan: string): { max_coaches: number | null; max_clientes: number | null } {
  if (plan === "pro") return { max_coaches: null, max_clientes: null };
  if (plan === "studio") return { max_coaches: 8, max_clientes: 120 };
  // boutique (default)
  return { max_coaches: 3, max_clientes: 45 };
}
```

| Plan | Max Coaches | Max Clientes | Precio (aprox.) |
|------|-------------|--------------|-----------------|
| **boutique** | 3 | 45 | $149/mes |
| **studio** | 8 | 120 | $249/mes |
| **pro** | ∞ | ∞ | $399+/mes |

### 6.2 Dónde se guardan los límites

En tabla `organizaciones` (legado):
```sql
max_coaches INT,    -- Tope de coaches
max_clientes INT    -- Tope de clientes
```

En tabla `organizations_billing` (nuevo):
```sql
coaches_limit INT DEFAULT 5,
clients_limit INT DEFAULT 50,
```

**Discrepancia:** No están sincronizadas. MultiCoach debe leer de `organizaciones` por ahora.

### 6.3 Estado de Suscripción

En `organizaciones.marca` (JSONB, dentro de `configuracion` en `usuarios`):

```typescript
// convertir-multicoach/index.ts
const marca: Record<string, unknown> = { 
  nombre: nombreRed,
  estado_sub: "prueba",           // trial
  fecha_fin_prueba: trialDate,    // YYYY-MM-DD
  plan: "boutique"                // plan actual
};
```

---

## 7. "CONVERTIR" COACH INDEPENDIENTE → MULTICOACH

### 7.1 Edge Function: `convertir-multicoach`

**Ubicación:** `/supabase/functions/convertir-multicoach/index.ts`  
**Método:** POST  
**Auth:** Admin (JWT verificado)

#### Input
```json
{
  "coach_id": "<UUID>",
  "plan": "boutique" | "studio" | "pro",
  "nombre_red": "Mi red de coaches",
  "dias": 14
}
```

#### Output (200 OK)
```json
{
  "ok": true,
  "org_id": "<UUID>",
  "plan": "boutique",
  "movidos": 45
}
```

#### Flujo (líneas 119-160)

1. **Valida admin:**
   - Extrae JWT, verifica que sea admin
   
2. **Lee el coach:**
   ```
   SELECT id, email, nombre, rol, org_id, configuracion, foto_url
   FROM usuarios WHERE id = coach_id
   ```
   - Falla si `rol !== 'coach'` (no es coach)
   - Falla si `rol === 'owner'` (ya es owner)

3. **Crea la organización:**
   ```
   INSERT INTO organizaciones (
     nombre, owner_email, owner_id, plan, nicho,
     max_coaches, max_clientes, estado_sub, fecha_fin_prueba,
     activo, marca
   )
   ```
   - `owner_email` = coach.email
   - `owner_id` = coach.id (FK a usuarios.id)
   - `marca` = copia los datos del coach (bio, logo, color, calendly, foto)
   - `estado_sub` = "prueba"
   - `fecha_fin_prueba` = hoy + dias (default 14)

4. **Promueve al coach a owner:**
   ```
   PATCH usuarios SET rol='owner', org_id=<nuevo_org_id>, 
                       configuracion={...plan, estado_sub, fecha_fin_prueba...}, 
                       activo=true
   WHERE id = coach_id
   ```

5. **Mueve sus clientes a la nueva org:**
   ```
   PATCH candidatos SET org_id=<nuevo_org_id>
   WHERE coach_id = coach_id
   ```
   - Los clientes mantienen `coach_id = el mismo coach`
   - Ahora pueden estar asignados a otros coaches via `coach_client_assignments`

6. **Envía email de bienvenida** (best-effort):
   - Llama a `/functions/v1/send-email`
   - Asunto: "Ahora sos multicoach en Pathway 🎉"

### 7.2 Cambios en la Configuración del Usuario

Cuando se convierte a multicoach, `usuarios.configuracion` se actualiza:

```typescript
const nc = { 
  ...cfg,                                      // mantiene lo anterior
  plan,                                        // "boutique" | "studio" | "pro"
  estado_sub: "prueba",
  fecha_fin_prueba: trialEnd.toISOString(),
  coach_type: nicho,                           // carrera | fitness | etc.
  es_multicoach: true,                         // nuevo flag
  convertido_por: adminEmail,                  // auditoría
};
```

---

## 8. EDGE FUNCTIONS: ADMIN Y MULTICOACH

### 8.1 Operaciones de Admin

#### `admin-coach-op` (POST)
**Propósito:** Operaciones sobre coaches sin chocar con RLS

| Op | Body | Efecto |
|----|----|--------|
| `extend_trial` | `dias: 30` | Extiende `fecha_fin_prueba` |
| `mark_paid` | — | Set `estado_sub='activa'`, limpia `fecha_fin_prueba` |
| `set_plan` | `plan: 'pro'` | Set `plan` en configuracion |
| `set_active` | `activo: true/false` | Activa/desactiva coach |
| `delete_coach` | `wipe: true/false` | Borra coach ± datos |
| `set_logo` | `logo_url: 'https://...'` | Sube logo (white-label) |

#### `crear-coach` (POST)
Crea un coach individual (rol='coach', org_id=NULL)

#### `crear-multicoach` (POST)
Crea un multicoach: org + user con rol='owner'

#### `cambiar-plan-org` (POST)
Cambia el plan de una organización existente

#### `suspender-org` (POST)
Suspende/desactiva una organización

#### `remove-member-org` (POST)
Quita un coach de una organización

#### `cambiar-owner` / `change-owner-org` (POST)
Cambia el dueño de una organización

### 8.2 Edge Functions para Owners

#### `load-org-clients` (POST)
Lee clientes de una org (verificando que el caller sea owner/coach de esa org)

```
POST /functions/v1/load-org-clients
Body: { org_id }
Response: { ok: true, data: candidatos[] }
```

#### `fetch-coach-detail` (GET)
Lee perfil + métricas + clientes asignados de un coach

```
GET /functions/v1/organization/{org_id}/coaches/{coach_id}
Headers: Authorization: Bearer <token>
Response: { coach, metrics, clients, activity, _meta }
```

#### `get-user-org` (GET/POST)
Extrae `org_id` del JWT sin que el cliente tenga que pasarlo

```
POST /functions/v1/get-user-org
Headers: Authorization: Bearer <token>
Response: { org_id, role }
```

#### `add-coach-to-org` (POST)
Suma un coach a una organización

#### `agregar-cliente-red` (POST)
Suma un cliente a una organización (respeta límite de max_clientes)

---

## 9. RLS Y PERMISOS

### 9.1 Policies en `organizaciones`

#### `rls_org_owner_reads_own` (0103_rls_organizations.sql)
```sql
CREATE POLICY "rls_org_owner_reads_own" ON organizaciones
  FOR SELECT TO authenticated
  USING (owner_email = (SELECT email FROM usuarios WHERE auth_id = auth.uid() LIMIT 1));
```

#### `rls_org_coach_reads_own`
```sql
USING (id = (SELECT org_id FROM usuarios WHERE auth_id = auth.uid() AND org_id IS NOT NULL LIMIT 1));
```

#### `rls_org_admin_reads_all`
```sql
USING (EXISTS (SELECT 1 FROM usuarios WHERE auth_id = auth.uid() AND rol = 'admin'));
```

### 9.2 Policies en `candidatos` (0105_rls_candidatos_org.sql)

1. **Cliente ve su propio registro:** `email = (SELECT email FROM usuarios...)`
2. **Coach ve clientes asignados:** Via `coach_client_assignments` con `estado='activa'`
3. **Owner ve todos los clientes de su org:** `org_id = (SELECT org_id FROM usuarios WHERE rol='owner'...)`
4. **Admin ve todos:** Siempre que `rol='admin'`

---

## 10. PANEL-V2.HTML: DATOS DEL COACH INDIVIDUAL

**Archivo:** `/home/user/analisisform/panel-v2.html` (~4500 líneas inline)

### 10.1 Lectura de Datos (Coach Individual)

**No hay edge functions especiales.** El panel usa:

- `POST /rest/v1/candidatos?coach_id=eq.{id}` — Lee sus clientes
- `POST /rest/v1/informes?coach_id=eq.{id}` — Lee sus informes
- `POST /rest/v1/cv_publicados?coach_id=eq.{id}` — Lee CVs publicados
- `POST /rest/v1/sesiones_registro?coach_id=eq.{id}` — Lee sesiones

**RLS lo protege:** Solo ve lo que pertenece a `coach_id=él` (o rol='admin' ve todo).

### 10.2 Escritura de Datos

Todos los PATCH/POST/DELETE pasan por la anon key con RLS. Si no pasa el filtro, retorna 0 filas.

---

## 11. MULTICOACH.HTML: DATOS DEL OWNER

**Archivo:** `/home/user/analisisform/multicoach.html` (~400+ líneas)

### 11.1 Estructura del Panel

```
Sidebar (180px, fijo):
  ├─ Logo + nombre org
  ├─ Navegación (Dashboard, Coaches, Clientes, Programas, Configuración)
  ├─ Selector de nicho (Fitness/Carrera/Finanzas)
  └─ Perfil + Logout

Main area:
  ├─ Topbar (Búsqueda, botón Crear, Avatar)
  ├─ Body:
  │   ├─ Scroll (contenido de la sección)
  │   └─ Community (columna derecha, collapsible)
  └─ Footer
```

### 11.2 Secciones (Vistas)

1. **Dashboard** — KPIs (coaches, clientes, programas), embudo de progreso, actividad
2. **Coaches** — Listado de coaches de la org, grid/tabla
3. **Clientes** — Listado de clientes de la org, grid/tabla, drag-drop para reasignar
4. **Programas** — Listado de programas activos
5. **Configuración** — Marca, branding, plan, etc.

### 11.3 APIs Llamadas

El multicoach.html **no está completamente implementado en JS inline.** Usa:

- Edge functions: `get-user-org`, `load-org-clients`, `fetch-coach-detail`
- REST API directo: `organizaciones`, `usuarios`, `candidatos`, `coach_client_assignments`

---

## 12. TABLA DE MAPEO: DATOS ADMIN ACTUAL

| Dato mostrado | Tabla/Fuente | Campo(s) | Cómo se obtiene | Edge Function |
|---|---|---|---|---|
| Organización (nombre) | `organizaciones` | `nombre` | SELECT | Ninguno (REST directo) |
| Owner (email) | `organizaciones` | `owner_email` | SELECT | Ninguno |
| Coaches en org | `usuarios` | WHERE `org_id=org.id` AND `rol='coach'` | SELECT | `add-coach-to-org` lo usa |
| Clientes en org | `candidatos` | WHERE `org_id=org.id` | SELECT | `load-org-clients` |
| Plan | `organizaciones.marca` (JSONB) | `plan` | Leer JSONB | Ninguno |
| Estado sub | `organizaciones.marca` (JSONB) | `estado_sub` | Leer JSONB | Ninguno |
| Coach independiente (id) | `usuarios` | WHERE `org_id IS NULL` AND `rol='coach'` | SELECT | Ninguno |
| Nº clientes coach indiv. | `candidatos` | COUNT WHERE `coach_id=coach.id` | SELECT | Ninguno |
| "Convertir" | — | — | Edge fn: convertir-multicoach | `convertir-multicoach` |
| Fecha vencimiento trial | `organizaciones.marca` (JSONB) | `fecha_fin_prueba` | Leer JSONB | Ninguno |

---

## 13. REUTILIZACIÓN RECOMENDADA PARA MULTICOACH

### Ya existe en Pathway y es reutilizable:

| Componente | Ubicación | Estado | Reutilizar |
|---|---|---|---|
| Tabla `organizaciones` | Supabase | Activo | ✅ Leer plan, límites, estado |
| Tabla `usuarios` + `org_id` | Supabase | Activo | ✅ Filtrar coaches por org |
| Tabla `candidatos` + `org_id` | Supabase | Activo | ✅ Filtrar clientes por org |
| Tabla `coach_client_assignments` | Supabase | Activo | ✅ Reutilizar para assignments |
| Tabla `programs` (nueva) | Supabase | Activo | ✅ Programas de coaching |
| Edge fn `load-org-clients` | Edge Functions | Activo | ✅ Cargar clientes org |
| Edge fn `fetch-coach-detail` | Edge Functions | Activo | ✅ Perfil de coach + métricas |
| Edge fn `admin-coach-op` | Edge Functions | Activo | ✅ Ops sobre coaches (admin) |
| Edge fn `crear-multicoach` | Edge Functions | Activo | ✅ Crear org + owner |
| Edge fn `convertir-multicoach` | Edge Functions | Activo | ✅ Convertir coach → owner |
| RLS policies `organizaciones` | Supabase | Activo | ✅ Proteger acceso por org |
| RLS policies `candidatos` | Supabase | Activo | ✅ Proteger clientes por org |

### Cosas que NO debemos duplicar:

- ❌ No crear otra tabla de `organizaciones`; la existente cubre todo
- ❌ No crear otro sistema de `org_id` en usuarios; ya existe
- ❌ No duplicar RLS; extender las policies existentes
- ❌ No crear otro lugar para guardar plan/limits; usar `organizaciones.marca` (JSONB) + `max_coaches`, `max_clientes`
- ❌ No reinventar `coach_client_assignments`; reutilizar como está

---

## 14. GAPS REALES QUE MULTICOACH NECESITA

### 14.1 Funcionalidad Faltante en Pathway Actual

1. **Panel de admin centralizado:**
   - Actualmente todo es edge functions + REST directo
   - MultiCoach necesita un dashboard para listar orgs, coaches, clientes

2. **Métricas agregadas:**
   - El `fetch-coach-detail` trae métricas de UN coach
   - MultiCoach necesita: coaches activos, clientes activos, programas completados, NPS promedio

3. **Auditoría de operaciones:**
   - `admin-coach-op` no loguea acciones (quién extendió trial, quién promovió a owner)
   - Existe `audit_logs` tabla pero no se usa

4. **Gestión de roles/permisos:**
   - `usuarios.rol_en_org` existe pero no se usa
   - No hay policy/lógica para "colaborador" (solo owner/coach)

5. **Pagos/Facturación:**
   - `organizations_billing` existe pero está vacía (legacy)
   - Stripe webhooks en `stripe-webhook` function pero no está claro si procesa multicoach

6. **Analytics:**
   - No hay endpoint para agregados por org (coaches, clientes, progreso)
   - `coach_metrics_daily`, `coach_health_snapshots` existen pero son por coach, no por org

---

## 15. TABLA FINAL: NECESIDADES MULTICOACH vs. PATHWAY

| Necesidad MultiCoach | Ya existe en Pathway | Fuente exacta | Reutilizar | Falta implementar |
|---|---|---|---|---|
| Organización | ✅ | `organizaciones` tabla | ✅ Leer | — |
| Owner de org | ✅ | `usuarios.org_id` + `rol_en_org='owner'` | ✅ Filtrar | Validar consistencia |
| Coaches de org | ✅ | `usuarios` WHERE `org_id` + `rol='coach'` | ✅ Leer | — |
| Clientes de org | ✅ | `candidatos` WHERE `org_id` | ✅ Leer | — |
| Assignments coach-cliente | ✅ | `coach_client_assignments` tabla | ✅ Reutilizar | — |
| Agenda/citas | ✅ | `citas` tabla + `org_id` | ✅ Leer | Extender si falta `org_id` |
| Programas | ✅ | `programs` tabla | ✅ Reutilizar | Validar si completo |
| Analytics | Parcial | `sesiones_registro`, `coach_metrics_daily` | Extender | Agregados por org |
| Plan | ✅ | `organizaciones.marca.plan` (JSONB) | ✅ Leer | — |
| Estado | ✅ | `organizaciones.marca.estado_sub` (JSONB) | ✅ Leer | — |
| Límites | ✅ | `organizaciones.max_coaches`, `max_clientes` | ✅ Validar | Sincronizar con `organizations_billing` |
| Convertir coach | ✅ | Edge fn `convertir-multicoach` | ✅ Usar | — |

---

## 16. CONCLUSIONES Y RECOMENDACIONES

### 16.1 Modelo de Datos

**Reutilizar el existente:** Las tablas y relaciones de Pathway cubren multicoach. No crear nuevas.

**Transición de datos:** Hay dos estructuras coexistiendo (`organizaciones` vs `organizations`). Pathway debe finalizar la migración antes de que MultiCoach la use.

**Owner de org:** Usar `usuarios.id` (no `auth.users.id`) como PK para mantener compatibilidad.

### 16.2 RLS y Seguridad

**RLS existente es funcional pero incompleto:**
- Policies existen para organizaciones/candidatos
- Pero no cubren todos los casos de edge functions con SERVICE ROLE

**MultiCoach debe:**
- Heredar las policies
- No crear permisos adicionales en edge functions (SERVICE ROLE bypassa RLS)
- Validar al level de lógica (quién llama, a qué org tiene acceso)

### 16.3 Edge Functions

**Reutilizables directamente:**
- `admin-coach-op` — operaciones sobre coaches
- `crear-multicoach` — crear org + owner
- `convertir-multicoach` — promoción de coach
- `load-org-clients` — listar clientes org
- `fetch-coach-detail` — perfil coach

**Necesitan extensión:**
- `fetch-coach-detail` → agregar métricas de org
- Crear `fetch-org-detail` → perfil + KPIs de organización

### 16.4 Componentes No Duplicar

1. `coach_client_assignments` — Usar como está
2. `organizations_billing` — Sincronizar con `organizaciones` o consolidar
3. `audit_logs` — Activar para operaciones de admin
4. `usuarios.rol_en_org` — Implementar permisos además de owner/coach

---

## APÉNDICE A: QUERIES SQL REALES

### Listar coaches de una org
```sql
SELECT id, nombre, email, especialidad, rol_en_org, last_login, capacity
FROM usuarios
WHERE org_id = '{org_id}' AND rol IN ('coach', 'owner')
ORDER BY nombre;
```

### Listar clientes de una org
```sql
SELECT id, nombre, email, coach_id, estado, created_at, foto_perfil, semana_activa
FROM candidatos
WHERE org_id = '{org_id}'
ORDER BY nombre;
```

### Contar clientes por coach
```sql
SELECT coach_id, COUNT(*) as clientes_activos
FROM coach_client_assignments
WHERE org_id = '{org_id}' AND estado = 'activa'
GROUP BY coach_id;
```

### Leer plan de org
```sql
SELECT marca->>'plan' as plan, 
       marca->>'estado_sub' as estado,
       max_coaches, max_clientes
FROM organizaciones
WHERE id = '{org_id}';
```

---

**Fin de auditoría.**
