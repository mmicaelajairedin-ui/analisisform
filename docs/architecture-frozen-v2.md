# Frozen Architecture v2 — MultiCoach Platform Core

**Locked by**: Product Owner (Sprint Consolidación)  
**Effective Date**: 2026-08  
**Next Review**: After Sprint 2 (Agenda module integration)

---

## Executive Summary

MultiCoach v3 Core (Organización, Equipo, Clientes) is **frozen** as the canonical foundation for all future development. This document defines:

1. **What is locked** (Core modules, no feature changes)
2. **What is reusable** (Design System v1, Permissions model, Component helpers)
3. **What is mandatory** (Rules, patterns, constraints)
4. **How to extend it** (Template for future modules)

**Status**: Core is production-ready. All future development (Agenda, Programas, Analytics, Comunidad) must be built ON TOP of this frozen core, not modify it.

---

## 1. Locked Modules (No Features / Bug Fixes Only)

### 1.1 Organización Module
**Scope**: Organization setup, multi-tenancy baseline  
**Locked**: Org context, owner role, basic team structure  
**No changes allowed**: Org_id isolation, role hierarchy  
**Bug fixes only**: Permission gating, data leaks, UI glitches

**Responsibilities**:
- Define org_id as primary partition key for all data
- Establish Owner as minimum viable role
- Provide multi-tenant isolation layer

**Database Tables**:
- `organizaciones` (org_id, nombre, fecha_creacion)
- Key constraint: All child tables require `org_id` FK

**Frozen at**: Line 1197+ (loadEquipo queries org_id filter)

---

### 1.2 Equipo Module
**Scope**: Team member management (coaches, owners, colaboradores)  
**Locked**: CRUD operations (add, edit, change role, remove), capacity tracking  
**No changes allowed**: Business rules (min 1 owner, no duplicates, no clients without coaches)  
**Bug fixes only**: Permission enforcement, UI responsiveness, modal flows

**7 Operations** (locked):
1. `equipo:view` — View team members (with capacity)
2. `equipo:invite` — Add member to org
3. `equipo:edit` — Update name, email, specialty
4. `equipo:change_role` — Promote/demote (enforces min 1 owner)
5. `equipo:configure_perms` — Set custom permissions (colaboradores only)
6. `equipo:deactivate` — Toggle active/inactive (prevents with assigned clients)
7. `equipo:remove` — Remove from org (prevents with assigned clients)

**Database Tables**:
- `usuarios` (id, org_id, email, rol, configuracion JSON, activo, client_count COUNT)
- Invariant: `client_count` updated on every client assignment/removal

**Data Schema**:
```javascript
usuario = {
  id: uuid,
  org_id: uuid (FK → organizaciones),
  email: string (unique per org),
  nombre: string,
  email_verificado: boolean,
  rol: enum('owner', 'coach', 'colaborador'),
  activo: boolean,
  especialidad?: string (nullable),
  configuracion: {
    permisos: {
      ver_clientes: boolean,
      editar_clientes: boolean,
      ver_reportes: boolean
    }
  },
  client_count: integer (count of candidatos.coach_id = usuario.id in this org),
  created_at: timestamp,
  updated_at: timestamp
}
```

**Frozen at**: Line 1450-1850 (Equipo CRUD functions)

---

### 1.3 Clientes Module
**Scope**: Client/candidate management under coaches  
**Locked**: CRUD operations (create, edit, assign coach, deactivate), 3-step wizard  
**No changes allowed**: Business rule (no client without coach), capacity checking  
**Bug fixes only**: Wizard flow, coach recommendation algorithm, UI issues

**7 Operations** (locked):
1. `clientes:view` — View client list with filters (role-based)
2. `clientes:create` — Create via 3-step wizard (email validation → coach recommendation → confirmation)
3. `clientes:edit` — Update name, email (no coach change here; see operation 4)
4. `clientes:change_coach` — Reassign to different coach (capacity check)
5. `clientes:reassign_bulk` — Bulk reassign multiple clients to one coach
6. `clientes:deactivate` — Toggle active/inactive
7. `clientes:view_cartera` — See coach's portfolio (all clients assigned to them)

**Database Tables**:
- `candidatos` (id, org_id, coach_id NOT NULL, email, nombre, activo, created_at, updated_at)
- Invariant: `coach_id` is NEVER NULL (enforced in wizard + validation)

**Data Schema**:
```javascript
cliente = {
  id: uuid,
  org_id: uuid (FK → organizaciones),
  email: string (unique per org),
  nombre: string,
  coach_id: uuid NOT NULL (FK → usuarios where rol IN ('coach', 'owner')),
  activo: boolean,
  created_at: timestamp,
  updated_at: timestamp
}
```

**Wizard** (locked 3-step flow):
1. **Step 1**: Email validation (required) + optional name
2. **Step 2**: Coach recommendation engine (shows best coach by capacity) + manual selection
3. **Step 3**: Confirmation (review email, coach, name) + create

**Frozen at**: Line 2000-2800 (Clientes CRUD + wizard functions)

---

## 2. Reusable Components (Design System v1)

### 2.1 Component Library
**Source**: `docs/design-system-v1.md` (700+ lines, locked)  
**Status**: Canonical reference for ALL future UI

**Must Use** (Non-negotiable):
- `.btn-primary`, `.btn-secondary` → No inline button styles
- `.stat-card` → No custom stat rendering
- `.badge` (active/inactive/warning/danger) → No status colors elsewhere
- `.drawer` + `.drawer-overlay` structure → No custom modals
- `.capacity-bar` → No alternative progress visualization
- `.card` container → No custom card styling
- Responsive breakpoints: 480px, 768px, 1200px+ (no others)

**Color Palette** (immutable):
- Primary text: `#333`
- Secondary text: `#999`
- Background: `#fff`, `#f5f5f5`
- Success: `#2e7d32` (green)
- Warning: `#f57c00` (orange)
- Error: `#d32f2f` (red)
- Border: `#e0e0e0`, `#ddd`

**Typography**:
- Font stack: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
- Body: 14px (desktop), 13px (tablet), 13px (mobile)
- Labels: 12px (desktop), 11px (tablet), 10px (mobile)
- Headings: scale from H1 20px → H3 16px

**Spacing Scale**:
- XS: 4px | SM: 8px | MD: 12px | LG: 16px | XL: 20px | XXL: 24px

---

### 2.2 Helper Functions (JavaScript)
**Source**: `multicoach.html` lines ~1448-1500 (locked)  
**Usage**: All future modules must use these helpers

**Render Helpers** (Must use):
```javascript
renderEmptyState(emoji, title, description, ctaText, ctaHandler)
→ Unified empty state for all sections

renderStats(statsData)
→ statsData = [{label, value}, ...]

renderBadge(status)
→ status = 'activo' | 'inactivo' | 'atrasado' | 'error'

renderCapacityBar(percent, fillId, textId)
→ Returns HTML: capacity progress bar
```

**Utility Helpers** (Must use):
```javascript
getCapacity(member)
→ Returns object: {percent, color, emoji}

getCapacityIndicator(percent)
→ Returns emoji: 🟢 | 🟡 | 🔴

getCapacityColor(percent)
→ Returns CSS class: 'success' | 'warning' | 'danger'

esc(str)
→ HTML escape (XSS prevention)

showError(section, message)
→ Display error message in section
```

---

## 3. Mandatory Rules & Constraints

### 3.1 Organization Isolation (CRITICAL)
**Rule**: Every query MUST filter by `org_id = currentOrgId`

**Implementation** (non-negotiable):
```javascript
// ❌ WRONG
const { data } = await sb.from('usuarios').select('*');

// ✅ RIGHT
const { data } = await sb
  .from('usuarios')
  .select('*')
  .eq('org_id', currentOrgId);
```

**Applied to ALL tables**:
- usuarios (required)
- candidatos (required)
- Any future tables (required)

**RLS Protection**: Supabase RLS policies enforce this at database layer (defense in depth)

---

### 3.2 Data Integrity (Client-Coach Binding)
**Rule**: Client `coach_id` is NEVER NULL

**Where enforced**:
1. **Wizard**: Last step requires coach selection before creating
2. **Validation**: `updateClienteCoach()` rejects empty coach_id (line 1361)
3. **Database**: `coach_id NOT NULL` column constraint
4. **UI**: Dropdown never shows "Sin coach" option (line 2127)

**Exception**: None. Every client must have a coach.

---

### 3.3 Capacity Limits (Optional, but recommended)
**Rule**: Show visual warnings, don't hard-block

**Capacity Tiers**:
- Owner: 120 clients (no limit enforced)
- Coach: 45 clients (visual only, not hard-blocked)
- Colaborador: Cannot have clients (enforced by role)

**Implementation**:
```javascript
function getCapacity(member) {
  const limit = member.rol === 'owner' ? 120 : 45;
  const percent = (member.client_count / limit) * 100;
  return {
    percent,
    color: percent < 80 ? 'success' : percent < 100 ? 'warning' : 'danger',
    emoji: percent < 80 ? '🟢' : percent < 100 ? '🟡' : '🔴'
  };
}
```

---

### 3.4 Role Hierarchy (CRITICAL)
**Rule**: Cannot demote/promote above your own role

**Owner**:
- Can manage everything
- Cannot remove last owner (enforced: line 1688)

**Coach**:
- Cannot manage team members
- Can only view/edit own clients
- Cannot create teams, change permissions

**Colaborador**:
- Cannot have clients
- Cannot manage team
- Can only view/edit what custom permissions allow

---

### 3.5 Member Removal & Deactivation
**Rule**: Cannot remove/deactivate if member has assigned clients

**Enforcement** (3 layers):
1. **UI**: Button checks `member.client_count > 0` (line 1598-1608)
2. **Validation**: Backend validation before Supabase write
3. **RLS**: Database policy prevents write if clients exist (future)

**Flow if blocked**:
1. User clicks "Quitar" → error dialog
2. Must click "Reasignar clientes" first
3. Complete reassignment wizard
4. Return to member drawer
5. Click "Quitar" again (now allowed)

---

## 4. Permissions System (Mandatory)

### 4.1 Permission Matrix
**Source**: `docs/permissions-model.md` (locked)

**Actions** (17 total):
- Equipo: 7 actions (view, invite, edit, change_role, configure_perms, deactivate, remove)
- Clientes: 7 actions (view, create, edit, change_coach, reassign_bulk, deactivate, view_cartera)
- Personas: 3 actions (view, detail, filter_by_coach)

**Role-Based Access**:
```
Owner:     ✓ all actions
Coach:     ✓ view/create/edit own clients, view team
Colaborador: ✓ custom permissions only (ver_clientes, editar_clientes, ver_reportes)
```

### 4.2 Permission Gating (Required for All Operations)
**Pattern**: Check permission at 3 points:

1. **Load gating**: Before loading data
   ```javascript
   if (!canAction('equipo:view')) {
     showError('section', 'No tienes permiso');
     return;
   }
   ```

2. **UI gating**: Before showing button/action
   ```javascript
   if (canAction('equipo:invite')) {
     html += '<button onclick="...">+ Invitar</button>';
   }
   ```

3. **Submission gating**: Before Supabase write
   ```javascript
   if (!canAction('equipo:edit', {memberId})) {
     showError('modal', 'Permission denied');
     return;
   }
   ```

### 4.3 Custom Permissions (Colaborador Only)
**Stored in**: `usuario.configuracion.permisos` JSON

```javascript
configuracion: {
  permisos: {
    ver_clientes: boolean,      // Can view client list
    editar_clientes: boolean,   // Can create/edit clients
    ver_reportes: boolean       // Can access reports (future)
  }
}
```

**Reset rule**: When role changes from Colaborador → Coach/Owner, reset to all false

---

## 5. Extension Points (How to Add New Modules)

### 5.1 Module Structure Template

All future modules (Agenda, Programas, Analytics) must follow this pattern:

```
1. Data Loading
   async function load<Module>() {
     // Query Supabase
     // Filter by org_id = currentOrgId
     // Populate global array: all<Module> = data
   }

2. Rendering
   function render<Module>() {
     // Transform all<Module> into HTML
     // Handle empty state
     // Handle loading state
     // Apply filters/sorts
   }

3. State Management
   let all<Module> = [];       // Raw data from DB
   let filtered<Module> = [];  // After search/filter/sort
   let current<Module>Selected = null;  // For drawer detail

4. CRUD Operations
   async function create<Item>(data) {
     // Validate data
     // Check permission: canAction('module:create')
     // Insert to Supabase with org_id filter
     // Reload: await load<Module>()
     // Re-render: render<Module>()
   }

5. UI Interactions
   function open<Item>Drawer(id) {
     // Check permission: canAction('module:view_detail')
     // Find item in all<Module>
     // Render drawer content
     // Open overlay + drawer
   }
```

### 5.2 Data Isolation Rule
**MANDATORY**: Every query must include `.eq('org_id', currentOrgId)`

```javascript
// Agenda module example:
async function loadAgenda() {
  const { data } = await sb
    .from('agenda')                    // ← new table
    .select('*')
    .eq('org_id', currentOrgId)        // ← MANDATORY
    .eq('coach_id', ME.id);            // ← optional (coach-specific)
  
  allAgenda = data;
}
```

### 5.3 Component Reuse
**REQUIRED**: Use Design System v1 components

```javascript
// ❌ WRONG (custom card styling)
html += `<div style="background: #fff; padding: 20px;">...</div>`;

// ✅ RIGHT (reusable card class)
html += `<div class="card">...</div>`;

// ❌ WRONG (custom stats)
html += `<div style="font-size: 28px; font-weight: bold;">42</div>`;

// ✅ RIGHT (renderStats helper)
html += renderStats([{label: 'Total', value: 42}]);

// ❌ WRONG (custom empty state)
html += `<div style="padding: 40px; text-align: center;">Vacío</div>`;

// ✅ RIGHT (renderEmptyState helper)
html += renderEmptyState('📅', 'Sin agenda', 'Crea tu primera cita', 'Agendar', 'openCreateAgenda()');
```

### 5.4 Permission Integration
**REQUIRED**: Implement `canAction()` dispatch for new module

```javascript
// In permissions system (add to canOwnerAction, canCoachAction):
const agendaActions = [
  'agenda:view', 'agenda:create', 'agenda:edit', 'agenda:cancel'
];

// In canOwnerAction():
if (agendaActions.includes(action)) return true;

// In canCoachAction():
const agendaCoachActions = ['agenda:view', 'agenda:create', 'agenda:edit'];
if (agendaCoachActions.includes(action)) return true;

// In canColaboradorAction():
if (action === 'agenda:view' && ME.configuracion?.permisos?.ver_reportes) return true;
```

---

## 6. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    FROZEN CORE (v2)                        │
│  Organización → Equipo → Clientes (interdependent)         │
└──────────────┬──────────────────────────────────────────────┘
               │
      ┌────────┴────────┐
      │                 │
   ┌──▼──┐         ┌────▼─────┐
   │ RLS │         │Permissions│
   │Multi│         │ System    │
   │Tenant          └──────────┘
   └─────┘
      │
┌─────┴────────────────────────────────────────────────────────┐
│            REUSABLE LAYERS (Design System v1)               │
│  Components (btn, card, badge, stats)                       │
│  Helpers (renderEmptyState, renderStats, etc.)              │
│  Responsive (480px, 768px, 1200px+)                         │
│  Accessibility (WCAG 2.1 AA)                                │
└──────────────────────────────────────────────────────────────┘
      │
      ├─ Agenda Module (Phase 2) [New]
      ├─ Programas Module (Phase 3) [New]
      ├─ Analytics Module (Phase 3) [New]
      └─ Comunidad Module (Phase 4) [New]
```

---

## 7. Testing & Validation Checklist

### Before Deploying New Module

- [ ] Uses only Design System v1 components (no custom styling)
- [ ] All queries include `.eq('org_id', currentOrgId)`
- [ ] Permission checks at data load + UI render + submission
- [ ] canAction() integrated for all new actions
- [ ] Responsive at 480px, 768px, 1200px breakpoints
- [ ] Accessibility: WCAG 2.1 AA (labels, color contrast, keyboard nav)
- [ ] Empty state implemented with renderEmptyState()
- [ ] Stats use renderStats() helper
- [ ] Buttons use `.btn-primary` / `.btn-secondary` (no inline styles)
- [ ] Error messages via showError(section, message)
- [ ] Tested multi-tenant (2+ orgs, verify isolation)
- [ ] Tested permission gating (Owner, Coach, Colaborador)
- [ ] Mobile tested (drawers, forms, touch targets ≥44px)

---

## 8. Frozen vs Future (What Can Change)

### Frozen (No Changes)
✅ Core business logic (Equipo, Clientes operations)  
✅ Permission model (role hierarchy, access rules)  
✅ Data isolation (org_id filtering)  
✅ Design System components  
✅ Responsive breakpoints  
✅ Accessibility standards  

### Can Improve (Phase 2+)
🟨 UX flows (consolidate modals into drawers, inline editing)  
🟨 Component refactoring (deduplication, helper usage)  
🟨 Performance optimizations (caching, lazy loading)  
🟨 New custom permissions (ver_reportes → view_analytics, etc.)  

### Cannot Add (Without Unlocking)
❌ New roles (only Owner, Coach, Colaborador exist)  
❌ New business rules (e.g., capacity hard limits)  
❌ Alternative UI patterns (all must use Design System v1)  
❌ Cross-org features (org_id isolation is law)  

---

## 9. Documentation References

| Document | Purpose | Locked | Path |
|----------|---------|--------|------|
| Design System v1 | UI components, patterns, accessibility | ✅ | `docs/design-system-v1.md` |
| Permissions Model | Role matrix, canAction(), permission rules | ✅ | `docs/permissions-model.md` |
| Component Deduplication | Helpers created, refactoring roadmap | ✅ | `docs/component-deduplication.md` |
| UX Review | Flow analysis, optimization recommendations | ✅ | `docs/ux-review-consolidation.md` |
| Architecture v1 | Original module structure (legacy) | ✅ | `docs/architecture-multicoach-v3.md` |
| **This Document** | **Frozen architecture + extension rules** | ✅ | `docs/architecture-frozen-v2.md` |

---

## 10. Process for Requesting Changes

### To Add a New Action/Feature to Locked Module

1. Create GitHub issue with business case
2. Justification: Why this cannot wait until new module
3. Impact assessment: What breaks if we don't do this
4. Product Owner review + approval (required)
5. If approved: Branch off, implement with test, merge to main only after review
6. Document change in this file (update version to v2.1, v3, etc.)

### Example Approved Change

**Issue**: "equipo:view should filter by status (active/inactive)"

**Case**: Without this, inactive members clutter team list

**Solution**: Add filter parameter to loadEquipo()

**Process**:
1. Create issue + get approval ✓
2. Implement filter logic ✓
3. Add to permission matrix ✓
4. Test all roles (Owner, Coach, Colaborador) ✓
5. Update architecture doc (v2.1) ✓
6. Merge + deploy ✓

### NOT Approved Changes (Would reopen v1)

❌ "Add 'Analyst' role" (changes role hierarchy)  
❌ "Allow coaches to remove members" (changes permission model)  
❌ "Custom button colors per org" (violates Design System v1)  
❌ "Cross-org member sharing" (breaks org_id isolation)  

---

## 11. Monitoring & Maintenance

### Automated Checks (CI/CD)

- ✅ Syntax check: `scripts/check-syntax.js`
- ✅ Smoke test: `scripts/check-smoke.js`
- ✅ Guardrails: `scripts/check-guardrails.js` (permission checks, org_id filters)
- ✅ Icons: `scripts/check-icons.js` (Design System consistency)
- ✅ Parity: `scripts/check-parity.js` (module consistency)

### Manual Review (Pre-Deploy)

1. **Architectural review**: Does new code follow patterns?
2. **Permission review**: Are all gating points protected?
3. **Component review**: Using Design System v1 only?
4. **Mobile review**: Responsive, touch targets ≥44px?
5. **Accessibility review**: WCAG 2.1 AA compliant?

---

## 12. Version History

| Version | Date | Changes |
|---------|------|---------|
| v1.0 | 2026-08 | Initial frozen architecture (Sprint Clientes) |
| v2.0 | 2026-08 | Added Design System, Permissions, responsive, UX review |
| v2.1 | TBD | Post-approval changes (if any) |

---

## Conclusion

**MultiCoach v3 Core is locked and stable.**

This frozen foundation enables:
- ✅ Rapid module development (Agenda, Programas, etc.)
- ✅ Consistent UX across all features
- ✅ Secure multi-tenant isolation
- ✅ Accessible, responsive design
- ✅ Minimal technical debt

Future developers should **READ THIS DOCUMENT FIRST** before starting any new module work. All answers are here.

**Questions?** Refer to the specific documentation links above. If not covered, create an issue for Product Owner review.

---

**Locked by**: Product Owner  
**Effective until**: Product Owner approval required for any changes  
**Last updated**: 2026-08  
**Next review**: After Agenda module completes (Sprint 2)
