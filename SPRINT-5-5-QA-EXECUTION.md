# Sprint 5.5 QA Execution Guide — Agenda Engine Real User Validation

**Status:** Ready for staging execution  
**Created:** 2026-08-03  
**Total Checks:** 67  
**Pass Criteria:** All 67 checks pass ✓

---

## Setup Requirements

### 1. **Users & Accounts**
Create or use 3 real test accounts in Supabase (staging environment):
- **Owner**: `owner@test.pathway` (role=owner, org_id=1)
- **Coach**: `coach@test.pathway` (role=coach, org_id=1)  
- **Client**: `client@test.pathway` (role=client, assigned to Owner's account)

Ensure:
- Owner and Coach have `agenda.create`, `agenda.edit`, `agenda.cancel`, `agenda.reschedule` capabilities
- Coach has `agenda.manage.availability` permission
- Client has read-only permissions (no edit/cancel/create)

### 2. **Staging Data**
Populate `sesiones_registro` table with real test sessions:
```sql
INSERT INTO sesiones_registro (id, candidato_id, coach_id, owner_id, titulo, tipo, estado, fecha_inicio, fecha_fin, participantes)
VALUES 
  ('test-session-1', <client_id>, <coach_id>, <owner_id>, 'Sesión de Prueba', 'sesion_individual', 'scheduled', NOW() + interval '2 days', NOW() + interval '2 days 1 hour', '["coach", "client"]');
```

### 3. **Browser Setup**
Three independent browser windows or incognito tabs:
- **Window A**: Login as Owner → Navigate to `multicoach.html`
- **Window B**: Login as Coach → Navigate to `panel-v2.html`
- **Window C**: Login as Client → Navigate to `cliente.html`

Keep all three open side-by-side during realtime tests.

---

## Execution Workflow

### Step 1: Owner Flow (Window A)
**File:** `qa-sprint-5-5-agenda-realtime.js`  
**Function:** `QA_SPRINT_55.case_owner_create()`

1. Open browser console in Window A (multicoach.html)
2. Paste: `QA_SPRINT_55.case_owner_create()`
3. Manually test each item:
   - ✓ Can you see the "Crear Evento" button?
   - ✓ Click it → Select a client from dropdown
   - ✓ Select a coach from the team list
   - ✓ Set date/time (must be in future)
   - ✓ Set type: `sesion_individual`, `clase`, or `evaluacion`
   - ✓ Click "Guardar"
   - ✓ Does the event appear in the agenda immediately?
   - ✓ Check state badge: should show "scheduled" (gray)
   - ✓ Try clicking the event → Edit button visible?

**Expected:** 11/11 checks pass  
**Update harness:** Edit `qa-sprint-5-5-agenda-realtime.js` line 61-71 if any check fails (set to `false`)

---

### Step 2: Coach Flow (Window B)
**File:** `qa-sprint-5-5-agenda-realtime.js`  
**Function:** `QA_SPRINT_55.case_coach_modify()`

1. Switch to Window B (panel-v2.html, logged in as Coach)
2. Open console and paste: `QA_SPRINT_55.case_coach_modify()`
3. Manually test:
   - ✓ Can you see the session created in Step 1?
   - ✓ Does it show the client name, date, and time correctly?
   - ✓ Click "Editar" → Can you change the date/time?
   - ✓ Save the change → Does it appear immediately WITHOUT page refresh?
   - ✓ Click "Confirmar" → State changes to "confirmed" (green badge)?
   - ✓ Try accessing another coach's session (if one exists) → Edit button unavailable?
   - ✓ Try clicking "Cancelar" on your own session → Can you cancel it?

**Expected:** 11/11 checks pass  
**Note:** If Coach cannot edit own sessions (line 123 fails), check `agenda.edit` capability in Supabase users.capabilities

---

### Step 3: Client Flow (Window C)
**File:** `qa-sprint-5-5-agenda-realtime.js`  
**Function:** `QA_SPRINT_55.case_client_view()`

1. Switch to Window C (cliente.html, logged in as Client)
2. Open console and paste: `QA_SPRINT_55.case_client_view()`
3. Manually test:
   - ✓ Can you see your upcoming session in the agenda/calendar?
   - ✓ Does it show the coach's name correctly?
   - ✓ Does the date and time match what Owner and Coach see?
   - ✓ Is there an "Editar" button? (Should NOT be present)
   - ✓ Is there a "Cancelar" button? (Should NOT be present)
   - ✓ Is there a "Confirmar Asistencia" button? (Should be present)
   - ✓ Do you see other clients' sessions? (Should NOT)

**Expected:** 9/9 checks pass  
**Critical:** If Client can see other clients' sessions (line 183 fails), check RLS policies on `sesiones_registro`

---

### Step 4: Realtime Validation (All 3 Windows)
**File:** `qa-sprint-5-5-agenda-realtime.js`  
**Function:** `QA_SPRINT_55.case_realtime()`

**This is the critical validation. Keep all 3 windows visible.**

1. Open console in all 3 windows
2. Paste in Window A: `QA_SPRINT_55.case_realtime()`
3. Execute the sequence:
   - **Owner creates new session** (Window A) → Set date for +3 days
   - **WITHOUT refreshing Window B or C**: Do you see the new session appear?
   - **Coach edits time** (Window B) → Change to +4 days
   - **WITHOUT refreshing Window A or C**: Does the time update in Owner's view?
   - **Coach confirms session** (Window B) → Click "Confirmar"
   - **WITHOUT refreshing Window A or C**: Do state badges change to "confirmed" (green)?

**Expected:** 12/12 checks pass  
**Critical Alert:** 
- If Window B/C don't see changes without refresh → **Supabase Realtime subscriptions not wired**
- Check that `renderScheduler()` re-runs when data changes
- Verify Supabase realtime channel is active: `supabase.channel('sesiones_registro').on('*', ...)`

---

### Step 5: Permissions & RLS Validation
**File:** `qa-sprint-5-5-agenda-realtime.js`  
**Function:** `QA_SPRINT_55.case_permissions()`

1. Console in Window B (Coach): `QA_SPRINT_55.case_permissions()`
2. Test scenarios:
   - **Coach tries to create session as another coach:**
     - Open DevTools → Network tab
     - In console: simulate selecting another coach's session and clicking "Editar"
     - Expected: Permission denied or edit button hidden
   - **Coach tries to cancel session belonging to another coach:**
     - If another coach's session exists, try clicking its "Cancelar"
     - Expected: Button unavailable or error shows
   - **Client tries direct API call (simulate):**
     - Open console → Paste:
     ```javascript
     fetch('/rest/v1/sesiones_registro?id=eq.<any-session-id>', {
       method: 'PATCH',
       body: JSON.stringify({estado: 'cancelled'})
     }).then(r => r.json()).then(console.log)
     ```
     - Expected: **403 Forbidden** (RLS blocks the update)

**Expected:** 14/14 checks pass  
**Critical Alert:** If ANY permission is not enforced:
- Line 306 false → Coach can create as other coaches → RLS policy missing
- Line 308 false → Coach can edit others → RLS policy missing or capability check not applied
- Line 319 false → Direct API call succeeds → RLS policy not configured

---

### Step 6: UX Validation
**File:** `qa-sprint-5-5-agenda-realtime.js`  
**Function:** `QA_SPRINT_55.case_ux()`

1. In any window, paste: `QA_SPRINT_55.case_ux()`
2. Visual checks:
   - **State badges display correctly:**
     - scheduled = gray
     - confirmed = green
     - completed = blue
     - cancelled = red
   - **Error messages:**
     - Try creating event with missing time → Error shows?
     - Fix and retry → Error clears?
   - **Loading state:**
     - Click "Guardar" → Spinner visible while saving?
   - **Empty state:**
     - Create new coach/client with no sessions → "Sin eventos programados" message shows?
     - Does empty state have "Crear evento" button (if permitted)?
   - **Mobile responsive:**
     - Resize browser to 375px width (iPhone SE)
     - Does layout stack vertically?
     - Do buttons still work with touch?
   - **Timezone:**
     - All times shown in Europe/Madrid? (Check event created at 14:00 shows as 14:00 for Madrid timezone)

**Expected:** 10/10 checks pass

---

## Recording Results

After each test function, update `qa-sprint-5-5-agenda-realtime.js` with actual results:

```javascript
// Before:
check("login_as_coach", true, "Coach logs in (different user)");

// After (if it failed):
check("login_as_coach", false, "Coach login failed: password incorrect");
```

Then regenerate summary:
```javascript
QA_SPRINT_55.generate_summary()
```

Copy the console output and save to `/tmp/qa-results-sprint-55.txt`

---

## Pass Criteria

**PASS:** All 67 checks pass (100%)
```
╔═════════════════════════════════════════╗
║  SPRINT 5.5 QA SUMMARY                ║
╚═════════════════════════════════════════╝

Total: 67/67
Pass rate: 100%

✅ ALL CHECKS PASSED

Agenda Engine ready for PRODUCTION.
```

**FAIL:** Any check fails  
→ Document failure, fix code/RLS/permissions, re-test that section

---

## Known Pitfalls & Fixes

### Issue: "Realtime validation fails — Window B doesn't see Owner's changes"
**Root Cause:** Supabase realtime channel not active or event listener not wired  
**Fix:**
1. Check `pw-scheduler.js` line ~500: Is `supabase.channel()` being called?
2. Check `multicoach.html` / `panel-v2.html`: Does the `.on('*', handler)` attach?
3. Verify `renderScheduler()` is called inside the listener callback

### Issue: "Coach can edit other coaches' sessions (RLS not enforcing)"
**Root Cause:** Supabase RLS policy missing or buggy  
**Fix:**
1. Check RLS policies on `sesiones_registro`:
   - Policy for coaches: `coach_id = auth.uid()` (own sessions only)
   - Policy for owner: `owner_id = auth.uid()` (any in org)
2. Ensure `auth.uid()` matches the coach's `id` in users table (not `email`)
3. Test with `psql`: 
   ```sql
   SELECT * FROM sesiones_registro 
   WHERE coach_id != auth.uid() AND owner_id != auth.uid()
   -- If this returns rows, RLS is not enforcing
   ```

### Issue: "RLS blocks Owner (should allow)"
**Root Cause:** RLS policy too strict  
**Fix:**
1. Owner policy should check `owner_id = auth.uid()` OR `role = 'owner'`
2. Verify `role` column in `users` table has correct value

### Issue: "Client sees other clients' sessions"
**Root Cause:** RLS policy missing for client role  
**Fix:**
1. Add RLS policy: Clients can only see sessions where they are in `participantes` JSONB array
2. Test query: `SELECT * FROM sesiones_registro WHERE participantes @> '"<client-email>"'`

---

## Deliverables

After ALL tests pass:

1. **Console output screenshot** → Save from QA_SPRINT_55.generate_summary()
2. **Updated qa-sprint-5-5-agenda-realtime.js** → All checks reflect real results
3. **RLS SQL** → Copy final policies used for validation
4. **Git commit** → Push with message "Sprint 5.5: QA validation PASSED"

---

## Timeline

- **Setup:** 15 min (create users, populate data, open 3 windows)
- **Owner Flow:** 10 min
- **Coach Flow:** 10 min
- **Client Flow:** 5 min
- **Realtime:** 15 min (most critical, watch carefully for async issues)
- **Permissions:** 10 min
- **UX:** 10 min
- **Documentation:** 10 min

**Total:** ~85 minutes for full validation

---

## Exit Criteria

✅ Owner creates session → appears in all views  
✅ Coach edits → realtime sync without refresh  
✅ Client views but cannot edit  
✅ Permissions block unauthorized actions  
✅ RLS blocks direct API calls  
✅ UX complete: badges, errors, loading, empty states  
✅ Mobile responsive  
✅ All 67 checks pass  

**Once passed:** Agenda Engine is LOCKED for production. No code changes without explicit approval.
