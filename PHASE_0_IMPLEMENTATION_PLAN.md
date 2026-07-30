# Phase 0 Implementation Plan: MultiCoach Infrastructure Base

**Status:** Pre-implementation (Architecture validated, Frontend complete)  
**Timeline:** Weeks 1-2  
**Deliverables:** Supabase schema, RLS policies, Edge Functions, Implementation contracts  
**Owner:** MultiCoach Engineering  

---

## 1. Supabase Infrastructure Setup

### 1.1 Table Definitions & Migrations

#### Table: `organizations`

Multi-tenant container. One record per owner account.

```sql
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Identity
  name VARCHAR(255) NOT NULL,
  logo_emoji CHAR(2),
  sector VARCHAR(100),
  country VARCHAR(50),
  timezone VARCHAR(50) DEFAULT 'UTC',
  
  -- Billing & Status
  plan VARCHAR(50) DEFAULT 'starter', -- starter | pro | enterprise
  status VARCHAR(50) DEFAULT 'active', -- active | trial | suspended | cancelled
  stripe_customer_id VARCHAR(255),
  stripe_subscription_id VARCHAR(255),
  
  -- Configuration
  brand_color VARCHAR(7) DEFAULT '#8C7B80',
  contact_email VARCHAR(255),
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Constraints
  CONSTRAINT org_unique_owner UNIQUE (owner_id) -- One org per owner (for MVP)
);

CREATE INDEX idx_organizations_owner_id ON organizations(owner_id);
CREATE INDEX idx_organizations_status ON organizations(status);
```

**Purpose:** Container for all organization data. RLS filters all queries by `org_id`.

---

#### Table: `usuarios` (Pathway extension)

Existing table, extended with `org_id` to partition by organization.

```sql
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS is_owner BOOLEAN DEFAULT FALSE;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ;

-- Migrate existing coaches: assign to org if they have an owner
-- For MVP: assume all Pathway coaches are under the first (only) org
-- Post-MVP: handle coach reassignment between orgs

CREATE INDEX idx_usuarios_org_id ON usuarios(org_id);
CREATE INDEX idx_usuarios_role ON usuarios(rol);
```

**Purpose:** Existing Pathway table, now partitioned by org. Coaches, admins, and owners stored here.

---

#### Table: `coach_client_assignments`

Map coaches to clients within an organization.

```sql
CREATE TABLE coach_client_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  coach_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES candidatos(id) ON DELETE CASCADE,
  
  status VARCHAR(50) DEFAULT 'active', -- active | paused | completed
  assigned_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Constraints
  CONSTRAINT coach_client_assignment_unique UNIQUE (org_id, coach_id, client_id)
);

CREATE INDEX idx_coach_client_assignments_org_id ON coach_client_assignments(org_id);
CREATE INDEX idx_coach_client_assignments_coach_id ON coach_client_assignments(coach_id);
CREATE INDEX idx_coach_client_assignments_client_id ON coach_client_assignments(client_id);
```

**Purpose:** Explicit tracking of coach ↔ client relationships within org context.

---

#### Table: `programas`

Reifies Pathway's 4-week program as entities per organization.

```sql
CREATE TABLE programas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Identity
  name VARCHAR(255), -- "Semana 1", "Semana 2", etc.
  week_number INT NOT NULL CHECK (week_number >= 1 AND week_number <= 4),
  description TEXT,
  
  -- Dates
  start_date DATE,
  end_date DATE,
  
  -- Status
  status VARCHAR(50) DEFAULT 'active', -- active | completed | archived
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Constraints
  CONSTRAINT programa_unique_per_org_week UNIQUE (org_id, week_number)
);

CREATE INDEX idx_programas_org_id ON programas(org_id);
CREATE INDEX idx_programas_week_number ON programas(week_number);
```

**Purpose:** Enables filtering/aggregating clients and coaches by program week.

---

#### Table: `organizations_billing`

Billing & subscription state per organization.

```sql
CREATE TABLE organizations_billing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Plan & Pricing
  plan VARCHAR(50) NOT NULL, -- starter | pro | enterprise
  price_usd DECIMAL(10, 2),
  billing_interval VARCHAR(10) DEFAULT 'month', -- month | year
  
  -- Subscription Dates
  subscription_started_at TIMESTAMPTZ,
  subscription_ended_at TIMESTAMPTZ,
  next_billing_date DATE,
  
  -- Usage
  coaches_used INT DEFAULT 0,
  coaches_limit INT DEFAULT 5, -- per plan
  clients_used INT DEFAULT 0,
  clients_limit INT DEFAULT 50,
  storage_used_gb DECIMAL(10, 2) DEFAULT 0,
  storage_limit_gb INT DEFAULT 100,
  
  -- Status
  status VARCHAR(50) DEFAULT 'active', -- active | past_due | cancelled
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_organizations_billing_org_id ON organizations_billing(org_id);
```

**Purpose:** Tracks usage limits, plan details, and billing dates per org.

---

#### Table: `organization_branding`

White-label customization per organization.

```sql
CREATE TABLE organization_branding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Branding
  brand_name VARCHAR(255),
  logo_emoji CHAR(2),
  tagline VARCHAR(255),
  
  -- Colors
  primary_color VARCHAR(7) DEFAULT '#8C7B80',
  secondary_color VARCHAR(7) DEFAULT '#D4CCCA',
  accent_color VARCHAR(7) DEFAULT '#8C7B80',
  
  -- Optional
  custom_domain VARCHAR(255),
  favicon_emoji CHAR(2),
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_organization_branding_org_id ON organization_branding(org_id);
```

**Purpose:** Centralized branding configuration for white-label customization.

---

#### Table: `audit_logs` (For security)

Track who accessed what, when.

```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  
  -- Action
  action VARCHAR(50), -- read | create | update | delete | export
  resource_type VARCHAR(100), -- coaches | clients | programs | billing
  resource_id UUID,
  
  -- Details
  changes JSONB, -- Old values vs new values
  ip_address INET,
  user_agent TEXT,
  
  -- Timestamp
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_audit_logs_org_id ON audit_logs(org_id);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
```

**Purpose:** Compliance & security auditing.

---

### 1.2 Row Level Security (RLS) Policies

**Principle:** Every table filters by `org_id`. Only users with `users.org_id = table.org_id` can access rows.

#### Policy: `organizations` table

```sql
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- Owners can read/write their own org
CREATE POLICY "org_owner_access" ON organizations
  FOR ALL
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- Admins (staff) can read org they belong to
CREATE POLICY "org_user_read_access" ON organizations
  FOR SELECT
  USING (id IN (
    SELECT org_id FROM usuarios WHERE auth_id = auth.uid() AND rol = 'admin'
  ));
```

**Purpose:** Prevent cross-org access. Each org owner sees only their org.

---

#### Policy: `usuarios` table (extension)

```sql
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;

-- Users can read coaches/staff in their org
CREATE POLICY "usuarios_org_access" ON usuarios
  FOR SELECT
  USING (org_id = (SELECT org_id FROM usuarios WHERE auth_id = auth.uid() LIMIT 1));

-- Restrict password_hash column (even from owner)
CREATE POLICY "usuarios_hide_password" ON usuarios
  FOR SELECT
  USING (true)
  WITH CHECK (false);

-- Apply column-level security
ALTER TABLE usuarios DISABLE ROW LEVEL SECURITY; -- Temporarily disable to set column perms
GRANT SELECT (id, org_id, email, nombre, rol, avatar, is_owner, last_login, created_at) 
  ON usuarios TO authenticated;

ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
```

**Purpose:** Partition users by org. Hide password_hash from all roles.

---

#### Policy: `coach_client_assignments` table

```sql
ALTER TABLE coach_client_assignments ENABLE ROW LEVEL SECURITY;

-- Users in org can see assignments
CREATE POLICY "coach_client_assignment_org_access" ON coach_client_assignments
  FOR SELECT
  USING (org_id = (SELECT org_id FROM usuarios WHERE auth_id = auth.uid() LIMIT 1));

-- Only org admins can create/update
CREATE POLICY "coach_client_assignment_write" ON coach_client_assignments
  FOR INSERT
  WITH CHECK (
    org_id = (SELECT org_id FROM usuarios WHERE auth_id = auth.uid() LIMIT 1)
    AND (SELECT rol FROM usuarios WHERE auth_id = auth.uid()) = 'admin'
  );
```

**Purpose:** Multi-tenant isolation for coach ↔ client relationships.

---

#### Policy: `programas` table

```sql
ALTER TABLE programas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "programas_org_access" ON programas
  FOR ALL
  USING (org_id = (SELECT org_id FROM usuarios WHERE auth_id = auth.uid() LIMIT 1));
```

**Purpose:** Each org sees only its programs.

---

#### Policy: `organizations_billing` table

```sql
ALTER TABLE organizations_billing ENABLE ROW LEVEL SECURITY;

-- Owner/admins can read billing for their org
CREATE POLICY "billing_org_access" ON organizations_billing
  FOR SELECT
  USING (org_id = (SELECT org_id FROM usuarios WHERE auth_id = auth.uid() LIMIT 1));

-- Only owner can write
CREATE POLICY "billing_owner_write" ON organizations_billing
  FOR ALL
  USING (
    org_id IN (SELECT id FROM organizations WHERE owner_id = auth.uid())
  );
```

**Purpose:** Billing data scoped by org, write-protected to owner.

---

### 1.3 Authentication Model

**Flows:**

1. **Owner Registration / Login:**
   - Use Supabase Auth (email + password)
   - Create `organizations` row with `owner_id = auth.uid()`
   - Create `usuarios` row: `auth_id = auth.uid()`, `org_id = org.id`, `rol = 'owner'`

2. **Coach / Admin Login (Pathway Integration):**
   - Coach logs in via Pathway (existing Supabase Auth)
   - Query: Find matching coach in `usuarios` table
   - Set `org_id` on their record (migration + assignment)
   - JWT includes: `auth_id`, `org_id` (extracted from `usuarios.org_id`)

3. **Session / JWT:**
   - Supabase Auth JWT: `{ sub: auth_id, org_id: ..., role: ... }` (optional, can be looked up)
   - All Edge Functions validate: `user.org_id = request.org_id`

---

### 1.4 Base Edge Functions

Middleware for auth + org validation.

#### Function: `verify-user-org`

```typescript
// supabase/functions/verify-user-org/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  headers: {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, content-type",
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors.headers });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    const orgId = new URL(req.url).searchParams.get("org_id");

    if (!token || !orgId) {
      return new Response(
        JSON.stringify({ error: "Missing token or org_id" }),
        { status: 400, headers: { ...cors.headers, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify token & extract user
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) throw new Error("Invalid token");

    // Check user belongs to org
    const { data: userData, error: queryError } = await supabase
      .from("usuarios")
      .select("id, org_id, rol")
      .eq("auth_id", user.id)
      .eq("org_id", orgId)
      .single();

    if (queryError || !userData) {
      return new Response(
        JSON.stringify({ error: "User not in organization" }),
        { status: 403, headers: { ...cors.headers, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        verified: true,
        user_id: user.id,
        org_id: orgId,
        role: userData.rol,
      }),
      { status: 200, headers: { ...cors.headers, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...cors.headers, "Content-Type": "application/json" } }
    );
  }
});
```

**Purpose:** Validate JWT + org membership before processing requests.

---

#### Function: `get-user-org`

```typescript
// supabase/functions/get-user-org/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) throw new Error("Invalid token");

    // Get user's org_id
    const { data: userData, error: queryError } = await supabase
      .from("usuarios")
      .select("org_id")
      .eq("auth_id", user.id)
      .single();

    if (queryError || !userData) {
      return new Response(
        JSON.stringify({ error: "User not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ org_id: userData.org_id }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
```

**Purpose:** Lookup user's org_id from JWT.

---

## 2. Implementation Contracts

For each frontend page: **What data it needs, where it comes from, how it changes.**

### 2.1 `owner-coaches.html`

**Purpose:** List coaches with KPIs, filter, toggle view mode.

| Aspect | Specification |
|--------|---|
| **Data Source** | `usuarios` WHERE `org_id = {org_id}` AND `rol = 'coach'` + aggregated metrics |
| **Read Operations** | GET `/api/organization/{org_id}/coaches` with filters (status, capacity, sort) |
| **Write Operations** | PATCH `/api/organization/{org_id}/coaches/{coach_id}` (status update) |
| **Aggregations** | clients_assigned, capacity utilization, NPS (avg from sesiones_registro), retention (from candidatos), completion rate (from informes) |
| **Edge Function** | `fetch-coaches-with-metrics` (joins usuarios, sesiones_registro, informes, candidatos) |
| **Frontend Readiness** | ✅ No changes needed. Components accept `{id, name, email, avatar, specialty, status, clientsAssigned, capacity, nps, retentionRate, completionRate, ...}` |

**Mock → Real Data Mapping:**
- `COACHES[].id` → `usuarios.id`
- `COACHES[].status` → `usuarios.estado_sub` (or create new column)
- `COACHES[].nps` → `AVG(sesiones_registro.nps_coach) GROUP BY coach_id`
- `COACHES[].retentionRate` → `COUNT(candidatos.id WHERE status = 'active') / COUNT(*) GROUP BY coach_id`

**API Endpoint:**

```
GET /api/organization/{org_id}/coaches?filter=status&sort=nps
Response: {
  coaches: [
    {
      id: UUID,
      name: string,
      email: string,
      avatar: string,
      specialty: string,
      status: "active" | "inactive" | "paused",
      clientsAssigned: number,
      capacity: number,
      nps: float,
      retentionRate: number,
      completionRate: number,
      lastActive: ISO8601,
      ...
    }
  ],
  total: number
}
```

---

### 2.2 `owner-coach-detail.html`

**Purpose:** Detailed coach profile, client list, metrics, activity timeline.

| Aspect | Specification |
|--------|---|
| **Data Source** | `usuarios` + `candidatos` + `sesiones_registro` + `informes` |
| **Read Operations** | GET `/api/organization/{org_id}/coaches/{coach_id}` (profile + clients + activity) |
| **Write Operations** | PATCH `/api/organization/{org_id}/coaches/{coach_id}` (reassign clients, update status) |
| **Aggregations** | Session count, client list, timeline events, performance metrics |
| **Edge Function** | `fetch-coach-detail` |
| **Frontend Readiness** | ✅ No changes needed. Three tabs (Clientes, Métricas, Actividad) already structured. |

**API Endpoint:**

```
GET /api/organization/{org_id}/coaches/{coach_id}
Response: {
  coach: { ... (full coach object) },
  clients: [
    { id, name, email, progress, status, risk_level, ... }
  ],
  activity: [
    { id, type, description, created_at }
  ],
  metrics: {
    sessionCount: number,
    avgSessionDuration: number,
    totalClientsManaged: number,
    ...
  }
}
```

---

### 2.3 `owner-clients.html`

**Purpose:** List all clients, filter by status/risk/coach, toggle view.

| Aspect | Specification |
|--------|---|
| **Data Source** | `candidatos` WHERE `org_id = {org_id}` + coach assignment data |
| **Read Operations** | GET `/api/organization/{org_id}/clients` with multi-criteria filters |
| **Write Operations** | (None for list view; detail view: reassignment, status updates) |
| **Filters** | status (active/completed/at-risk), risk_level (low/medium/high), coach_id, sort |
| **Edge Function** | `fetch-org-clients` |
| **Frontend Readiness** | ✅ No changes needed. Filters & card/table toggle already implemented. |

**API Endpoint:**

```
GET /api/organization/{org_id}/clients?status=active&risk=high&sort=progress
Response: {
  clients: [
    {
      id: UUID,
      name: string,
      email: string,
      avatar: string,
      coachId: UUID,
      coachName: string,
      program: string,
      programWeek: number,
      status: "active" | "completed" | "at_risk",
      progress: number,
      riskLevel: "low" | "medium" | "high",
      startDate: ISO8601,
      endDate: ISO8601,
      ...
    }
  ],
  summary: { total, completed, at_risk, avg_progress }
}
```

---

### 2.4 `owner-client-detail.html`

**Purpose:** Individual client profile, program progress, coach assignment, activity.

| Aspect | Specification |
|--------|---|
| **Data Source** | `candidatos` + `coach_client_assignments` + `sesiones_registro` + `informes` |
| **Read Operations** | GET `/api/organization/{org_id}/clients/{client_id}` (full profile + linked data) |
| **Write Operations** | PATCH `/api/organization/{org_id}/clients/{client_id}/coach` (reassign coach) |
| **Edge Function** | `fetch-client-detail`, `assess-client-risk` |
| **Frontend Readiness** | ✅ No changes needed. Three tabs structure ready. |

**API Endpoint:**

```
GET /api/organization/{org_id}/clients/{client_id}
Response: {
  client: { id, name, email, avatar, status, progress, risk_level, ... },
  program: {
    id: UUID,
    week: 1-4,
    startDate: ISO8601,
    endDate: ISO8601,
    status: "in_progress" | "completed",
    activities: [ { type, name, completed, due_date } ]
  },
  assignedCoach: { id, name, email, avatar, joinedAt, status },
  activity: [ { type, description, created_at } ],
  riskAssessment: {
    level: "low" | "medium" | "high",
    factors: [ { name, score, recommendation } ],
    lastAssessed: ISO8601
  }
}
```

---

### 2.5 `owner-programs.html`

**Purpose:** List programs by week, show coaches/clients per program, completion rates.

| Aspect | Specification |
|--------|---|
| **Data Source** | `programas` + `coach_client_assignments` + `candidatos` |
| **Read Operations** | GET `/api/organization/{org_id}/programs` with filters & aggregations |
| **Write Operations** | (None for MVP) |
| **Aggregations** | coaches assigned, clients in program, completion rate, avg duration |
| **Edge Function** | `fetch-org-programs` |
| **Frontend Readiness** | ✅ No changes needed. Table/card view ready. |

**API Endpoint:**

```
GET /api/organization/{org_id}/programs?sort=week
Response: {
  programs: [
    {
      id: UUID,
      week: 1-4,
      name: string,
      startDate: ISO8601,
      endDate: ISO8601,
      status: "active" | "completed",
      coaches: [{ id, name, email, avatar }],
      clientsActive: number,
      clientsCompleted: number,
      completionRate: number,
      avgDuration: number,
      growthRate: number
    }
  ]
}
```

---

### 2.6 `owner-analytics.html`

**Purpose:** KPIs, growth chart, retention curve, coach utilization, NPS, forecast.

| Aspect | Specification |
|--------|---|
| **Data Source** | Aggregations from `candidatos`, `usuarios`, `sesiones_registro`, `informes`, analytics tables |
| **Read Operations** | GET `/api/organization/{org_id}/analytics/{metric}` (kpis, growth, retention, utilization, nps, forecast) |
| **Write Operations** | (POST context for Claude analysis, GET reports) |
| **Calculations** | Monthly growth, retention curve, coach utilization %, NPS scores, ML forecast |
| **Edge Functions** | `fetch-analytics-kpis`, `generate-analytics-report` (with Claude) |
| **Frontend Readiness** | ⚠️ **Needs mock chart rendering →real data.** Chart.js or similar required. |

**API Endpoint:**

```
GET /api/organization/{org_id}/analytics/summary
Response: {
  kpis: { totalClients, completionRate, revenue, satisfaction },
  monthlyGrowth: [{ month, clients, growth_pct }],
  retention: [{ month, retention_rate }],
  coachUtilization: [{ coachId, coachName, utilization_pct }],
  npsScores: [{ coachId, coachName, nps_avg }],
  forecast: [{ month, predicted_clients, confidence_low, confidence_high }]
}
```

---

### 2.7 `owner-billing.html`

**Purpose:** View plan, usage, invoices, payment method.

| Aspect | Specification |
|--------|---|
| **Data Source** | `organizations_billing` + `organizations` + Stripe API |
| **Read Operations** | GET `/api/organization/{org_id}/billing` (plan, usage, invoices) |
| **Write Operations** | POST `/api/organization/{org_id}/billing/upgrade` (change plan), POST `/api/organization/{org_id}/billing/payment-method` (update payment) |
| **Edge Function** | `fetch-billing`, `upgrade-plan` (Stripe integration), `fetch-invoices` |
| **Frontend Readiness** | ✅ No changes needed. Form & display logic ready. |

**API Endpoint:**

```
GET /api/organization/{org_id}/billing
Response: {
  plan: {
    name: "pro",
    price_usd: 2999,
    billing_interval: "month",
    features: ["up to 10 coaches", "up to 100 clients", ...]
  },
  usage: {
    coaches: { used: 5, limit: 10 },
    clients: { used: 45, limit: 100 },
    storage_gb: { used: 12.5, limit: 100 }
  },
  nextBillingDate: ISO8601,
  paymentMethod: { type: "card", last4: "4242", expiry: "12/2025" },
  invoices: [
    { id, date, period, amount, status, download_url }
  ]
}
```

---

### 2.8 `owner-brand.html`

**Purpose:** Editor for branding (colors, logo, templates).

| Aspect | Specification |
|--------|---|
| **Data Source** | `organization_branding` |
| **Read Operations** | GET `/api/organization/{org_id}/branding` |
| **Write Operations** | PATCH `/api/organization/{org_id}/branding` (save color scheme, logo, tagline) |
| **Edge Function** | `update-org-branding` |
| **Frontend Readiness** | ✅ No changes needed. Form & preview rendering ready. |

**API Endpoint:**

```
GET /api/organization/{org_id}/branding
Response: {
  brandName: string,
  logoEmoji: string,
  tagline: string,
  primaryColor: "#XXXXXX",
  secondaryColor: "#XXXXXX",
  accentColor: "#XXXXXX",
  customDomain: string | null
}

PATCH /api/organization/{org_id}/branding
Body: { brandName, logoEmoji, tagline, primaryColor, ... }
Response: { success: true, branding: { ... } }
```

---

### 2.9 `owner-settings.html`

**Purpose:** Organization settings, user management, security, notifications, integrations.

| Aspect | Specification |
|--------|---|
| **Data Source** | `organizations`, `usuarios`, notifications preferences, integrations config |
| **Read Operations** | GET `/api/organization/{org_id}/settings` (org details, users, preferences) |
| **Write Operations** | PATCH org details, POST user invite, DELETE user, PATCH password, toggle notifications, POST/DELETE integrations |
| **Edge Functions** | `get-org-settings`, `invite-user`, `update-org-settings` |
| **Frontend Readiness** | ✅ No changes needed. Forms ready. |

**API Endpoint:**

```
GET /api/organization/{org_id}/settings
Response: {
  organization: { id, name, email, phone, country, city, timezone },
  users: [
    { id, email, role, joined_at, last_login }
  ],
  security: { password_changed_at, two_fa_enabled, sessions: [...] },
  notifications: { email: bool, push: bool, sms: bool },
  integrations: [
    { name: "slack", connected: bool, config: {...} },
    { name: "google_calendar", connected: bool, ... },
    ...
  ]
}
```

---

## 3. Frontend Validation

### 3.1 Component Readiness Assessment

| Page | Mock Data Field | Supabase Source | Structural Change? | Risk |
|-----|---|---|---|---|
| owner-coaches.html | COACHES[].id | usuarios.id | ❌ None | ✅ Low |
| owner-coaches.html | COACHES[].nps | AVG(sesiones_registro.nps_coach) | ❌ None | ✅ Low |
| owner-clients.html | CLIENTS[].status | candidatos.status | ❌ None | ✅ Low |
| owner-clients.html | CLIENTS[].riskLevel | NEW: risk assessment calculation | ❌ None (can be null initially) | ✅ Low |
| owner-programs.html | PROGRAMS[].week | programas.week_number | ❌ None | ✅ Low |
| owner-analytics.html | Chart rendering | Edge Function aggregations | ⚠️ Chart library required | 🟡 Medium |
| owner-billing.html | BILLING_DATA | organizations_billing + Stripe | ❌ None | ✅ Low |
| owner-brand.html | ORGANIZATION.color | organization_branding | ❌ None | ✅ Low |
| owner-settings.html | Form inputs | organizations + usuarios | ❌ None | ✅ Low |

**Summary:** 
- ✅ **8/9 pages** ready for direct integration (mock fields map 1:1 to DB columns)
- ⚠️ **1/9 pages** (owner-analytics.html) requires chart library for real-time rendering

**Recommendation:** No structural changes needed. Proceed with direct data substitution.

---

### 3.2 Mock Data → Real Data Transition Strategy

**Phase 0 Execution Flow:**

1. **Week 1:**
   - Apply SQL migrations (create tables + RLS policies)
   - Deploy base Edge Functions (verify-user-org, get-user-org)
   - Seed test data (1 org, 5 coaches, 10 clients from Pathway migration)

2. **Validation (Week 1 end):**
   - Manual test: Query database, verify RLS works
   - Verify Edge Functions return correct org_id
   - Check audit_logs captures access

3. **Week 2:**
   - Implement per-page Edge Functions (fetch-coaches, fetch-clients, etc.)
   - Update HTML to call Edge Functions instead of importing mock-data.js
   - A/B test: Run mock-data.js alongside real data endpoint for parity
   - Verify no regression in UI rendering

---

## 4. Implementation Sequence

**Safe order to minimize dependencies and avoid regressions.**

### Phase 0 (Weeks 1-2): Infrastructure Base

```
Week 1:
├─ Day 1-2: SQL migrations (tables + RLS)
├─ Day 2-3: Deploy base Edge Functions
├─ Day 3-4: Data migration (Pathway → organizations, coaches → users, clients → assignments)
├─ Day 4-5: Test RLS policies, verify cross-org access is blocked
└─ Day 5: Seed test data for 9 pages

Week 2:
├─ Day 1-2: Implement fetch-coaches, fetch-clients Edge Functions
├─ Day 2-3: Update HTML pages to call new endpoints
├─ Day 3-4: A/B test mock vs real data (ensure UI parity)
├─ Day 4-5: Document API contracts
└─ Day 5: Readiness review (manual testing + automated tests)
```

### Dependency Graph

```
organizations (table)
├─ verificar-user-org (Edge Function)
├─ usuarios (org_id column)
│  ├─ fetch-coaches (uses usuarios WHERE org_id = {org_id})
│  ├─ fetch-clients (uses candidatos joined with usuarios)
│  └─ owner-coaches.html (reads fetch-coaches)
├─ organizations_billing
│  └─ owner-billing.html
└─ organization_branding
   └─ owner-brand.html
```

**Critical Path:**
1. organizations table + RLS ✅
2. usuarios.org_id + migration ✅
3. Base Edge Functions (verify-user-org) ✅
4. Per-page Edge Functions (can run in parallel) ✅
5. Frontend integration (can run in parallel) ✅

**Parallel Work Possible:**
- SQL schema creation & Edge Functions development (2 people)
- Data migration & testing (1 person)
- Frontend integration (1-2 people)

**Risk Mitigation:**
- Test RLS policies BEFORE frontend integration
- Use test org (separate from Pathway prod) during Phase 0
- Verify audit_logs captures all access (compliance baseline)
- A/B test: mock vs real data endpoints run in parallel on same page (detect regressions)

---

## 5. Rollback & Contingency

**If Phase 0 fails:**

1. **RLS policies too strict (blocking legitimate access):**
   - Rollback: Disable row-level security
   - Review: Audit logs to see which queries failed
   - Fix: Refine policies, re-enable
   - Prevent: Add unit tests for RLS policies before re-enabling

2. **Data migration loses data:**
   - Rollback: Restore from backup (kept before migration)
   - Prevent: Dry-run migration on test copy first

3. **Edge Function breaks frontend:**
   - Rollback: Revert to mock-data.js import
   - Debug: Check Edge Function logs
   - Fix: Update function, re-test
   - Prevent: A/B test edge function output vs mock data before switching

---

## Next Steps

1. **Review & Approve:** Confirm implementation contracts match your frontend expectations
2. **SQL Migrations:** Prepare for deployment to Supabase
3. **Edge Functions:** Implement base functions for Week 1
4. **Testing Strategy:** Define automated tests for RLS policies
5. **Go/No-Go:** Week 1 end, decide to proceed to Phase 1 (Dashboard endpoint) or iterate Phase 0

