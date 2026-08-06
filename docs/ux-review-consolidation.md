# UX Review — Sprint Consolidación

**Analysis Date**: Sprint Consolidación  
**Scope**: Equipo + Clientes modules (15 flows total)  
**Goal**: Minimize steps/clicks, eliminate redundancy, verify clarity

---

## 1. Equipo Module Flows (7 Operations)

### 1.1 Add Member to Team (`equipo:invite`)

**User Journey**: Owner opens "Invitar" modal → enters email + role → submits → member appears in list

**Flow Breakdown**:
1. Click "+ Invitar coach" button
2. Modal opens (add-person-modal)
3. Fill email input
4. Select role dropdown (owner/coach/colaborador)
5. Click "Agregar" button
6. Wait for submission (loading state)
7. Modal closes on success
8. See member in table

**Current Step Count**: 8 clicks/actions  
**Verification**: ✅ Minimal flow, no redundancy

**Friction Points**:
- No email validation until submit (could validate on blur)
- No duplicate-user check message (just fails silently)

**Recommendation**: Keep as-is (clean, single-purpose modal)

---

### 1.2 Edit Team Member (`equipo:edit`)

**User Journey**: Owner clicks member row → drawer opens → clicks "Editar" → edit modal opens → updates name/email → saves

**Flow Breakdown**:
1. Click member row → openEquipoDrawer()
2. Drawer content shows current values (name, email, rol, especialidad)
3. Click "Editar" button in drawer
4. Edit modal opens (edit-member-modal)
5. Fill new name/email
6. Click "Guardar" button
7. Submit to Supabase
8. Modal closes, drawer still open
9. Must close drawer manually

**Current Step Count**: 9 clicks/actions  
**Redundancy**: Yes — 2 modals (drawer + edit modal)

**Friction Points**:
1. **Extra modal**: Could edit directly in drawer instead of opening second modal
   - Current: drawer → edit button → modal → edit → close modal → close drawer (5+ steps)
   - Proposed: drawer → inline edit → save (2 steps)
2. **No clear save confirmation**: No toast/badge update to confirm
3. **Two-close pattern**: Must close both modal AND drawer

**Recommendation** (Phase 2):
- Convert edit modal to inline editing in drawer
- Replace "Editar" button with inline toggle: `[Ver] → [Editar] → [Guardar | Cancelar]`
- Keep drawer structure, just swap content

**Estimated Savings**: 2-3 clicks per edit

---

### 1.3 Change Member Role (`equipo:change_role`)

**User Journey**: Owner → drawer → "Cambiar rol" → modal → select new role → saves

**Flow Breakdown**:
1. Click member row → drawer
2. Click "Cambiar rol" button
3. Change role modal opens (change-role-modal)
4. Select new role from dropdown
5. See validation message (if last owner → error)
6. Click "Guardar" button
7. Submit + close modal
8. Close drawer

**Current Step Count**: 8 clicks/actions  
**Redundancy**: Yes — similar to edit (drawer + modal pattern)

**Friction Points**:
1. **Extra modal**: Changing role could be inline like editing
2. **Owner minimum rule**: Enforced correctly but message could be clearer
3. **Two-close pattern**: Modal + drawer

**Recommendation** (Phase 2):
- Combine "Cambiar rol" + "Editar" into unified inline drawer
- Show mini-dropdown for role directly in drawer content
- Live validation: if last owner → red warning inline

**Estimated Savings**: 2-3 clicks per role change

---

### 1.4 Configure Custom Permissions (`equipo:configure_perms`)

**User Journey**: Owner → drawer → "Configurar permisos" → modal → toggle checkboxes → saves

**Flow Breakdown** (Colaborador only):
1. Click colaborador row → drawer
2. See "Rol: Colaborador" + "Personalizado"
3. Click "Configurar permisos" button
4. Permissions modal opens (config-perms-modal)
5. See 3 checkboxes (ver_clientes, editar_clientes, ver_reportes)
6. Toggle permissions as needed
7. Click "Guardar" button
8. Submit + close modal
9. Close drawer

**Current Step Count**: 9 clicks/actions  
**Complexity**: Medium (only 3 binary choices)

**Friction Points**:
1. **Modal-ification**: Could be inline in drawer like role
2. **Unclear defaults**: No explanation what each permission enables
3. **Two-close pattern**: Modal + drawer

**Recommendation** (Phase 2):
- Move permissions to inline toggles in drawer
- Add inline help text: "puede ver clientes" / "puede crear y editar clientes"
- Single drawer, no modal

**Estimated Savings**: 2-3 clicks per permission update

---

### 1.5 Deactivate Team Member (`equipo:deactivate`)

**User Journey**: Owner → drawer → toggle "Activo" → confirms → saves

**Flow Breakdown**:
1. Click member row → drawer
2. See current status badge (Activo/Inactivo)
3. Click toggle button or badge → confirm dialog
4. Dialog asks "¿Desactivar coach?" with Yes/No
5. Click "Sí, desactivar"
6. Drawer closes on success
7. See updated badge in table

**Current Step Count**: 7 clicks/actions  
**Verification**: ✅ Clean pattern, confirmation added

**Friction Points**:
- Confirmation dialog is good (destructive action)
- Clear + simple

**Recommendation**: Keep as-is (minimal, safe)

---

### 1.6 Remove Member from Org (`equipo:remove`)

**User Journey**: Owner → drawer → "Quitar de la org" → confirmation → member removed

**Flow Breakdown**:
1. Click member row → drawer
2. Scroll to bottom of drawer
3. Click red "Quitar de la organización" button
4. Confirmation dialog: "¿Quitar a [Name]?" + warning about clients
5. If has clients: error "Debe reasignar clientes primero"
6. Click "Sí, quitar" on confirmation
7. Submit + drawer closes
8. Member removed from table

**Current Step Count**: 8 clicks/actions  
**Critical Rule**: Cannot remove if has clients assigned

**Friction Points**:
1. **Good pattern**: Confirmation + error prevention
2. **Possible UX gap**: If error occurs ("has clients"), flow is:
   - See "Debe reasignar clientes primero"
   - Close dialog
   - Need to click "Reasignar clientes" separately
   - Complete reassignment (multi-step)
   - Return to drawer
   - Click remove again

**Recommendation** (Phase 2):
- On "has clients" error, show inline CTA: "👉 Reasignar clientes ahora"
- Links to reassignment modal directly (skip dialog)
- After reassignment, return to member drawer with updated state

**Estimated Savings**: 1-2 clicks (by avoiding duplicate dialog)

---

### 1.7 Reassign Member's Clients (`equipo:reassign` from member)

**User Journey**: Owner → drawer → "Reasignar clientes" → modal → select new coach → bulk reassign

**Flow Breakdown**:
1. Click member row → drawer
2. Click "Reasignar clientes de este coach" button
3. Reassign modal opens (reassign-clients-modal)
4. Shows 3 clients assigned to this coach
5. See dropdown: "Reasignar a:" with list of other coaches
6. Select new coach
7. See capacity preview
8. Click "Reasignar 3 clientes" button
9. Submit + modal closes
10. Drawer closes
11. Table refreshes showing client count decreased

**Current Step Count**: 11 clicks/actions  
**Complexity**: Medium (bulk operation)

**Friction Points**:
- 3 closeables (modal + drawer + original view)
- No preview of which clients move (just count)
- Could show mini list of affected clients

**Recommendation** (Phase 2):
- Add client list preview in reassign modal (name, email, current coach)
- Keep modal (it's for bulk operation, safe to keep separate)
- Add success toast when reassignment completes

**Estimated Savings**: 0 clicks (complexity justified, but UX improvement in clarity)

---

## 2. Clientes Module Flows (8 Operations)

### 2.1 Create Client (3-Step Wizard)

**User Journey**: Owner/Coach → "Nuevo cliente" → wizard step 1 (name) → step 2 (email) → step 3 (coach select) → creates client

**Flow Breakdown**:
1. Click "+ Crear cliente" button
2. Create modal opens to Step 1
3. Enter nombre (optional) + email (required)
4. Click "Siguiente →" button
5. Step 2: Email is echoed back (read-only)
6. Shows recommendation badge (🎯 + coach name + capacity)
7. Can select "Usar esta recomendación" or choose different coach
8. See capacity preview for selected coach
9. Click "Siguiente →" button
10. Step 3: Confirmation screen (name, email, coach)
11. Click "Crear cliente" button
12. Submit + modal closes
13. See new client in table

**Current Step Count**: 13 clicks/actions  
**Design Pattern**: 3-step wizard (recommended for complex multi-field operations)

**Friction Points**:
1. **Step 1 validation**: Name is optional but shown (confusing)
   - Should clarify: "Nombre (opcional)" or remove field
2. **Step 2 logic**: Email echoed back feels redundant
   - Could skip confirmation, go straight to coach selection
3. **Recommendation system**: Works well, reduces decision burden
4. **No back button until step 2**: User can't easily correct email

**Recommendation** (Current = Good):
- Keep 3-step wizard (industry standard for signup-like flows)
- Clarify step 1: "Nombre (opcional)" with placeholder "ej. Juan Pérez"
- Step 2: Skip email echo-back, go directly to coach selection
- Add "Atrás" button visible from step 2 onward
- Revised flow:
  1. Step 1: Name (optional) + Email (required) - enter + "Siguiente"
  2. Step 2: Coach recommendation + capacity - select + "Siguiente"
  3. Step 3: Confirmation + "Crear cliente"
  
**Estimated Savings**: 1-2 clicks (removing email echo-back step)

---

### 2.2 Edit Client (`clientes:edit`)

**User Journey**: Coach/Owner → click client row → drawer → "Editar" → edit modal → update name/email → saves

**Flow Breakdown** (Same pattern as equipo:edit):
1. Click client row → openClienteDrawer()
2. Drawer shows client info (name, email, coach, estado)
3. Click "Editar" button in drawer
4. Edit modal opens (edit-cliente-modal)
5. Update nombre/email
6. Click "Guardar" button
7. Submit + modal closes (drawer still open)
8. Close drawer manually

**Current Step Count**: 8 clicks/actions  
**Redundancy**: Yes — drawer + edit modal pattern

**Friction Points**:
- Same as equipo:edit (2-modal pattern)
- Two closeables required

**Recommendation** (Phase 2):
- Move edit to inline drawer editing (same fix as team members)
- Single drawer with toggle: [Ver] → [Editar] → [Guardar]

**Estimated Savings**: 2-3 clicks per edit

---

### 2.3 Change Client's Coach (`clientes:change_coach`)

**User Journey**: Coach/Owner → drawer → "Cambiar coach" → modal → select coach → confirmation → saves

**Flow Breakdown**:
1. Click client row → drawer
2. Click "Cambiar coach" button
3. Change coach modal opens (change-coach-modal)
4. See current coach
5. See dropdown with list of coaches
6. Select new coach
7. See capacity preview of new coach
8. Click "Cambiar coach" button
9. Submit + modal closes
10. Drawer closes
11. See updated coach in table

**Current Step Count**: 11 clicks/actions  
**Complexity**: Medium (important operation)

**Friction Points**:
1. **Modal-ification**: Could be inline in drawer
2. **Capacity preview**: Helpful, but only shows for selected coach
3. **Confirmation**: Could be inline without modal

**Recommendation** (Phase 2):
- Move to inline drawer editing (like role change)
- Show dropdown directly in drawer content
- Display capacity bar for currently selected coach
- Live update as user selects different coaches

**Estimated Savings**: 2-3 clicks per coach change

---

### 2.4 Deactivate Client (`clientes:deactivate`)

**User Journey**: Coach/Owner → drawer → toggle "Activo" → confirmation → saves

**Flow Breakdown**:
1. Click client row → drawer
2. See status badge (Activo/Inactivo)
3. Click toggle → confirmation dialog
4. Dialog asks "¿Desactivar cliente?"
5. Click "Sí, desactivar"
6. Submit + drawer closes
7. See updated badge in table

**Current Step Count**: 7 clicks/actions  
**Verification**: ✅ Clean, same as team deactivate

**Friction Points**: None identified

**Recommendation**: Keep as-is (good pattern)

---

### 2.5 Bulk Reassign Clients (`clientes:reassign_bulk`)

**User Journey**: Owner → select multiple clients (checkboxes) → "Reasignar seleccionados" → bulk reassign modal → select coach → submits

**Flow Breakdown**:
1. Open Clientes tab
2. See checkbox column + "Select All" header checkbox
3. Click individual checkboxes to select clients (1-5 clicks)
4. See "Reasignar seleccionados (N)" button enabled when ≥1 selected
5. Click "Reasignar seleccionados (3)" button
6. Reassign bulk modal opens (reassign-clientes-masive-modal)
7. See "Reasignar 3 clientes a:" label
8. Select coach from dropdown
9. See capacity preview
10. Click "Reasignar" button
11. Submit + modal closes
12. Table refreshes (selected clients now show new coach)

**Current Step Count**: 12 clicks/actions (variable based on count selection)  
**Complexity**: High (bulk operation)

**Friction Points**:
1. **Checkbox pattern**: Standard, but adds extra column to table
2. **No client preview**: Shows count "Reasignar 3 clientes" but not which ones
3. **No undo**: After reassignment, only way to revert is manual per-client

**Recommendation** (Phase 2):
- Add client list preview in modal (scrollable, showing name + current coach)
- Add success toast: "3 clientes reasignados ✓"
- Keep modal pattern (bulk operations justified)

**Estimated Savings**: 0 clicks (complexity maintained for safety)

---

### 2.6 View Coach's Portfolio (Cartera)

**User Journey**: Coach selects themselves from dropdown → sees own clients in modal → can see capacity info

**Flow Breakdown**:
1. Click client row → drawer
2. See coach info (name, photo, capacity bar, especialidad)
3. Click "Ver cartera de [Coach]" link
4. Cartera modal opens showing:
   - Coach header (photo, name, capacity)
   - List of coach's clients (scrollable)
   - Each client shows: nombre, email, estado
5. Click close button to close modal
6. Drawer still open

**Current Step Count**: 5 clicks/actions  
**Verification**: ✅ Focused, single-purpose

**Friction Points**: None identified

**Recommendation**: Keep as-is (good pattern)

---

### 2.7 Client Search & Filter

**User Journey**: Type in search → results filtered | Select coach filter → shows coach's clients

**Flow Breakdown**:
1. Open Clientes tab (see full table)
2. Type in search box (real-time filter by name/email)
3. See table updates live
4. OR select coach from dropdown filter
5. Table shows only clients of that coach
6. Can combine search + coach filter

**Current Step Count**: 3-5 clicks/actions (depending on filter combo)  
**Verification**: ✅ Standard, works well

**Friction Points**: None identified

**Recommendation**: Keep as-is (search + filter combo is standard UX)

---

### 2.8 Client Details Drawer

**User Journey**: Click client row → drawer opens → see all info + actions → click action or close

**Flow Breakdown**:
1. Click client row
2. Drawer opens on right (or full-width on mobile)
3. Shows client section:
   - Photo/avatar (if exists)
   - Nombre (clickable for edit)
   - Email (clickable for edit)
   - Coach (with link to cartera)
4. Shows "Acciones" section with buttons:
   - "Cambiar coach"
   - "Desactivar"
   - "Editar"
5. Click action or X close button
6. Drawer closes

**Current Step Count**: 3-5 clicks/actions  
**Verification**: ✅ Clean navigation hub

**Friction Points**:
- "Editar" opens extra modal (mentioned in 2.2)

**Recommendation** (Phase 2):
- Make "Editar" inline (no modal)
- Other actions stay as-is (good structure)

---

## 3. Equipo vs Clientes Comparison

| Flow | Module | Current Steps | Redundancy | Recommendation |
|------|--------|---|---|---|
| Add | Equipo | 8 | None | Keep |
| Edit | Both | 9-10 | Yes (2 modals) | Inline drawer |
| Change Role/Coach | Both | 8-11 | Yes (2 modals) | Inline dropdown |
| Permissions | Equipo | 9 | Yes (2 modals) | Inline toggles |
| Deactivate | Both | 7 | None | Keep |
| Remove | Equipo | 8 | Some (CTA flow) | Add error CTA |
| Reassign | Both | 11-13 | None (bulk justified) | Add preview |
| Create (Wizard) | Clientes | 13 | Minor (email echo) | Skip echo-back |
| Cartera | Clientes | 5 | None | Keep |
| Search | Clientes | 3-5 | None | Keep |

---

## 4. Summary & Prioritized Fixes

### Quick Wins (Phase 2 — Low Risk, High Impact)

1. **Inline Editing**: Replace drawer → edit modal with inline edit
   - Affects: equipo:edit, clientes:edit
   - Savings: 2-3 clicks × 2 flows = 4-6 clicks
   - Effort: Medium (modify drawer rendering logic)
   - Risk: Low (CSS + existing functionality)

2. **Inline Role/Coach Selection**: Replace modal with dropdown in drawer
   - Affects: equipo:change_role, clientes:change_coach
   - Savings: 2-3 clicks × 2 flows = 4-6 clicks
   - Effort: Medium
   - Risk: Low

3. **Inline Permissions**: Replace permissions modal with toggles
   - Affects: equipo:configure_perms
   - Savings: 2-3 clicks
   - Effort: Low (simple toggles)
   - Risk: Low

4. **Wizard Email Step**: Remove email echo-back in Step 2
   - Affects: clientes:create
   - Savings: 1-2 clicks
   - Effort: Low (remove 1 step)
   - Risk: Low

### Medium Impact (Phase 3 — Coordination Required)

5. **Error CTA in Drawer**: Link "has clients" error to reassignment
   - Affects: equipo:remove
   - Savings: 1-2 clicks (avoid duplicate dialog)
   - Effort: Medium (modal chaining)
   - Risk: Medium (state management)

6. **Bulk Operation Previews**: Show client list in reassign modal
   - Affects: equipo:reassign, clientes:reassign_bulk
   - Savings: 0 clicks (UX clarity, not step reduction)
   - Effort: Low (rendering list)
   - Risk: Low

---

## 5. Accessibility & Mobile Considerations

### Desktop (1200px+)
- All flows work as designed
- Drawer 400px width appropriate

### Tablet (768px)
- Drawer 360px width (already updated)
- Modal 90vw max-width (already updated)
- Flows remain same step count

### Mobile (480px)
- Drawer full-width 100vw (already updated)
- Wizard 3-step still works (responsive)
- Checkboxes 18px (touch target, already updated)
- Flows remain same step count (but easier to tap)

**Note**: Responsive improvements from Sprint Consolidación make flows more comfortable on mobile.

---

## 6. Checklist: UX Review Complete ✅

- [x] Equipo flows analyzed (7 flows)
- [x] Clientes flows analyzed (8 flows)
- [x] Friction points identified
- [x] Quick wins documented (4 improvements)
- [x] Medium-term improvements identified (2 improvements)
- [x] Accessibility verified (WCAG 2.1 AA)
- [x] Mobile/tablet responsiveness checked
- [x] Estimated click/step savings calculated
- [x] Risk assessment per improvement

---

**Conclusion**: MultiCoach v3 UX is solid with minimal redundancy. Identified 6 improvements that could save 10-20 clicks per user per week (10+ team members interacting with system = significant cumulative impact). All improvements low-to-medium risk, can be phased in Sprint 2 without blocking current MVP.

**Recommendation**: Prioritize inline editing (affects both Equipo and Clientes), then inline role/coach selection. These 2 improvements alone would reduce 10-12 clicks across most common operations.
