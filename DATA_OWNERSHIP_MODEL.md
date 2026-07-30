# Data Ownership Model: Pathway ↔ MultiCoach

**Principle:** No data duplication. Partition Pathway tables by org_id; create NEW tables only for MultiCoach entities.

---

## 1. Data Ownership Matrix

### Pathway Tables (Extended, not duplicated)

| Table | Source | Store What? | MultiCoach adds | Ownership | Read from MultiCoach? | Aggregated? |
|-------|--------|---|---|---|---|---|
| `usuarios` | Pathway ✅ | Coach identity, credentials, role | `org_id`, `avatar`, `especialidad`, `last_login`, `capacity` | Pathway (source of truth for auth + coaches) | Yes (filtered by org_id) | No |
| `candidatos` | Pathway ✅ | Client profile, intake data, progress | `org_id` (optional, for filtering) | Pathway (source of truth for client identity) | Yes (filtered by org_id) | No |
| `sesiones_registro` | Pathway ✅ | Session history, duration, notes | `org_id`, `nps_coach` (ratings) | Pathway (source of truth for sessions) | Yes (via aggregation only) | Yes (metrics calculated from here) |
| `informes` | Pathway ✅ | Generated reports, analysis | `org_id` (optional, for filtering) | Pathway (source of truth for outputs) | Yes (to count completions) | Yes (completion rate calculated) |
| `cv_publicados` | Pathway ✅ | Published CVs, content | `org_id` (optional) | Pathway (source of truth for documents) | No (not used in owner-coach-detail) | No |

**Key:** Pathway tables are NOT duplicated. MultiCoach only adds partition columns (`org_id`) and performance columns (`avatar`, `last_login`, `nps_coach`). All read access goes through RLS filters.

---

### MultiCoach Tables (New entities)

| Table | Purpose | Stores What | Ownership | Parent | Partition |
|-------|---------|---|---|---|---|
| `organizations` | Multi-tenant container | Org name, owner, plan, status, branding config | MultiCoach | — | Root (1 org per owner) |
| `coach_client_assignments` | Explicit coach ↔ client mapping | coach_id, client_id, status, assigned_at | MultiCoach | organizations | org_id |
| `organizations_billing` | Usage tracking & plan management | Plan, usage limits, next billing date, Stripe integration | MultiCoach | organizations | org_id (1:1) |
| `organization_branding` | White-label customization | Brand name, logo, colors, custom domain | MultiCoach | organizations | org_id (1:1) |
| `audit_logs` | Activity & compliance tracking | Action type, resource, user, timestamp, changes | MultiCoach | organizations | org_id |

**Key:** These are NEW. They exist ONLY in MultiCoach schema. They contain NO duplicate data from Pathway.

---

### Derived Data (Views, Materialized Views, or Edge Function Calculations)

| Name | Type | Source Tables | Calculation | Use Case | Refresh? |
|------|------|---|---|---|---|
| `coach_metrics` | View (lightweight) | usuarios, sesiones_registro, candidatos, informes | NPS AVG, retention %, completion %, avg duration | owner-coaches list, owner-coach-detail sidebar | Real-time (SELECT via Edge Function) |
| `coach_utilization` | View (lightweight) | coach_client_assignments | (assigned / capacity) * 100 | owner-coaches list, owner-coach-detail sidebar | Real-time |
| `client_risk_assessment` | View (materialized, 1h refresh) | candidatos, sesiones_registro, informes | risk_score based on engagement + progress | owner-clients list, owner-client-detail sidebar | Materialized (refresh 1h) |
| `org_activity_feed` | View (materialized, 15min refresh) | audit_logs, sesiones_registro, candidatos | Recent events per org | owner-coaches detail activity tab | Materialized (refresh 15min) |

**Key:** 
- Views are NOT stored as tables; they're queries run on-demand
- Materialized views ARE stored but recalculated on schedule
- Edge Functions do real-time calculation (join + aggregate) when not cached
- No duplication; pure calculation from source tables

---

## 2. Data Flow for owner-coach-detail.html

```
┌─ Frontend Request ──────────────────────────────────┐
│ GET /api/organization/{org_id}/coaches/{coach_id}  │
└─────────────────────────────────────────────────────┘
                      │
                      ▼
┌─ Edge Function: fetch-coach-detail ────────────────┐
│                                                     │
│ 1. Auth: Check JWT, verify org membership          │
│    └─ Pathway: usuarios (auth_id lookup)           │
│                                                     │
│ 2. Coach Profile: SELECT from usuarios             │
│    └─ Pathway: usuarios table (partitioned by org) │
│                                                     │
│ 3. Metrics: JOIN usuarios + sesiones_registro      │
│    ├─ Pathway: usuarios (coach)                    │
│    ├─ Pathway: sesiones_registro (NPS, count)      │
│    ├─ Pathway: candidatos (retention calc)         │
│    └─ Pathway: informes (completion calc)          │
│    └─ (No storage, calculated per request)         │
│                                                     │
│ 4. Assigned Clients: JOIN users → assignments      │
│    ├─ MultiCoach: coach_client_assignments         │
│    └─ Pathway: candidatos (client details)         │
│                                                     │
│ 5. Activity: SELECT from audit_logs + synthesize   │
│    └─ MultiCoach: audit_logs                       │
│    └─ Pathway: sesiones_registro (recent)          │
│                                                     │
│ 6. Return combined JSON response                   │
└─────────────────────────────────────────────────────┘
                      │
                      ▼
┌─ Frontend Rendering ──────────────────────────────┐
│ No storage. Display data as-is in HTML/CSS.       │
└───────────────────────────────────────────────────┘
```

**Critical Path Analysis:**
- ✅ No data duplication (all reads from Pathway originals + MultiCoach partitioning)
- ✅ No calculated data stored in new tables (pure JOIN + aggregation in Edge Function)
- ✅ Audit logs are new (don't duplicate Pathway data)
- ✅ Assignments are new (don't duplicate, just map existing coach_id + client_id)

---

## 3. Column Extension Strategy (Pathway Tables)

**DO extend Pathway tables with:**
- `org_id` — Partition column, for multi-tenant isolation
- `avatar` — Display data, not used elsewhere (coach avatar emoji)
- `especialidad` — Display data (coach specialty text)
- `last_login` — Metadata (used in owner-coach-detail)
- `capacity` — Configuration (coach capacity limit, used in MultiCoach only)
- `nps_coach` — Measurement data (coach NPS from sesiones_registro, used in analytics)

**DO NOT create new tables for:**
- Coach list duplicating usuarios
- Client list duplicating candidatos
- Session history duplicating sesiones_registro
- Calculated metrics (NPS, retention, completion rates)

**DO create new tables for:**
- Explicit coach ↔ client assignments (not previously tracked)
- Organization metadata (orgs don't exist in Pathway)
- Billing/usage (new business entity)
- Branding (new business entity)
- Activity audit trails (new compliance entity)

---

## 4. Specific Table Ownership for owner-coach-detail.html

| Section | Table | Owner | Type | Reason |
|---------|-------|-------|------|--------|
| **Header** | usuarios | Pathway | Existing (extended) | Coach name, email, avatar (new column) |
| **Sidebar: Estado Actual** | usuarios | Pathway | Existing (extended) | Status, capacity (new), joined date |
| **Sidebar: Performance** | sesiones_registro | Pathway | Existing | NPS calculated from nps_coach (new column) |
| **Sidebar: Performance** | candidatos | Pathway | Existing | Retention % calculated from status |
| **Sidebar: Performance** | informes | Pathway | Existing | Completion % calculated from status |
| **Sidebar: Sesiones** | sesiones_registro | Pathway | Existing | Session count from this table |
| **Tab: Clientes** | coach_client_assignments | MultiCoach | New | Explicit coach ↔ client mapping |
| **Tab: Clientes** | candidatos | Pathway | Existing | Client names, emails, roles |
| **Tab: Métricas** | sesiones_registro, candidatos, informes | Pathway | Existing (aggregated) | All metrics calculated, not stored |
| **Tab: Actividad** | audit_logs | MultiCoach | New | Activity events (audit trail) |
| **Tab: Actividad** | sesiones_registro | Pathway | Existing | Recent sessions for synthetic activity |

**Summary:**
- Pathway tables: 6 (usuarios, candidatos, sesiones_registro, informes, cv_publicados, etc.) — extended with columns, not duplicated
- MultiCoach tables: 2 (coach_client_assignments, audit_logs) — new entities only
- Calculated data: 5 metrics — computed per request, never stored
- Views: None for this page (calculations done in Edge Function)

---

## 5. Migration Strategy (Pathway Data Integrity)

### Phase 0 Week 1: Add Columns, Don't Delete

```sql
-- Step 1: Add org_id to Pathway tables (nullable, to be populated)
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id);
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS avatar CHAR(2);
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS especialidad VARCHAR(100);
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS capacity INT DEFAULT 10;

ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id);

ALTER TABLE sesiones_registro ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id);
ALTER TABLE sesiones_registro ADD COLUMN IF NOT EXISTS nps_coach DECIMAL(2,1);

ALTER TABLE informes ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id);

-- Step 2: Create NEW MultiCoach tables (independent of Pathway schema)
CREATE TABLE coach_client_assignments (...);
CREATE TABLE audit_logs (...);
CREATE TABLE organizations (...);
CREATE TABLE organizations_billing (...);
CREATE TABLE organization_branding (...);

-- Step 3: Backfill org_id in Pathway tables (safe: no data deletion)
UPDATE usuarios SET org_id = (SELECT id FROM organizations LIMIT 1) WHERE rol = 'coach';
UPDATE candidatos SET org_id = (SELECT org_id FROM usuarios u WHERE u.id = coach_id LIMIT 1);
-- etc.

-- Step 4: Enable RLS on Pathway tables (now partitioned by org)
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidatos ENABLE ROW LEVEL SECURITY;
ALTER TABLE sesiones_registro ENABLE ROW LEVEL SECURITY;
-- etc.

-- NO STEP: Delete data (we never do this)
```

**Rollback Plan:**
- If org_id column causes issues: `ALTER TABLE usuarios DROP COLUMN org_id;` (reversible)
- If data backfill wrong: Restore from backup, try again
- If RLS too strict: Disable with `ALTER TABLE usuarios DISABLE ROW LEVEL SECURITY;` (reversible)

---

## 6. Avoiding Data Duplication: Enforcement Rules

### Rule 1: No Denormalization Without Approval

- ❌ Don't create `coach_metrics_cache` table to avoid recalculating NPS
- ✅ DO cache in Redis (transient, not Supabase table)
- ✅ DO create materialized view if query is slow (refresh on schedule, documented)

### Rule 2: Pathway Tables Are Read-Only (from MultiCoach perspective)

- ✅ MultiCoach CAN read usuarios, candidatos, sesiones_registro, informes
- ❌ MultiCoach CANNOT write to usuarios, candidatos, sesiones_registro, informes (except to add org_id, avatar, etc. columns)
- ✅ MultiCoach writes only to: organizations, coach_client_assignments, organizations_billing, organization_branding, audit_logs

### Rule 3: Calculated Data Is Never Stored

- ✅ NPS, retention, completion rates are calculated in Edge Functions (stateless)
- ❌ Don't store these in a cache table without marking it as derived
- ✅ If caching is needed (performance), use Redis or materialized view with explicit refresh schedule

### Rule 4: Audit Log Is Not a Duplicate of Pathway Events

- ✅ audit_logs stores: WHO did WHAT WHEN (user_id, action, created_at)
- ❌ audit_logs does NOT duplicate: session data, client data, coach data
- ✅ audit_logs can REFERENCE: resource_id (UUID of user/client/coach affected)

---

## 7. Data Ownership Checklist for Phase 0

Before implementing each table:

- [ ] **usuarios (Pathway extended):** Confirm org_id, avatar, especialidad, last_login, capacity are ADD only (no DELETE/MODIFY of existing columns)
- [ ] **candidatos (Pathway extended):** Confirm org_id is ADD only
- [ ] **sesiones_registro (Pathway extended):** Confirm org_id, nps_coach are ADD only
- [ ] **informes (Pathway extended):** Confirm org_id is ADD only
- [ ] **coach_client_assignments (NEW):** Confirm it does NOT duplicate coach/client data, only maps IDs
- [ ] **audit_logs (NEW):** Confirm it does NOT store session/client/coach details, only references IDs + actions
- [ ] **organizations (NEW):** Confirm it is MultiCoach-only (no Pathway equivalent)
- [ ] **organizations_billing (NEW):** Confirm it is MultiCoach-only
- [ ] **organization_branding (NEW):** Confirm it is MultiCoach-only

---

## 8. Single Source of Truth Locations

| Data | Source of Truth | Backup Reads | Never Stored In |
|------|---|---|---|
| Coach identity (name, email) | Pathway: usuarios | MultiCoach audit logs (reference only) | ❌ Not copied to MultiCoach |
| Coach ratings (NPS) | Pathway: sesiones_registro (nps_coach column) | MultiCoach cache (redis) | ❌ Not stored in MultiCoach tables |
| Client identity | Pathway: candidatos | MultiCoach assignments (reference only) | ❌ Not copied |
| Client progress | Pathway: candidatos (progreso column) | MultiCoach UI (real-time) | ❌ Not cached permanently |
| Coach ↔ Client mapping | MultiCoach: coach_client_assignments | Pathway audit (inferred from sesiones) | ✅ MultiCoach is primary here |
| Organization | MultiCoach: organizations | — | ✅ MultiCoach is primary (doesn't exist in Pathway) |
| Billing/usage | MultiCoach: organizations_billing | — | ✅ MultiCoach is primary |
| Activity audit trail | MultiCoach: audit_logs | — | ✅ MultiCoach is primary |
| Branding | MultiCoach: organization_branding | — | ✅ MultiCoach is primary |

---

## Summary

**Ownership Model for owner-coach-detail.html:**

| Layer | Source | Duplication Risk | Prevention |
|-------|--------|---|---|
| **Display Data** | Pathway (usuarios, candidatos, informes) | None | Partitioned by org_id, RLS filters, no write access |
| **Measurements** | Pathway (sesiones_registro) | None | Calculated on-demand, never stored in MultiCoach |
| **Mappings** | MultiCoach (coach_client_assignments) | N/A | New table, doesn't duplicate Pathway IDs |
| **Audit Trail** | MultiCoach (audit_logs) | None | Stores actions + references, not data copies |

**No data duplication occurs.** MultiCoach extends Pathway for partitioning and adds new entities. All calculations are stateless (Edge Functions).

