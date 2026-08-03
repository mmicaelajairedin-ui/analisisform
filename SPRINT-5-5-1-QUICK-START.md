# Sprint 5.5.1 — Quick Start Validation

**Objective:** Execute 67 checks with real data in staging  
**Time:** ~2 hours  
**Deliverable:** Pass/fail report + fixes + screenshots

---

## SETUP (15 min)

### 1. Run SQL in Supabase Staging
```
supabase/migrations/sprint-5-5-staging-setup.sql
```
Creates:
- 3 test users (owner, coach, coach2, client)
- 3 test sessions (+2d, +3d, +4d from today)
- RLS policies (Owner sees all, Coach sees own, Client sees own)

### 2. Open 3 Browser Windows
- **Window A:** Login as `qa-owner@staging.test` → multicoach.html
- **Window B:** Login as `qa-coach@staging.test` → panel-v2.html
- **Window C:** Login as `qa-client@staging.test` → cliente.html

Keep all 3 visible side-by-side.

### 3. Load QA Runner
Paste in browser console (any window):
```javascript
// Load QA harness
var script = document.createElement('script');
script.src = '/qa-sprint-5-5-runner.js';
document.head.appendChild(script);
```

---

## PHASE 1: REALTIME SYNC (30 min) ← CRITICAL

**Window A (Owner):**
```javascript
QA_RUNNER.validate_realtime()
```

Follow console instructions:
1. Click "Crear Evento" → Select client + coach + date/time → Save
2. **WITHOUT refreshing** Window B or C, verify:
   - Coach sees new session appear
   - Client sees new session appear
3. Coach (Window B) clicks "Editar" → changes time → Save
4. **WITHOUT refreshing** Window A or C, verify:
   - Owner sees updated time
   - Client sees updated time
5. Coach clicks "Confirmar" (state → confirmed)
6. **WITHOUT refreshing**, verify:
   - All windows show green "confirmed" badge

**Result:** All 12 checks should pass  
**If fails:** Supabase realtime channel not wired → add subscription to renderAgenda()

---

## PHASE 2: SECURITY (30 min) ← CRITICAL

**Window A (Owner) or any window:**
```javascript
QA_RUNNER.validate_security()
```

Manual checks:
1. **Owner sees all:** Open multicoach → verify you see Coach2's session (should be visible)
2. **Coach sees own:** Open panel-v2 as coach → verify you see only your sessions
3. **Coach cannot edit other:** Try clicking "Editar" on Coach2's session → Button should be missing/disabled
4. **Client sees only own:** Open cliente.html as client → verify you see only your session
5. **RLS blocks API:** Paste in console:
```javascript
fetch('/rest/v1/sesiones_registro', {
  method: 'PATCH',
  body: JSON.stringify({estado: 'cancelled'})
}).then(r => r.json()).then(r => console.log('Status:', r.code, r.message))
```
Expected: `403 Forbidden` (RLS blocks unauthorized update)

**Result:** All 14 checks should pass  
**If fails:** RLS policy missing or auth context incorrect → check /supabase/migrations/

---

## PHASE 3: UX (30 min)

**Window A (Owner):**
```javascript
QA_RUNNER.validate_ux()
```

Visual checks (mark pass/fail in console):
1. **State badges:** Each session shows color-coded badge (gray=scheduled, green=confirmed, red=cancelled)
2. **Loading:** Click "Guardar" → spinner appears while saving
3. **Errors:** Try creating event with invalid date → error message shows
4. **Empty state:** Create new coach with no sessions → "Sin eventos programados" message
5. **Mobile:** Resize to 375px width → layout adapts (stack vertical)
6. **Timezone:** All times shown in Europe/Madrid (not UTC)

**Result:** All 10 checks should pass

---

## GENERATE REPORT

```javascript
QA_RUNNER.generate_report()
```

Copy the "EXPORT FOR REPORT" section.

---

## EXPECTED RESULTS

### ✅ PASS (all 67 checks)
```
Total Checks: 52/52
Pass Rate: 100%

✅ ALL CHECKS PASSED

Agenda Engine ready for PRODUCTION.
```

### ⚠️ FAIL (any check)
Document issue + cause + fix:
1. Issue: Realtime sync not working
2. Cause: Supabase realtime channel not subscribed
3. Fix: Add `.subscribe()` to channel in renderAgenda()
4. Re-test Phase 1

---

## DELIVERABLES

After all checks pass:

1. **QA Report**
   ```
   Summary: 52/52 passed (100%)
   
   Phases:
   - Realtime: 12/12 ✓
   - Security: 14/14 ✓
   - UX: 10/10 ✓
   ```

2. **Fixes List**
   - List any code changes made (if issues found)
   - Document RLS policy updates (if security issues)

3. **Screenshots**
   - Window A: Owner created session
   - Window B: Coach editing session
   - Window C: Client seeing updated session (no refresh)
   - Mobile view (375px) of agenda

4. **Commit**
   ```
   git add -A
   git commit -m "Sprint 5.5.1: Staging QA Validation PASSED

   Results: 52/52 checks passed (100%)
   
   - Realtime sync: ✓ no refresh needed
   - Security: ✓ permissions enforced, RLS blocks unauthorized
   - UX: ✓ states, errors, loading, mobile responsive
   
   Ready for USE_NEW_SCHEDULER=true in production
   "
   git push -u origin claude/multicoach-product-spec-m269gc
   ```

---

## IF ISSUES FOUND

### Issue: Realtime not working
**Cause:** Supabase realtime channel not subscribed  
**Fix:** In multicoach.html renderAgenda(), add after `renderScheduler()`:
```javascript
if(typeof supabase !== "undefined"){
  supabase.channel('sesiones_registro')
    .on('*', {event: '*'}, function(){
      renderAgenda(); // Re-render on changes
    })
    .subscribe();
}
```

### Issue: Coach can edit other coaches' sessions
**Cause:** RLS policy not enforced  
**Fix:** Check RLS policies in Supabase:
```sql
SELECT * FROM pg_policies WHERE tablename = 'sesiones_registro';
```
Ensure policy has: `coach_id = auth.uid()`

### Issue: Client sees other clients' sessions
**Cause:** RLS policy incomplete  
**Fix:** Client policy should check participantes JSONB:
```sql
participantes @> to_jsonb(current_user_email)
```

---

## Timeline

- Setup: 15 min
- Phase 1 (Realtime): 30 min
- Phase 2 (Security): 30 min
- Phase 3 (UX): 30 min
- Report + Fixes: 15 min
- **Total: ~2 hours**

---

## Success Criteria

✅ All 52 checks pass  
✅ No permission bypasses  
✅ Realtime sync (no refresh needed)  
✅ RLS enforced (unauthorized requests blocked)  
✅ UX complete (states, errors, loading, mobile)  

→ **Agenda Engine LOCKED for production**  
→ **Ready: USE_NEW_SCHEDULER=true**
