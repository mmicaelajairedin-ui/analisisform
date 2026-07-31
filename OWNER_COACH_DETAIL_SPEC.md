# Backend Integration Spec: owner-coach-detail.html

**Purpose:** Detailed coach profile, client management, metrics, and activity  
**Status:** Frontend complete (mock data), ready for backend integration  
**Frontend File:** `multicoach/pages/owner-coach-detail.html` (167 lines HTML + 160 lines JS)  
**No structural changes needed** when connecting to real backend  

---

## 1. Page Structure & Data Flow

### 1.1 Layout Sections

```
┌─ Header (Coach Identity) ──────────────────────────────────┐
│ Avatar | Name | Specialty | Email | Joined Date              │
└────────────────────────────────────────────────────────────┘

┌─ Main Content (2-column) ────────────────────────────────┐
│ ┌─ Tabs Panel ─────────┐  ┌─ Sidebar Cards ─────────────┐ │
│ │ • Clientes (list)    │  │ • Estado Actual             │ │
│ │ • Métricas (grid)    │  │ • Performance               │ │
│ │ • Actividad (TL)     │  │ • Sesiones                  │ │
│ └──────────────────────┘  └─────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Data Dependencies

**Loaded on page load (line 454-464):**
1. Get `coachId` from URL query param
2. Fetch coach profile
3. Fetch assigned clients
4. Fetch metrics aggregations
5. Fetch activity timeline
6. Render all sections

---

## 2. Data Model

### 2.1 Coach Profile Entity

**Source:** Pathway `usuarios` table (extended with org_id)  
**Usage:** Header + sidebar "Estado Actual" + all tabs

| Field | Type | Source | MW/MultiCoach | Required | Notes |
|-------|------|--------|---|---|---|
| `id` | UUID | usuarios.id | Pathway | ✅ | Coach ID (URL param) |
| `name` | string | usuarios.nombre | Pathway | ✅ | Full name |
| `email` | string | usuarios.email | Pathway | ✅ | Work email |
| `avatar` | emoji/string | usuarios.avatar (NEW) | Pathway | ✅ | 1 emoji or initials |
| `specialty` | string | usuarios.especialidad (NEW) | Pathway | ✅ | E.g., "Tech Leadership" |
| `joinedAt` | ISO8601 | usuarios.created_at | Pathway | ✅ | Account creation date |
| `status` | enum | usuarios.estado_sub | Pathway | ✅ | active \| inactive \| paused |
| `lastActive` | ISO8601 | usuarios.last_login (NEW) | Pathway | ✅ | Last session timestamp |
| `clientsAssigned` | int | coach_client_assignments COUNT | MultiCoach | ✅ | Number of active client assignments |
| `capacity` | int | usuarios.capacity (NEW) | MultiCoach | ✅ | Max clients allowed |
| `org_id` | UUID | usuarios.org_id | MultiCoach | ✅ | Organization foreign key |

**Migration Notes (Pathway → MultiCoach):**
- ✅ `usuarios.id`, `nombre`, `email`, `created_at`, `estado_sub` already exist
- 🆕 Add columns: `avatar` (CHAR 2), `especialidad` (VARCHAR 100), `last_login` (TIMESTAMPTZ), `capacity` (INT DEFAULT 10)
- 🆕 Create `coach_client_assignments` table to replace loose coachId references

---

### 2.2 Metrics Aggregation Entity

**Source:** Joins of `usuarios`, `sesiones_registro`, `candidatos`, `informes`  
**Usage:** Sidebar "Performance" + Métricas tab

| Field | Type | Calculation | Source | Notes |
|-------|------|---|---|---|
| `nps` | float (1-5) | AVG(sesiones_registro.nps_coach) WHERE coach_id | Pathway | 0.1 precision |
| `retentionRate` | int (%) | COUNT(DISTINCT c.id WHERE status='active') / COUNT(DISTINCT c.id) | Pathway | Active clients / all clients |
| `completionRate` | int (%) | COUNT(i.id WHERE status='completed') / COUNT(i.id) | Pathway | Completed programs / total |
| `avgDuration` | int (minutes) | AVG(sesiones_registro.duracion) | Pathway | Rounded to nearest minute |
| `sessionCount` | int | COUNT(sesiones_registro.id) WHERE coach_id | Pathway | Total sessions ever |
| `totalProgramsCompleted` | int | COUNT(informes.id) WHERE status='completed' | Pathway | Programs brought to completion |
| `utilizationPercent` | int (%) | (clientsAssigned / capacity) * 100 | MultiCoach | Calculated from assignments |

**Aggregation Edge Function:** `fetch-coach-metrics`

```sql
SELECT 
  u.id,
  ROUND(AVG(sr.nps_coach)::numeric, 1)::float AS nps,
  ROUND(100.0 * COUNT(DISTINCT c.id FILTER (WHERE c.status = 'active')) 
        / NULLIF(COUNT(DISTINCT c.id), 0))::int AS retentionRate,
  ROUND(100.0 * COUNT(DISTINCT i.id FILTER (WHERE i.status = 'completado'))
        / NULLIF(COUNT(DISTINCT i.id), 0))::int AS completionRate,
  ROUND(AVG(sr.duracion))::int AS avgDuration,
  COUNT(sr.id) AS sessionCount,
  COUNT(DISTINCT i.id FILTER (WHERE i.status = 'completado')) AS totalProgramsCompleted
FROM usuarios u
LEFT JOIN sesiones_registro sr ON u.id = sr.coach_id
LEFT JOIN candidatos c ON u.id = c.coach_id
LEFT JOIN informes i ON u.id = i.coach_id
WHERE u.id = $1 AND u.org_id = $2
GROUP BY u.id;
```

---

### 2.3 Client Assignment Entity

**Source:** `coach_client_assignments` (NEW, explicit mapping)  
**Usage:** Clientes tab (list of assigned clients)

| Field | Type | Source | Relationship |
|-------|------|--------|---|
| `id` | UUID | PK | - |
| `coach_id` | UUID | FK → usuarios | Coach profile link |
| `client_id` | UUID | FK → candidatos | Client from Pathway |
| `org_id` | UUID | FK → organizations | Multi-tenant partition |
| `status` | enum | active \| paused \| completed | Assignment state |
| `assigned_at` | TIMESTAMPTZ | Timestamp | When assignment created |

**Relationship:**
- 1 Coach → many Clients (1:N)
- Each `coach_id` filters by `org_id` (prevent cross-org access)

---

### 2.4 Activity Timeline Entity

**Source:** Synthetic events from `sesiones_registro` + `coach_client_assignments` + `candidatos` status changes  
**Usage:** Actividad tab

| Field | Type | Example |
|-------|------|---------|
| `event_id` | UUID | Generated or from audit log |
| `coach_id` | UUID | Links to coach |
| `event_type` | enum | session_completed \| client_assigned \| program_completed \| onboarding_done |
| `description` | string | "Completó sesión con Juan Pérez" |
| `created_at` | ISO8601 | Timestamp |
| `related_client_id` | UUID | NULL if not client-specific |
| `related_resource` | JSON | { type: "sesion", id: "..." } or { type: "programa", id: "..." } |

**Event Types & Sources:**
- `session_completed`: From `sesiones_registro` WHERE status='completado' (most recent N=10)
- `client_assigned`: From `coach_client_assignments` created_at (recent assignments)
- `program_completed`: From `informes` WHERE status='completado'
- `onboarding_done`: From audit logs / `usuarios.created_at` (once)

---

## 3. API Endpoints

### 3.1 Main Endpoint: Get Coach Detail

**Endpoint:**
```
GET /api/organization/{org_id}/coaches/{coach_id}
```

**Path Parameters:**
- `org_id`: UUID (extracted from JWT, validated)
- `coach_id`: UUID (from URL query param, validated against org_id)

**Query Parameters:**
- `include=clients,metrics,activity` (optional, default: all)

**Request:**
```http
GET /api/organization/org-001/coaches/coach-001
Authorization: Bearer <jwt_token>
```

**Response (200 OK):**
```json
{
  "coach": {
    "id": "coach-001",
    "name": "María García",
    "email": "maria@acmecorp.com",
    "avatar": "👩‍💼",
    "specialty": "Tech Leadership",
    "status": "active",
    "joinedAt": "2024-01-15T00:00:00Z",
    "lastActive": "2024-07-30T14:30:00Z",
    "clientsAssigned": 8,
    "capacity": 10,
    "org_id": "org-001"
  },
  "metrics": {
    "nps": 4.8,
    "retentionRate": 95,
    "completionRate": 92,
    "avgDuration": 28,
    "sessionCount": 156,
    "totalProgramsCompleted": 24,
    "utilizationPercent": 80
  },
  "clients": [
    {
      "id": "client-001",
      "name": "Juan Pérez",
      "avatar": "👨‍💰",
      "role": "Ingeniero",
      "sector": "Tech",
      "program": "Semana 3",
      "progress": 75,
      "status": "active"
    },
    ...
  ],
  "activity": [
    {
      "id": "act-001",
      "type": "session_completed",
      "description": "Completó sesión con Juan Pérez",
      "created_at": "2024-07-30T14:30:00Z",
      "related_client_id": "client-001"
    },
    ...
  ]
}
```

**Error Responses:**
- `401 Unauthorized`: Invalid or expired JWT
- `403 Forbidden`: User not in organization OR coach not in organization
- `404 Not Found`: Coach does not exist in this org

**RLS Verification:**
```sql
-- Supabase RLS checks (automatic):
-- 1. user.org_id = request.org_id (from JWT)
-- 2. coach.org_id = request.org_id (before returning)
-- 3. Password_hash excluded from response
```

---

### 3.2 Update Coach Status (Optional, for "Editar" button)

**Endpoint:**
```
PATCH /api/organization/{org_id}/coaches/{coach_id}
```

**Request Body:**
```json
{
  "status": "active" | "inactive" | "paused",
  "capacity": 10
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "coach": { ... (updated coach object) }
}
```

**Permissions:**
- Only `role = 'owner'` or `role = 'admin'` can PATCH
- RLS prevents updating coach not in user's org

---

### 3.3 Reassign Client to Another Coach (Optional, implicit in Clientes tab)

**Endpoint:**
```
PATCH /api/organization/{org_id}/coach-assignments/{assignment_id}
```

**Request Body:**
```json
{
  "coach_id": "coach-002",
  "reason": "Client requested change"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "assignment": {
    "id": "assign-001",
    "coach_id": "coach-002",
    "client_id": "client-001",
    "status": "active",
    "assigned_at": "2024-07-30T14:30:00Z"
  },
  "auditLog": {
    "event_type": "client_reassigned",
    "from_coach": "coach-001",
    "to_coach": "coach-002",
    "timestamp": "2024-07-30T14:30:00Z"
  }
}
```

---

## 4. Frontend Integration Points

### 4.1 Header Section (Lines 336, 471-482)

**Current Code:**
```javascript
const headerHtml = `
  <div class="coach-avatar-large">${currentCoach.avatar}</div>
  <div class="coach-detail-info">
    <h1>${escapeHtml(currentCoach.name)}</h1>
    <p>${escapeHtml(currentCoach.specialty)}</p>
    <div class="coach-detail-meta">
      <span>${currentCoach.email}</span>
      <span>•</span>
      <span>Miembro desde ${formatDate(currentCoach.joinedAt)}</span>
    </div>
  </div>
`;
```

**Data Required:**
- `currentCoach.avatar` → coach.avatar
- `currentCoach.name` → coach.name
- `currentCoach.specialty` → coach.specialty
- `currentCoach.email` → coach.email
- `currentCoach.joinedAt` → coach.joinedAt

**No changes needed.** Response JSON maps 1:1 to mock data structure.

---

### 4.2 Sidebar "Estado Actual" (Lines 385-404)

**Current Code:**
```javascript
document.getElementById('statusValue').textContent = getStatusLabel(currentCoach.status);
document.getElementById('utilizationValue').textContent = `${getCoachUtilization(currentCoach)}%`;
document.getElementById('lastActiveValue').textContent = daysAgo(currentCoach.lastActive);
document.getElementById('joinedValue').textContent = formatDateShort(currentCoach.joinedAt);
```

**Data Required:**
- `currentCoach.status` → coach.status
- `currentCoach.clientsAssigned`, `capacity` → metrics.utilizationPercent
- `currentCoach.lastActive` → coach.lastActive
- `currentCoach.joinedAt` → coach.joinedAt

**Changes:**
- Remove call to `getCoachUtilization(currentCoach)` (manual calculation)
- Use `metrics.utilizationPercent` directly

**Before:**
```javascript
document.getElementById('utilizationValue').textContent = `${getCoachUtilization(currentCoach)}%`;
```

**After:**
```javascript
document.getElementById('utilizationValue').textContent = `${response.metrics.utilizationPercent}%`;
```

---

### 4.3 Sidebar "Performance" (Lines 408-426)

**Current Code:**
```javascript
document.getElementById('npsValue').textContent = currentCoach.nps.toFixed(1);
document.getElementById('retentionValue').textContent = `${currentCoach.retentionRate}%`;
document.getElementById('completionValue').textContent = `${currentCoach.completionRate}%`;
document.getElementById('durationValue').textContent = `${currentCoach.metrics.avgDuration} min`;
```

**Data Required:**
- `currentCoach.nps` → metrics.nps
- `currentCoach.retentionRate` → metrics.retentionRate
- `currentCoach.completionRate` → metrics.completionRate
- `currentCoach.metrics.avgDuration` → metrics.avgDuration

**Change:** Flatten nested structure.

**Before:**
```javascript
document.getElementById('durationValue').textContent = `${currentCoach.metrics.avgDuration} min`;
```

**After:**
```javascript
document.getElementById('durationValue').textContent = `${response.metrics.avgDuration} min`;
```

---

### 4.4 Sidebar "Sesiones" (Lines 429-438)

**Current Code:**
```javascript
document.getElementById('sessionCountValue').textContent = formatNumber(currentCoach.sessionCount);
document.getElementById('programsValue').textContent = formatNumber(currentCoach.totalProgramsCompleted);
```

**Data Required:**
- `currentCoach.sessionCount` → metrics.sessionCount
- `currentCoach.totalProgramsCompleted` → metrics.totalProgramsCompleted

**No changes needed.**

---

### 4.5 Tab: Clientes (Lines 507-532)

**Current Code:**
```javascript
function renderClients() {
  const coachClients = CLIENTS.filter(c => c.coachId === currentCoach.id);
  if (coachClients.length === 0) {
    document.getElementById('clientList').innerHTML = '<p class="text-muted">No hay clientes asignados</p>';
    return;
  }
  const html = coachClients.map(client => `
    <div class="client-item" onclick="navigateTo('owner-client-detail', { clientId: '${client.id}' })" style="cursor: pointer;">
      <p class="client-name">${client.avatar} ${escapeHtml(client.name)}</p>
      <p class="client-meta">${escapeHtml(client.role)} • ${escapeHtml(client.sector)}</p>
      <p class="client-meta">${client.program} - ${client.progress}% completado</p>
      <div class="client-progress-bar">
        <div class="progress-bar">
          <div class="progress-bar-fill" style="width: ${client.progress}%"></div>
        </div>
      </div>
    </div>
  `).join('');
  document.getElementById('clientList').innerHTML = html;
}
```

**Data Required:**
- `response.clients[]` array, each with: id, name, avatar, role, sector, program, progress

**No structural changes.** Response JSON already provides `clients: [...]` array.

---

### 4.6 Tab: Métricas (Lines 534-577)

**Current Code:**
```javascript
function renderMetrics() {
  const html = `
    <div class="metric-row">
      <div class="metric-box">
        <div class="metric-box-label">NPS Score</div>
        <div class="metric-box-value">⭐ ${currentCoach.nps}</div>
      </div>
      <div class="metric-box">
        <div class="metric-box-label">Tasa Retención</div>
        <div class="metric-box-value">${currentCoach.retentionRate}%</div>
      </div>
    </div>
    ...
  `;
}
```

**Data Required:**
- `metrics.nps`, `retentionRate`, `completionRate`, `avgDuration`, `sessionCount`, `totalProgramsCompleted`, `utilizationPercent`

**Change:** Restructure to access `metrics.*` instead of `currentCoach.*`.

**Before:**
```javascript
<div class="metric-box-value">⭐ ${currentCoach.nps}</div>
```

**After:**
```javascript
<div class="metric-box-value">⭐ ${response.metrics.nps}</div>
```

---

### 4.7 Tab: Actividad (Lines 580-599)

**Current Code:**
```javascript
function renderActivity() {
  const activities = [
    { time: 'Hace 2 horas', text: `Completó sesión con ${CLIENTS.filter(...)[0]?.name}` },
    { time: 'Hace 1 día', text: 'Nuevo cliente asignado' },
    { time: 'Hace 3 días', text: 'Programa completado' },
    { time: 'Hace 1 semana', text: 'Sesión de onboarding completada' }
  ];
  const html = activities.map(act => `
    <div class="activity-item">
      <div class="activity-dot"></div>
      <div class="activity-content">
        <div class="activity-time">${act.time}</div>
        <p class="activity-text">${act.text}</p>
      </div>
    </div>
  `).join('');
}
```

**Data Required:**
- `response.activity[]` array, each with: type, description, created_at, (optional) related_client_id

**Change:** Replace hardcoded activities with API response.

**Before:**
```javascript
const activities = [
  { time: 'Hace 2 horas', text: '...' },
  ...
];
```

**After:**
```javascript
const activities = response.activity.map(act => ({
  time: daysAgo(act.created_at),
  text: act.description
}));
```

---

## 5. Edge Functions Required

### 5.1 Primary Edge Function: `fetch-coach-detail`

**Purpose:** Fetch coach profile, metrics, clients, activity in one call.

**Invocation (in HTML):**
```javascript
const response = await fetch(
  `/api/organization/${orgId}/coaches/${coachId}`,
  {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${jwt}` }
  }
);
const data = await response.json();
```

**Implementation:** TypeScript in `supabase/functions/fetch-coach-detail/index.ts`

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    // 1. Verify auth & org
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) throw new Error("Invalid token");

    const url = new URL(req.url);
    const orgId = url.pathname.split("/")[3]; // /api/organization/{org_id}/...
    const coachId = url.pathname.split("/")[5]; // .../coaches/{coach_id}

    // 2. Verify user belongs to org
    const { data: userData } = await supabase
      .from("usuarios")
      .select("org_id, rol")
      .eq("auth_id", user.id)
      .eq("org_id", orgId)
      .single();
    if (!userData) throw new Error("Not authorized");

    // 3. Fetch coach profile
    const { data: coach } = await supabase
      .from("usuarios")
      .select("id, nombre, email, avatar, especialidad, estado_sub, created_at, last_login, capacity")
      .eq("id", coachId)
      .eq("org_id", orgId)
      .single();
    if (!coach) throw new Error("Coach not found");

    // 4. Fetch metrics (via SQL or aggregation)
    const { data: metrics } = await supabase
      .rpc("get_coach_metrics", { p_coach_id: coachId, p_org_id: orgId });

    // 5. Fetch assigned clients
    const { data: assignments } = await supabase
      .from("coach_client_assignments")
      .select(`
        client_id,
        candidatos (
          id, nombre, email, avatar, rol, sector, 
          (SELECT nombre FROM programas WHERE id = programa_id LIMIT 1) as program,
          progreso, status
        )
      `)
      .eq("coach_id", coachId)
      .eq("org_id", orgId)
      .eq("status", "active");

    // 6. Fetch activity timeline
    const { data: activity } = await supabase
      .from("audit_logs")
      .select("id, action, resource_type, created_at, changes, resource_id")
      .eq("org_id", orgId)
      .in("user_id", [coachId]) // Or filter by coach involvement
      .order("created_at", { ascending: false })
      .limit(10);

    return new Response(
      JSON.stringify({
        coach: {
          id: coach.id,
          name: coach.nombre,
          email: coach.email,
          avatar: coach.avatar,
          specialty: coach.especialidad,
          status: coach.estado_sub,
          joinedAt: coach.created_at,
          lastActive: coach.last_login,
          clientsAssigned: assignments?.length || 0,
          capacity: coach.capacity,
          org_id: orgId
        },
        metrics: metrics || {},
        clients: (assignments || []).map(a => a.candidatos),
        activity: (activity || []).map(a => ({
          id: a.id,
          type: a.action, // Normalize event types
          description: humanizeActivity(a.action, a.resource_type),
          created_at: a.created_at,
          related_client_id: a.resource_id
        }))
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: error.message === "Not authorized" ? 403 : 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
```

**SQL Stored Procedure (optional, for metrics):**

```sql
-- Create stored procedure for complex aggregations
CREATE OR REPLACE FUNCTION get_coach_metrics(p_coach_id UUID, p_org_id UUID)
RETURNS TABLE (
  nps float,
  retentionRate int,
  completionRate int,
  avgDuration int,
  sessionCount int,
  totalProgramsCompleted int,
  utilizationPercent int
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ROUND(AVG(sr.nps_coach)::numeric, 1)::float,
    ROUND(100.0 * COUNT(DISTINCT c.id FILTER (WHERE c.status = 'activo')) 
          / NULLIF(COUNT(DISTINCT c.id), 0))::int,
    ROUND(100.0 * COUNT(DISTINCT i.id FILTER (WHERE i.status = 'completado'))
          / NULLIF(COUNT(DISTINCT i.id), 0))::int,
    ROUND(AVG(sr.duracion))::int,
    COUNT(sr.id)::int,
    COUNT(DISTINCT i.id FILTER (WHERE i.status = 'completado'))::int,
    ROUND(100.0 * (
      SELECT COUNT(*) FROM coach_client_assignments 
      WHERE coach_id = p_coach_id AND org_id = p_org_id AND status = 'active'
    ) / NULLIF((SELECT capacity FROM usuarios WHERE id = p_coach_id), 0))::int
  FROM usuarios u
  LEFT JOIN sesiones_registro sr ON u.id = sr.coach_id AND sr.org_id = p_org_id
  LEFT JOIN candidatos c ON u.id = c.coach_id AND c.org_id = p_org_id
  LEFT JOIN informes i ON u.id = i.coach_id AND i.org_id = p_org_id
  WHERE u.id = p_coach_id AND u.org_id = p_org_id;
END;
$$ LANGUAGE plpgsql;
```

---

## 6. Supabase Entities & Relationships

### 6.1 New Tables / Columns

**New: `coach_client_assignments` table**
```sql
CREATE TABLE coach_client_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  coach_id UUID NOT NULL REFERENCES usuarios(id),
  client_id UUID NOT NULL REFERENCES candidatos(id),
  status VARCHAR(50) DEFAULT 'active',
  assigned_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (org_id, coach_id, client_id)
);
CREATE INDEX idx_coach_client_assignments_coach_id ON coach_client_assignments(coach_id);
```

**Extended: `usuarios` table**
```sql
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS avatar CHAR(2);
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS especialidad VARCHAR(100);
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS capacity INT DEFAULT 10;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id);
```

**Extended: `sesiones_registro` table** (if nps_coach doesn't exist)
```sql
ALTER TABLE sesiones_registro ADD COLUMN IF NOT EXISTS nps_coach DECIMAL(2,1);
```

**Extended: `audit_logs` table** (for activity)
```sql
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id),
  user_id UUID REFERENCES auth.users(id),
  action VARCHAR(50),
  resource_type VARCHAR(100),
  resource_id UUID,
  changes JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_audit_logs_org_id ON audit_logs(org_id);
```

---

### 6.2 RLS Policies for This Page

**Policy: `usuarios` read access (coach profile)**
```sql
CREATE POLICY "coach_profile_read" ON usuarios
  FOR SELECT
  USING (
    org_id = (SELECT org_id FROM usuarios WHERE auth_id = auth.uid() LIMIT 1)
  );
```

**Policy: `coach_client_assignments` read/write**
```sql
CREATE POLICY "coach_assignments_read" ON coach_client_assignments
  FOR SELECT
  USING (
    org_id = (SELECT org_id FROM usuarios WHERE auth_id = auth.uid() LIMIT 1)
  );

CREATE POLICY "coach_assignments_write" ON coach_client_assignments
  FOR INSERT
  WITH CHECK (
    org_id = (SELECT org_id FROM usuarios WHERE auth_id = auth.uid() LIMIT 1)
  );
```

**Policy: `sesiones_registro` read (for metrics)**
```sql
CREATE POLICY "sessions_read_by_org" ON sesiones_registro
  FOR SELECT
  USING (
    org_id = (SELECT org_id FROM usuarios WHERE auth_id = auth.uid() LIMIT 1)
  );
```

---

## 7. Permission Rules

### 7.1 Who Can View This Page

| Role | Owner | Admin | Coach | Client |
|-----|-------|-------|-------|--------|
| View own profile | ✅ Yes | ✅ Yes | ✅ Yes (self) | ❌ No |
| View any coach | ✅ Yes | ✅ Yes | ❌ No | ❌ No |
| Edit coach status | ✅ Yes | ✅ Yes | ❌ No | ❌ No |
| Reassign client | ✅ Yes | ✅ Yes | ❌ No | ❌ No |

**Implementation:**
- Frontend: Only show "Edit" button if `user.role === 'owner' OR 'admin'`
- Backend: Edge Function checks JWT role before allowing PATCH
- RLS: Prevents cross-org access (automatic)

---

### 7.2 Access Control in Edge Function

```typescript
// In fetch-coach-detail
const { data: userData } = await supabase
  .from("usuarios")
  .select("org_id, rol")
  .eq("auth_id", user.id)
  .single();

// Check: User is in same org as coach
if (userData.org_id !== orgId) throw new Error("Not authorized");

// For PATCH (edit) endpoints, also check:
if (userData.rol !== 'owner' && userData.rol !== 'admin') {
  throw new Error("Only owners/admins can edit coaches");
}
```

---

## 8. Integration Checklist

**Frontend → Backend Transition:**

- [ ] **Day 1:** Create `coach_client_assignments` table, extend `usuarios` with avatar/especialidad/last_login/capacity/org_id
- [ ] **Day 1:** Create `audit_logs` table for activity timeline
- [ ] **Day 1:** Deploy RLS policies for all tables
- [ ] **Day 2:** Implement `get_coach_metrics` stored procedure
- [ ] **Day 2:** Deploy `fetch-coach-detail` Edge Function
- [ ] **Day 2:** Test Edge Function locally (mock org/coach data)
- [ ] **Day 3:** Update HTML: Replace `renderCoachDetail()` to fetch from `/api/organization/{org_id}/coaches/{coach_id}`
- [ ] **Day 3:** Test with real data (verify no layout changes needed)
- [ ] **Day 4:** Test permissions (owner vs admin vs coach access)
- [ ] **Day 4:** Test cross-org isolation (coach from org-002 cannot see org-001 data)
- [ ] **Day 5:** Load testing (performance with real data)

---

## 9. Data Pathways

### 9.1 Current (Mock) → Desired (Real)

| Section | Mock Source | Real Source | Edge Function |
|---------|---|---|---|
| Header | COACHES array | usuarios table | fetch-coach-detail |
| Sidebar Stats | COACHES object | usuarios + coach_client_assignments | fetch-coach-detail |
| Performance Card | COACHES.metrics | SQL aggregation | get_coach_metrics |
| Clientes Tab | CLIENTS filtered by coachId | coach_client_assignments + candidatos | fetch-coach-detail |
| Métricas Tab | COACHES.metrics (same as sidebar) | SQL aggregation | get_coach_metrics |
| Actividad Tab | Hardcoded array | audit_logs table | fetch-coach-detail |

### 9.2 No Circular Dependencies

```
fetch-coach-detail (1 call)
  ├─ usuarios (coach profile) ✅
  ├─ coach_client_assignments (clients list) ✅
  ├─ get_coach_metrics (performance data) ✅
  └─ audit_logs (activity) ✅
```

**All data in one response** → No chaining required → No N+1 queries.

---

## 10. Rollback & Testing Strategy

### 10.1 A/B Test: Mock vs Real

**Before connecting frontend:**

1. Deploy Edge Function
2. Test Edge Function directly:
   ```bash
   curl -X GET \
     "http://localhost:54321/functions/v1/fetch-coach-detail?org_id=org-001&coach_id=coach-001" \
     -H "Authorization: Bearer <test_jwt>"
   ```

3. Compare response shape with mock data:
   ```javascript
   // Mock response (current)
   const mockCoach = COACHES[0];
   console.log(mockCoach.nps); // 4.8

   // Real response (after integration)
   const realCoach = await fetch(...).then(r => r.json());
   console.log(realCoach.metrics.nps); // 4.8 (same data)
   ```

4. Run both in parallel (mock-data.js + Edge Function)
5. Verify UI renders identically
6. Switch to real data (remove mock import)

### 10.2 Fallback Plan

**If Edge Function fails:**
1. Keep mock-data.js imported
2. Catch fetch errors → use `COACHES` fallback
3. Display banner: "Using cached data. Service will be restored shortly."

---

## 11. Migration Path from Pathway

### 11.1 Data Already Exists

- ✅ `usuarios` (coaches)
- ✅ `candidatos` (clients)
- ✅ `sesiones_registro` (sessions)
- ✅ `informes` (programs completed)

**No data loss.** Just adding org_id column + new relationships.

### 11.2 Data to Backfill

**Step 1:** Add `org_id` to `usuarios`
```sql
-- Assign all coaches to first org (MVP)
UPDATE usuarios SET org_id = (SELECT id FROM organizations LIMIT 1) WHERE rol = 'coach';
```

**Step 2:** Create `coach_client_assignments` from existing data
```sql
-- Infer assignments from past sesiones_registro
INSERT INTO coach_client_assignments (org_id, coach_id, client_id, status, assigned_at)
SELECT DISTINCT
  (SELECT org_id FROM usuarios WHERE id = sr.coach_id LIMIT 1),
  sr.coach_id,
  c.id,
  'active',
  MIN(sr.created_at)
FROM sesiones_registro sr
JOIN candidatos c ON sr.candidato_id = c.id
WHERE sr.coach_id IS NOT NULL
GROUP BY sr.coach_id, c.id
ON CONFLICT DO NOTHING;
```

---

## Summary

**Frontend Status:** ✅ Complete, no changes needed  
**Backend Status:** 🔄 Ready to implement  
**Data Flow:** Mock → Real (1 API call, no structural changes)  
**Permission Model:** Role-based (owner/admin only)  
**Multi-Tenant Isolation:** Automatic via RLS policies  

**Next Action:** Implement Phase 0 tables + Edge Functions → Connect frontend to `/api/organization/{org_id}/coaches/{coach_id}` endpoint.

