# Project Structure & Source of Truth

**Goal:** Single source of truth for Architecture, Frontend, and Product Design. Clear ownership of each artifact type.

---

## 1. Directory Structure

```
/analisisform/
├── 📄 CLAUDE.md                                    # Project context (MASTER DOCUMENT)
├── 📄 README.md                                    # Deployment + quickstart
│
├── 📁 /docs/
│   ├── EPIC_2_TECHNICAL_ARCHITECTURE.md            # ← ARCHITECTURE BIBLE (5 sections)
│   ├── PHASE_0_IMPLEMENTATION_PLAN.md              # ← PHASE 0 SPEC (SQL + RLS + Edge Functions)
│   ├── DATA_OWNERSHIP_MODEL.md                     # ← DATA INTEGRITY GUIDE (THIS FILE)
│   ├── PROJECT_STRUCTURE.md                        # ← ORG GUIDE (THIS FILE)
│   ├── READINESS_SUMMARY.md                        # ← STATUS DASHBOARD
│   ├── OWNER_COACH_DETAIL_SPEC.md                  # ← PAGE-LEVEL SPECS (per page)
│   └── icon-system.md                              # Existing: Icon spec
│
├── 📁 /multicoach/
│   ├── 📁 /pages/
│   │   ├── owner-coaches.html                      # ← Frontend page
│   │   ├── owner-coach-detail.html                 # ← Frontend page (detailed spec in docs/)
│   │   ├── owner-clients.html
│   │   ├── owner-client-detail.html
│   │   ├── owner-programs.html
│   │   ├── owner-analytics.html
│   │   ├── owner-billing.html
│   │   ├── owner-brand.html
│   │   └── owner-settings.html
│   │
│   ├── 📁 /styles/
│   │   ├── base.css                                # ← Design System (colors, typography, spacing)
│   │   ├── components.css                          # ← Reusable components (buttons, cards, etc.)
│   │   └── layout.css                              # ← Layout grid, responsive, sidebar
│   │
│   ├── 📁 /js/
│   │   ├── mock-data.js                            # ← Mock data (5 coaches, 10 clients, 4 programs)
│   │   ├── utils.js                                # ← Utility functions (formatDate, getStatusLabel, etc.)
│   │   └── components.js                           # ← Reusable JS components (Modal, Tabs, Toast, etc.)
│   │
│   └── index.html                                  # Entry point (if needed)
│
├── 📁 /supabase/
│   ├── 📁 /migrations/                             # ← SQL MIGRATIONS (source of truth for schema)
│   │   ├── 001_organizations.sql                   # Phase 0 Week 1
│   │   ├── 002_usuarios_extend.sql                 # Phase 0 Week 1
│   │   ├── 003_coach_client_assignments.sql        # Phase 0 Week 1
│   │   ├── 004_organizations_billing.sql           # Phase 0 Week 1
│   │   ├── 005_organization_branding.sql           # Phase 0 Week 1
│   │   ├── 006_audit_logs.sql                      # Phase 0 Week 1
│   │   ├── 007_rls_policies.sql                    # Phase 0 Week 1
│   │   ├── 008_seed_test_data.sql                  # Phase 0 Week 1
│   │   └── 009_materialized_views.sql              # Phase 0 Week 2 (if needed)
│   │
│   ├── 📁 /functions/                              # ← EDGE FUNCTIONS (backend API)
│   │   ├── 📁 /verify-user-org/                    # Base auth middleware
│   │   │   └── index.ts
│   │   ├── 📁 /get-user-org/                       # Lookup org_id from JWT
│   │   │   └── index.ts
│   │   ├── 📁 /fetch-coach-detail/                 # ← Phase 1 (owner-coach-detail integration)
│   │   │   └── index.ts
│   │   ├── 📁 /fetch-coach-metrics/                # Phase 1 (metrics aggregation)
│   │   │   └── index.ts
│   │   ├── 📁 /fetch-coaches-list/                 # Phase 1 (coach roster)
│   │   │   └── index.ts
│   │   ├── 📁 /fetch-org-kpis/                     # Phase 1 (dashboard KPIs)
│   │   │   └── index.ts
│   │   └── (more functions per phase)
│   │
│   └── 📁 /types/                                  # ← TypeScript types (shared models)
│       ├── organizations.ts
│       ├── coaches.ts
│       ├── clients.ts
│       └── common.ts
│
├── 📁 /scripts/                                    # Build & validation
│   ├── check-syntax.js                             # Existing: JS validation
│   ├── check-guardrails.js                         # Existing: Security checks
│   └── deploy.sh                                   # Deployment script
│
├── 📁 /.github/
│   └── 📁 /workflows/
│       ├── syntax-check.yml                        # Existing: CI pipeline
│       └── deploy.yml                              # Deployment automation
│
└── 📄 .gitignore, package.json, cloudflare.toml, etc.
```

---

## 2. Artifact Ownership & Responsibility

### 2.1 Architecture Documents (in `/docs/`)

**Owner:** Architecture Team  
**Audience:** Frontend, Backend, Product, Design  
**Responsibility:** Keep current with design decisions, maintain consistency across phases

| Document | Purpose | Audience | Authority | Update Frequency |
|----------|---------|----------|-----------|---|
| `EPIC_2_TECHNICAL_ARCHITECTURE.md` | System design, entities, API specs (60+ endpoints), integration roadmap, risks | Everyone | Architecture | Per phase (before implementation) |
| `PHASE_0_IMPLEMENTATION_PLAN.md` | Week 1-2 execution plan, SQL schema, RLS policies, Edge Functions, implementation sequence | Backend + QA | Architecture | Before Phase 0 start |
| `DATA_OWNERSHIP_MODEL.md` | Data integrity model, prevent duplication, Pathway partitioning strategy | Backend + Architecture | Architecture | Per new table (before migration) |
| `PROJECT_STRUCTURE.md` | Directory organization, source of truth locations, artifact ownership | Everyone | Architecture | As repo grows |
| `READINESS_SUMMARY.md` | Status dashboard, go/no-go criteria, deliverables | Everyone | Architecture | Per phase completion |
| `OWNER_COACH_DETAIL_SPEC.md` | Page-level spec (data model, API contract, Edge Function, integration checklist) | Frontend + Backend | Architecture | Per page integration |

**Rule:** Architecture docs are BEFORE implementation. No "discover during code" changes.

---

### 2.2 SQL Migrations (in `/supabase/migrations/`)

**Owner:** Backend Team  
**Responsibility:** Schema management, data integrity, RLS policies, rollback plans

| File | Purpose | Executes In | Dependencies |
|------|---------|---|---|
| `001_organizations.sql` | Create organizations table (multi-tenant root) | Supabase DB | None |
| `002_usuarios_extend.sql` | Add org_id, avatar, especialidad, last_login, capacity to usuarios | Supabase DB | 001 |
| `003_coach_client_assignments.sql` | Create coach_client_assignments (explicit mapping) | Supabase DB | 001, 002 |
| `004_organizations_billing.sql` | Create organizations_billing (usage + plan) | Supabase DB | 001 |
| `005_organization_branding.sql` | Create organization_branding (white-label) | Supabase DB | 001 |
| `006_audit_logs.sql` | Create audit_logs (activity trail) | Supabase DB | 001 |
| `007_rls_policies.sql` | Enable RLS on all tables, create policies | Supabase DB | 001-006 |
| `008_seed_test_data.sql` | Backfill test org, coaches, clients | Supabase DB | 001-007 |
| `009_materialized_views.sql` (optional) | Create cached aggregation views | Supabase DB | 001-008 |

**Execution Order:**
1. Run locally (test for errors)
2. Test RLS policies (verify isolation)
3. Run on staging (validate data)
4. Run on production (backup before)

**Rollback:** Each migration includes a `DOWN` section for reversibility.

---

### 2.3 Edge Functions (in `/supabase/functions/`)

**Owner:** Backend Team  
**Responsibility:** API implementation, request validation, RLS enforcement

| Folder | Function | Handler | Calls | API Endpoint | Execution |
|--------|----------|---------|-------|---|---|
| `/verify-user-org/` | Auth middleware | `index.ts` | usuarios table | `POST /verify-user-org` | Supabase Edge Functions |
| `/get-user-org/` | Org lookup | `index.ts` | usuarios table | `POST /get-user-org` | Supabase Edge Functions |
| `/fetch-coach-detail/` | Coach profile + metrics + clients + activity | `index.ts` | usuarios, sesiones_registro, candidatos, coach_client_assignments, audit_logs | `GET /api/organization/{org_id}/coaches/{coach_id}` | Supabase Edge Functions |
| `/fetch-coach-metrics/` | Metrics aggregation (helper) | `index.ts` | sesiones_registro, candidatos, informes | Callable from fetch-coach-detail | Supabase Edge Functions |
| (more per phase) | ... | ... | ... | ... | ... |

**Deployment:**
```bash
supabase functions deploy fetch-coach-detail --no-verify-jwt
```

**Testing:**
```bash
curl -X GET "http://localhost:54321/functions/v1/fetch-coach-detail?org_id=org-001&coach_id=coach-001" \
  -H "Authorization: Bearer <test_jwt>"
```

---

### 2.4 Frontend Pages (in `/multicoach/pages/`)

**Owner:** Frontend Team  
**Responsibility:** HTML structure, CSS styling, JS interactivity

| Page | Purpose | Spec Doc | Data Source | Status |
|------|---------|----------|---|---|
| `owner-coaches.html` | Coach roster | (TODO: owner-coaches-spec.md) | Mock: COACHES | Frontend complete, spec pending |
| `owner-coach-detail.html` | Coach profile detail | OWNER_COACH_DETAIL_SPEC.md | Mock: COACHES[detail] | Frontend complete, spec complete, ready for Phase 0 |
| `owner-clients.html` | Client roster | (TODO) | Mock: CLIENTS | Frontend complete, spec pending |
| `owner-client-detail.html` | Client profile detail | (TODO) | Mock: CLIENTS[detail] | Frontend complete, spec pending |
| `owner-programs.html` | Program management | (TODO) | Mock: PROGRAMS | Frontend complete, spec pending |
| `owner-analytics.html` | KPIs + charts | (TODO) | Mock: ANALYTICS_DATA | Frontend complete, spec pending |
| `owner-billing.html` | Plan + usage | (TODO) | Mock: BILLING_DATA | Frontend complete, spec pending |
| `owner-brand.html` | Branding editor | (TODO) | Mock: ORGANIZATION | Frontend complete, spec pending |
| `owner-settings.html` | Org settings | (TODO) | Mock: ORGANIZATION | Frontend complete, spec pending |

**Spec Per Page:** Each page gets a detailed spec doc in `/docs/` (e.g., OWNER_COACH_DETAIL_SPEC.md) before backend integration.

**Integration Process:**
1. Frontend renders with mock data ✅ (done)
2. Architecture spec defines backend contract (per page)
3. Backend implements Edge Functions
4. Frontend swaps mock imports for API calls
5. A/B test mock vs real data (ensure parity)
6. Deploy to production

---

### 2.5 Design System (in `/multicoach/styles/` + `/multicoach/js/`)

**Owner:** Product Design + Frontend  
**Responsibility:** Consistency across all pages, component library

| File | Content | Scope | Authority |
|------|---------|-------|-----------|
| `base.css` | CSS variables (colors, typography, spacing, shadows, z-index), reset, utilities | All pages | Design System |
| `components.css` | Reusable components (buttons, cards, KPI cards, badges, avatars, progress bars, tabs, modals, toasts, etc.) | All pages | Design System |
| `layout.css` | Grid, sidebar, header, responsive breakpoints | All pages | Design System |
| `mock-data.js` | Test data (5 coaches, 10 clients, 4 programs, KPIs) | Frontend testing | Backend (mirrored in Supabase seed) |
| `utils.js` | Utility functions (formatDate, getStatusLabel, calcPercentage, etc.) | All pages | Frontend |
| `components.js` | JS components (Modal, Drawer, Tabs, Toast, Loading, Search, Filter, etc.) | All pages | Frontend |

**Contract:** Design System must be frozen before Phase 0 implementation starts.

---

### 2.6 Shared Types (in `/supabase/types/`)

**Owner:** Backend Team (TypeScript/Edge Functions)  
**Responsibility:** API contracts, shared data models

| File | Exports | Used By | Authority |
|------|---------|---------|-----------|
| `organizations.ts` | Organization, OrganizationBilling, OrganizationBranding | Edge Functions, Frontend (via JSON) | Backend |
| `coaches.ts` | Coach, CoachMetrics, CoachAssignment | Edge Functions, Frontend (via JSON) | Backend |
| `clients.ts` | Client, ClientRisk, ClientAssignment | Edge Functions, Frontend (via JSON) | Backend |
| `common.ts` | APIResponse, ErrorResponse, PaginationParams, QueryFilters | All Edge Functions | Backend |

**Example (coaches.ts):**
```typescript
export interface Coach {
  id: UUID;
  name: string;
  email: string;
  avatar: string;
  specialty: string;
  status: "active" | "inactive" | "paused";
  joinedAt: ISO8601;
  lastActive: ISO8601;
  clientsAssigned: number;
  capacity: number;
  org_id: UUID;
}

export interface CoachMetrics {
  nps: number;
  retentionRate: number;
  completionRate: number;
  avgDuration: number;
  sessionCount: number;
  totalProgramsCompleted: number;
  utilizationPercent: number;
}
```

**Frontend receives JSON matching these types** (no TypeScript in browser, but ensures API contract is clear).

---

## 3. Source of Truth Locations

### 3.1 For Architecture Decisions

| Decision | Source | Rationale |
|----------|--------|-----------|
| "What are the 10 logical entities?" | EPIC_2_TECHNICAL_ARCHITECTURE.md (Section 2) | Single design doc before code |
| "What's the API endpoint for coach detail?" | OWNER_COACH_DETAIL_SPEC.md (Section 3.1) | Page-level spec doc |
| "What Supabase tables do we need?" | PHASE_0_IMPLEMENTATION_PLAN.md (Section 1.1) | Execution plan |
| "What data should be in MultiCoach vs Pathway?" | DATA_OWNERSHIP_MODEL.md (Section 1) | Data integrity guide |

**Rule:** All decisions documented BEFORE coding.

---

### 3.2 For Data Models

| Model | Source | Audience | Authority |
|-------|--------|----------|-----------|
| Coach profile (name, email, avatar, status) | usuarios table | Frontend + Backend | Pathway (Supabase) |
| Coach metrics (NPS, retention, completion) | Edge Function aggregation (not stored) | Frontend | Backend (calculated real-time) |
| Coach ↔ Client mapping | coach_client_assignments table | Frontend + Backend | MultiCoach (new) |
| Organization | organizations table | Frontend + Backend | MultiCoach (new) |

**Rule:** Never duplicate. Always link to source.

---

### 3.3 For Frontend Implementation

| Artifact | Source | Audience | Authority |
|----------|--------|----------|-----------|
| Page structure (HTML) | `/multicoach/pages/owner-*.html` | Designers, Product, Frontend | Frontend Team |
| Styling (CSS) | `/multicoach/styles/` | Designers, Product, Frontend | Design System |
| Data requirements | `/docs/OWNER_*_SPEC.md` (per page) | Backend, Frontend | Architecture |
| Mock data | `/multicoach/js/mock-data.js` | Frontend | Backend (mirrors seed data) |

**Rule:** Frontend implements from spec docs, not from guessing.

---

### 3.4 For Backend Implementation

| Artifact | Source | Audience | Authority |
|----------|--------|----------|-----------|
| API endpoints | `/docs/PHASE_0_IMPLEMENTATION_PLAN.md` + page specs | Frontend, Backend | Architecture |
| SQL schema | `/supabase/migrations/` | Backend, DevOps | Backend Team |
| RLS policies | `/supabase/migrations/007_rls_policies.sql` | Backend, Security | Architecture + Backend |
| Edge Functions | `/supabase/functions/` | Backend | Backend Team |
| TypeScript types | `/supabase/types/` | Edge Functions | Backend |

**Rule:** Backend implements from architecture docs, uses spec docs for contracts.

---

## 4. Workflow: Architecture → Implementation

### Phase 0 Workflow

```
Week 1:
┌─ Architecture (frozen) ──────────────────────────────┐
│ ✓ EPIC_2_TECHNICAL_ARCHITECTURE.md                  │
│ ✓ PHASE_0_IMPLEMENTATION_PLAN.md                     │
│ ✓ DATA_OWNERSHIP_MODEL.md                            │
│ ✓ OWNER_COACH_DETAIL_SPEC.md (first page)           │
└─ All docs reviewed + approved ──────────────────────┘
                    │
                    ▼ (No changes to architecture docs)
┌─ Backend: SQL + RLS ─────────────────────────────────┐
│ • Apply migrations (/supabase/migrations/001-008)    │
│ • Test RLS policies locally                          │
│ • Seed test data                                     │
│ • Verify cross-org isolation (no leaks)              │
└──────────────────────────────────────────────────────┘
                    │
                    ▼
┌─ Backend: Edge Functions ────────────────────────────┐
│ • Deploy verify-user-org, get-user-org              │
│ • Deploy fetch-coach-detail (per SPEC.md)            │
│ • Test locally (mock JWT + data)                     │
└──────────────────────────────────────────────────────┘
                    │
                    ▼
┌─ Frontend: Mock → Real ──────────────────────────────┐
│ • Update owner-coach-detail.html (per SPEC.md)       │
│ • Call /api/organization/{org_id}/coaches/{id}       │
│ • A/B test: mock data vs real data                   │
│ • Verify UI identical, no regressions                │
│ • Merge mock-data.js removal                         │
└──────────────────────────────────────────────────────┘
                    │
                    ▼
┌─ QA: Validation ─────────────────────────────────────┐
│ • Test permissions (owner vs admin vs coach)         │
│ • Test cross-org isolation (org-001 ≠ org-002)       │
│ • Test with real Pathway data                        │
│ • Load test (performance)                            │
│ • Sign off: Ready for Phase 1                        │
└──────────────────────────────────────────────────────┘
```

**Key:** Architecture docs are frozen and authoritative. Backend implements from docs. Frontend integrates per spec. QA validates against docs.

---

## 5. Responsibilities & RACI

| Task | Responsible | Accountable | Consulted | Informed |
|------|---|---|---|---|
| Architecture & Design Docs | Architecture | Architecture | Everyone | Everyone |
| Frontend HTML/CSS/JS | Frontend | Frontend | Architecture | Product |
| SQL Schema & Migrations | Backend | Backend | Architecture | DevOps |
| Edge Functions | Backend | Backend | Architecture | Frontend |
| RLS Policies & Security | Backend + Security | Backend | Architecture | DevOps |
| API Contracts | Architecture | Architecture | Backend + Frontend | Everyone |
| Page-Level Specs | Architecture | Architecture | Frontend + Backend | Product |
| Testing & QA | QA | QA | Backend + Frontend | Everyone |
| Deployment | DevOps | DevOps | Backend | Everyone |

---

## 6. Documentation Checklist Before Phase 0

Before Week 1 begins, verify:

- [ ] `EPIC_2_TECHNICAL_ARCHITECTURE.md` reviewed (60+ endpoints approved)
- [ ] `PHASE_0_IMPLEMENTATION_PLAN.md` reviewed (SQL + RLS policies approved)
- [ ] `DATA_OWNERSHIP_MODEL.md` reviewed (no data duplication confirmed)
- [ ] `PROJECT_STRUCTURE.md` reviewed (artifact ownership clear)
- [ ] `OWNER_COACH_DETAIL_SPEC.md` reviewed (backend contract approved)
- [ ] (More) `OWNER_*_SPEC.md` docs created for remaining pages (before implementing each)
- [ ] Architecture docs marked as "Approved for Phase 0"
- [ ] Team knows: Docs are frozen once implementation starts

---

## 7. Change Management

### During Implementation (Week 1-2)

**If architecture needs change:** 
1. Document the issue (JIRA/GitHub issue)
2. Propose change in architecture doc (PR)
3. Get approval from Architecture Lead
4. Update related spec docs
5. Re-baseline timeline if needed
6. Communicate to team

**Don't:** Make changes in code and discover them later.

### Post-Phase 0

- Architecture docs update per phase (Phase 1, Phase 2, etc.)
- Page-level specs added per page integration
- Types and migrations committed together with Edge Functions

---

## Summary

**Single Source of Truth:**
- **Architecture:** `/docs/*.md` (EPIC_2, PHASE_0, DATA_OWNERSHIP, PROJECT_STRUCTURE, page specs)
- **SQL Schema:** `/supabase/migrations/` (version controlled)
- **API Contracts:** Edge Functions + TypeScript types
- **Frontend:** `/multicoach/pages/` + `/multicoach/styles/` + `/multicoach/js/`

**Everyone works from:** Architecture docs (approved, frozen per phase)

**No duplicated artifacts:** One spec, one implementation, one source of truth.

