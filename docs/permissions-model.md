# Permissions Model v1 — Centralized Access Control

**Locked:** Sprint Consolidación. Canonical for all MultiCoach + future modules.

---

## Overview

The permissions model defines **WHO can DO WHAT in WHICH context**. This is a centralized, reusable system that replaces scattered `rol === 'owner'` checks across the codebase.

### Design Principles
1. **Single source of truth**: All permission logic lives in `canAction(action, context)`
2. **Role-based + attribute-based**: Roles (Owner, Coach, Colaborador) + custom permissions (for Colaboradores)
3. **Principle of least privilege**: Users can only do what their role explicitly allows
4. **Audit-friendly**: Every action is named and can be logged
5. **Extensible**: New actions and roles can be added without changing core logic

---

## 1. Roles & Hierarchy

### 1.1 Built-in Roles

| Role | Span | Clients | Special |
|------|------|---------|---------|
| **Owner** | Full org access | Can have clients | Can manage all members, change any role, configure org |
| **Coach** | Own clients only | Must have clients | Can manage own client list, create/edit clients, see own capacity |
| **Colaborador** | Limited (custom) | Cannot have clients | Can have custom permissions (ver_clientes, editar_clientes, ver_reportes) |

### 1.2 Role Hierarchy

```
Owner (highest)
  ↓ can manage everything
Coach (middle)
  ↓ can manage own scope
Colaborador (lowest)
  ↓ custom permissions only
```

**Key Rule**: Cannot demote to a role lower than your own (Coach cannot downgrade Owner to Coach).

---

## 2. Actions & Permissions

### 2.1 Equipo (Team Management) — 7 Actions

| Action | Owner | Coach | Colaborador | Condition |
|--------|-------|-------|-------------|-----------|
| `equipo:view` | ✓ | ✓ (own members only) | ✓ (if `ver_clientes`) | See team list |
| `equipo:invite` | ✓ | ✗ | ✗ | Invite/add new member |
| `equipo:edit` | ✓ | ✗ | ✗ | Edit member name/email/specialty |
| `equipo:change_role` | ✓ | ✗ | ✗ | Change member role (+ enforces min 1 owner) |
| `equipo:configure_perms` | ✓ | ✗ | ✗ | Set custom permissions for Colaborador |
| `equipo:deactivate` | ✓ | ✗ | ✗ | Deactivate/reactivate member |
| `equipo:remove` | ✓ | ✗ | ✗ | Remove member from org |

**Cascading Business Rules**:
- Cannot remove/deactivate member with assigned clients (must reassign first)
- Cannot demote last Owner
- Cannot invite duplicate users

---

### 2.2 Clientes (Client Management) — 7 Actions

| Action | Owner | Coach | Colaborador | Condition |
|--------|-------|-------|-------------|-----------|
| `clientes:view` | ✓ | ✓ (own only) | ✓ (if `ver_clientes`) | See client list |
| `clientes:create` | ✓ | ✓ | ✗ | Create new client (+ wizard 3-step) |
| `clientes:edit` | ✓ | ✓ (own only) | ✓ (if `editar_clientes`) | Edit name/email |
| `clientes:change_coach` | ✓ | ✓ (own only) | ✗ | Reassign client to different coach |
| `clientes:reassign_bulk` | ✓ | ✗ | ✗ | Bulk reassign multiple clients |
| `clientes:deactivate` | ✓ | ✓ (own only) | ✗ | Deactivate/reactivate client |
| `clientes:view_cartera` | ✓ | ✓ | ✗ | View coach's portfolio (clients + capacity) |

---

### 2.3 Personas (Coaches) Tab — 3 Actions

| Action | Owner | Coach | Colaborador | Condition |
|--------|-------|-------|-------------|-----------|
| `personas:view` | ✓ | ✓ | ✗ | See coaches list |
| `personas:view_detail` | ✓ | ✓ | ✗ | See coach detail + capacity |
| `personas:filter_by_coach` | ✓ | ✓ | ✗ | Filter clients by coach |

---

## 3. Data Isolation Rules

### 3.1 Organization Isolation (Mandatory for ALL roles)
```javascript
// Every data query MUST include org_id filter
.eq('org_id', currentOrgId)
```

**Never** allow cross-org data access, even for Owners of multiple orgs.

### 3.2 Coach Isolation (For Coach role)
```javascript
// Coach can ONLY see their own:
- Clients assigned to their ID (coach_id = ME.id)
- Team members (but filtered view)
- Own capacity info
```

### 3.3 Permission-Based Visibility (For Colaborador)
```javascript
// Colaborador sees data ONLY if:
- Their custom permission allows it
- AND data belongs to same org
```

---

## 4. Custom Permissions (Colaborador Only)

### 4.1 Permission Structure
```javascript
usuario.configuracion = {
  permisos: {
    ver_clientes: boolean,      // Can view client list
    editar_clientes: boolean,   // Can create/edit clients (name, email, coach)
    ver_reportes: boolean       // Can access reports (future)
  }
}
```

### 4.2 Permission Defaults
- New Colaborador: All permissions FALSE (most restrictive)
- Owner must explicitly grant permissions in `equipo:configure_perms` modal

### 4.3 Permission Recalculation
- When Colaborador role changes to Coach: Permissions ignored (Coach role determines access)
- When Coach role changes to Colaborador: Reset permissions to all FALSE

---

## 5. canAction() Function Specification

### 5.1 Function Signature
```javascript
function canAction(action, context = {}) {
  // action: string like 'equipo:invite', 'clientes:create'
  // context: { userId, memberId, clientId, targetRole, org_id, ... }
  // Returns: boolean (true = allowed, false = denied)
}
```

### 5.2 Implementation Pseudo-code
```javascript
function canAction(action, context) {
  const actor = ME;  // Current user
  
  // Validate org context
  if (context.org_id && context.org_id !== currentOrgId) {
    return false;  // Cross-org access denied
  }
  
  // Role-based gating
  if (actor.rol === 'owner') {
    // Owners can do most actions
    return canOwnerAction(action, context);
  } else if (actor.rol === 'coach') {
    // Coaches limited scope
    return canCoachAction(action, context);
  } else if (actor.rol === 'colaborador') {
    // Colaboradores only custom permissions
    return canColaboradorAction(action, context);
  }
  
  return false;  // Deny by default
}

function canOwnerAction(action, context) {
  // Owners can do everything except:
  // - Violate business rules (min 1 owner, no null coaches, etc.)
  
  if (action === 'equipo:change_role') {
    const targetMember = allEquipo.find(m => m.id === context.memberId);
    const newRole = context.targetRole;
    if (newRole !== 'owner') {
      const ownerCount = allEquipo.filter(m => m.rol === 'owner').length;
      if (ownerCount <= 1) {
        return false;  // Cannot remove last owner
      }
    }
  }
  
  if (action === 'equipo:remove' || action === 'equipo:deactivate') {
    const member = allEquipo.find(m => m.id === context.memberId);
    if (member.client_count > 0) {
      return false;  // Cannot remove/deactivate with assigned clients
    }
  }
  
  return true;
}

function canCoachAction(action, context) {
  // Coaches can only act on their own scope
  
  const ownScopeActions = [
    'clientes:view', 'clientes:create', 'clientes:edit', 'clientes:change_coach',
    'clientes:deactivate', 'clientes:view_cartera', 'personas:view'
  ];
  
  if (ownScopeActions.includes(action)) {
    // Verify coach is owner of the target
    if (context.clientId) {
      const client = allClientes.find(c => c.id === context.clientId);
      if (client.coach_id !== ME.id) {
        return false;  // Not their client
      }
    }
    return true;
  }
  
  // Coaches cannot do team management
  return false;
}

function canColaboradorAction(action, context) {
  // Colaboradores can only do actions their custom permissions allow
  
  const perms = ME.configuracion?.permisos || {};
  
  if (action === 'clientes:view' || action === 'clientes:view_cartera') {
    return perms.ver_clientes === true;
  }
  if (action === 'clientes:edit' || action === 'clientes:create') {
    return perms.editar_clientes === true;
  }
  if (action === 'personas:view') {
    return perms.ver_clientes === true;  // Same permission
  }
  
  // Colaboradores cannot do anything else
  return false;
}
```

---

## 6. Integration Points

### 6.1 Data Load Gating
```javascript
// When loading data, check if user can view it
async function loadEquipo() {
  if (!canAction('equipo:view')) {
    showError('equipo-section', 'No tienes permiso para ver el equipo');
    return;
  }
  
  let query = supabase.from('usuarios')
    .select('*')
    .eq('org_id', currentOrgId);
  
  // If Coach, filter to team members only
  if (ME.rol === 'coach') {
    query = query.in('id', [ME.id, ...ME.coach_peers]);  // Coach sees self + peers
  }
  
  const data = await query;
  allEquipo = data;
  renderEquipo();
}
```

### 6.2 Action Gating (Before Submission)
```javascript
function openAddPersonModal() {
  // Check permission BEFORE showing modal
  if (!canAction('equipo:invite')) {
    alert('No tienes permiso para invitar miembros');
    return;
  }
  
  // Show modal
  document.getElementById('add-person-modal-overlay').classList.add('open');
}

function submitAddPerson() {
  const email = document.getElementById('add-person-email').value;
  const role = document.getElementById('add-person-role').value;
  
  // Re-check permission (defense in depth)
  if (!canAction('equipo:invite', { email, targetRole: role })) {
    showError('add-person-modal', 'Permission denied');
    return;
  }
  
  // Submit to Supabase
  await supabase.from('usuarios').insert({
    email, rol: role, org_id: currentOrgId
  });
}
```

### 6.3 Conditional Rendering (Show/Hide UI)
```javascript
// In HTML generation:
if (canAction('equipo:invite')) {
  html += `<button class="btn-primary" onclick="openAddPersonModal()">+ Agregar</button>`;
}

// In drawer:
if (canAction('equipo:edit', { memberId: member.id })) {
  html += `<button onclick="editEquipoMember()">Editar</button>`;
}
```

---

## 7. Audit & Logging

### 7.1 Action Audit Log
Every permission check should be loggable:
```javascript
function canAction(action, context = {}) {
  const allowed = checkPermission(action, context);
  
  // Optional: log to client_errors table (if denied)
  if (!allowed) {
    console.warn(`[PERMISSION DENIED] ${ME.id} tried ${action}`, context);
    // Could also POST to /functions/log-access-denied
  }
  
  return allowed;
}
```

### 7.2 What to Log
- **Action**: `equipo:invite`, `clientes:edit`, etc.
- **Actor**: User ID + email
- **Context**: memberId, clientId, targetRole, etc.
- **Result**: ALLOWED | DENIED
- **Timestamp**: When it happened

---

## 8. Permission Matrix (Summary)

```
                  | Owner | Coach | Colab
────────────────────────────────────────
equipo:view       |   ✓   |   ✓   |   ✓ (if ver_clientes)
equipo:invite     |   ✓   |   ✗   |   ✗
equipo:edit       |   ✓   |   ✗   |   ✗
equipo:change_role|   ✓   |   ✗   |   ✗
equipo:cfg_perms  |   ✓   |   ✗   |   ✗
equipo:deactivate |   ✓   |   ✗   |   ✗
equipo:remove     |   ✓   |   ✗   |   ✗
────────────────────────────────────────
clientes:view     |   ✓   |   ✓*  |   ✓ (if ver_clientes)
clientes:create   |   ✓   |   ✓   |   ✗
clientes:edit     |   ✓   |   ✓*  |   ✓ (if editar_clientes)
clientes:change_coach |  ✓ |   ✓* |   ✗
clientes:reassign_bulk | ✓ |  ✗   |   ✗
clientes:deactivate |  ✓  |   ✓* |   ✗
clientes:cartera  |   ✓   |   ✓   |   ✗
────────────────────────────────────────
personas:view     |   ✓   |   ✓   |   ✗
personas:detail   |   ✓   |   ✓   |   ✗

*Coach = Own clients only (filtered)
```

---

## 9. Migration Strategy (Implementing in MultiCoach v3)

### Phase 1: Create centralized function
1. Add `canAction()` function to multicoach.html
2. Add `canOwnerAction()`, `canCoachAction()`, `canColaboradorAction()`
3. Add `PERMISSION_ACTIONS` constant with all action names

### Phase 2: Replace existing checks
1. Find all `ME.rol === 'owner'` → Replace with `canAction('equipo:invite')`
2. Find all `ME.rol === 'coach'` → Replace with `canAction('clientes:create')`
3. Find all `!ME.rol.includes('colaborador')` → Replace with `canAction('equipo:configure_perms')`

### Phase 3: Add gating points
1. At data load: Check `canAction('*:view')` before loading section
2. At modal open: Check before showing UI
3. At submission: Re-check before Supabase write

### Phase 4: Testing
1. Test as Owner: All actions allowed
2. Test as Coach: Only own clients visible, cannot manage team
3. Test as Colaborador: Only custom permissions visible

---

## 10. Future Extensibility

### 10.1 Adding New Actions
1. Define action name: `modulo:action` (kebab-case)
2. Add to permission matrix
3. Implement in `canAction()` function
4. Gate UI at render + submission
5. Document in this file

### 10.2 Adding New Roles
1. Define role capabilities vs Owner/Coach/Colaborador
2. Implement `canNewRoleAction()` function
3. Update `canAction()` router
4. Add to role dropdown (requires Owner permission)
5. Test permission matrix

### 10.3 Conditional Permissions (Future)
```javascript
// Capacity-based: Coach can only create clients if not at capacity
if (action === 'clientes:create' && ME.rol === 'coach') {
  const capacity = getCapacity(ME);
  if (capacity >= 100) {
    return false;  // At capacity limit
  }
}

// Time-based: Trial users cannot access certain features
if (ME.estado_sub === 'prueba') {
  if (action === 'personas:view' && daysRemaining < 3) {
    return true;  // Last 3 days: show to encourage signup
  }
}
```

---

## 11. Checklist for Frozen Architecture

- [ ] `canAction()` function defined in multicoach.html
- [ ] All 14 actions named and documented
- [ ] Permission matrix complete (Owner/Coach/Colaborador)
- [ ] Gating at 3 points: load, UI render, submission
- [ ] Colaborador custom permissions implemented
- [ ] Business rules enforced (min 1 owner, no null coaches, capacity limits)
- [ ] All UI conditional on permissions (buttons hidden if denied)
- [ ] Logging/audit trail ready (can be added without code changes)
- [ ] Tests for each permission scenario
- [ ] Documentation in this file

---

**Version**: 1.0  
**Locked**: Sprint Consolidación (Product Owner)  
**Next Review**: Sprint 2 (Agenda module integration)
