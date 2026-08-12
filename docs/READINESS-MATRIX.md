# PATHWAY → MULTICOACH INTEGRATION READINESS MATRIX

## Status Summary

| Category | Status | Blocker? | Timeline |
|----------|--------|----------|----------|
| **RLS Security** | 🟡 Weak point | ⚠️ Conditional | Pre-launch |
| **mi-red Validation** | 🟡 Acceptable | ❌ No | Post-MVP |
| **coach_id Sync** | 🔴 CRITICAL | ✅ YES | Pre-launch |
| **organizations dual** | 🟡 Low risk | ❌ No | Post-MVP |
| **Branding/XSS** | 🟡 Low risk | ❌ No | Post-MVP |
| **Performance** | 🟡 Acceptable | ❌ No | Post-MVP |

---

## Detailed Assessment

### 🔴 BLOCKER — coach_id vs coach_client_assignments Divergence

**Severity:** CRITICAL  
**Discovery:** Edge functions update `candidatos.coach_id` but NOT `coach_client_assignments`  
**Evidence:** 
- `reassign-client/index.ts:114` — PATCH candidatos ONLY
- `asignar-cliente/index.ts:102` — PATCH candidatos ONLY
- No triggers in 0102_coach_client_assignments.sql
- No auto-sync code found

**Failure Scenario:**
1. Owner assigns client via MultiCoach → calls `asignar-cliente` edge function
2. Edge function updates `candidatos.coach_id` ✅
3. `coach_client_assignments` remains unchanged ❌
4. Coach tries to read via panel-v2 → RLS policy validates assignments table → BLOCKED
5. Coach tries to write via panel-v2 → App filter validates candidatos.coach_id → ALLOWED
6. Result: Coach can edit but can't see (confusing, data integrity risk)

**Current Mitigation:** NONE  
**Impact on MultiCoach:** Can't guarantee coaches see their newly-assigned clients  
**Impact on Panel:** Confusing UX (can edit but can't read)  
**Impact on CLI ent:** Client sees coach changes but coach doesn't see client

**Fix Required:** 
- Option A: Create trigger on `candidatos.coach_id` UPDATE to sync `coach_client_assignments`
- Option B: Modify edge functions to create/update assignment record
- Option C: Change RLS policy to validate `candidatos.coach_id` instead of assignments

**Status:** ❌ **MUST FIX BEFORE LAUNCH**

---

### 🟡 WEAK POINT — RLS Depends on coach_client_assignments Consistency

**Severity:** MEDIUM  
**Discovery:** RLS policy validates assignments table, but edge functions don't keep it sync'd  
**Evidence:**
```sql
-- rls_candidatos_coach_reads_assigned (0105_rls_candidatos_org.sql:28-40)
EXISTS (
  SELECT 1 FROM coach_client_assignments a
  JOIN usuarios u ON u.id = a.coach_id
  WHERE a.client_id = candidatos.id AND u.auth_id = auth.uid() AND a.estado = 'activa'
)
```

**Failure Scenario:** See above (coach_id divergence)

**Impact if NOT Fixed:**
- POST-reassignment: New coach can't read client via panel RLS
- New coach can update via app-layer filter (coach_id match)
- Silent data inconsistency

**Current Mitigation:** App-layer filter `cg()` in panel-v2 (defense-in-depth, but doesn't solve root)  
**Likelihood of Bug:** HIGH (every reassignment creates divergence)  
**Status:** ⚠️ **CONDITIONAL BLOCKER** (depends on fix to coach_id sync)

---

### 🟡 ACCEPTABLE — mi-red Validation (Email-Only, No auth_id Check)

**Severity:** MEDIUM  
**Discovery:** mi-red validates owner via email lookup, not auth_id  
**Evidence:**
```typescript
// Line 81-84: callerEmail() extracts from JWT, then:
const owners = await q(`usuarios?email=eq.${encodeURIComponent(email)}&rol=eq.owner&limit=1`);
// No secondary auth_id validation
```

**Failure Scenario (Theoretical):**
1. Attacker compromises owner email
2. Creates separate account in usuarios table with same email + rol='owner'
3. Logs in with their credentials
4. JWT email = owner email (but JWT auth_id = attacker_id)
5. mi-red validates email = owner, returns org data

**Likelihood:** VERY LOW (requires):
- Email compromise + auth.users account creation
- Or sync bug between auth.users.email and usuarios.email
- Supabase Auth would still validate JWT correctly

**Current Mitigation:** Supabase Auth signature validation (strong)  
**Recommended Fix:** Secondary auth_id check (defense-in-depth)  
**Status:** ✅ **ACCEPTABLE FOR MVP** (implement post-launch)

---

### 🟡 LOW RISK — organizations vs organizations (Dual Table)

**Severity:** LOW  
**Discovery:** `organizaciones` (active) and `organizations` (inactive) coexist  
**Evidence:**
- Migration 003_coach_client_assignments.sql mentions organizations
- Code uses organizaciones exclusively (45+ refs in panel, 20+ in multicoach)
- organizations has ~0 usage in current codebase

**Failure Scenario:**
1. Future feature added using `organizations` table
2. No sync with `organizaciones`
3. Org data diverges
4. MultiCoach can't see new features

**Likelihood:** LOW (organizations currently unused)  
**Current Mitigation:** None (but unused table = low risk)  
**Recommended Action:** Deprecate `organizations` or complete migration  
**Status:** ✅ **SAFE FOR MVP** (document and monitor)

---

### 🟡 LOW RISK — Branding Logo URL (XSS Potential)

**Severity:** MEDIUM (potential)  
**Discovery:** marca.logo URL not sanitized before rendering  
**Evidence:**
```javascript
// cliente.html line ~1943+: marca JSONB loaded
var m=(rows[0]&&rows[0].marca)||{};
// Later rendered as: <img src=m.logo>
// No validation of URL scheme
```

**Failure Scenario:**
```json
{ "logo": "javascript:alert('xss')" }
// Or: "data:text/html,<script>alert('xss')</script>"
```

**Likelihood:** LOW (owner is trusted, only owner edits marca)  
**Current Mitigation:** Owner-level access control (Supabase Auth + RLS)  
**Recommended Fix:** URL validation (whitelist http/https schemes)  
**Status:** ✅ **ACCEPTABLE FOR MVP** (implement post-launch)

---

### 🟡 ACCEPTABLE — Performance (No Paginatio, Queries Sequential)

**Severity:** MEDIUM (for large orgs)  
**Discovery:** mi-red returns full dataset without LIMIT or pagination  
**Evidence:**
```typescript
// Line 69: candidatos query without LIMIT
const clientes = await q(`candidatos?org_id=eq.${encodeURIComponent(orgId)}&select=...`);
// Returns ALL rows (5000+ in large org)
```

**Failure Scenario:**
1. Large org (2000+ clients) opens MultiCoach
2. mi-red fetches all 2000+ rows, 500+ citas
3. Response JSON = >5MB
4. Browser parsing = 300-500ms
5. Dashboard appears slow (or fails on mobile)

**Current Behavior:**
| Org Size | Expected Time | Status |
|----------|---------------|--------|
| <100 clients | 100-150ms | ✅ OK |
| 500 clients | 200-300ms | ✅ OK |
| 2000+ clients | 500-800ms+ | 🟡 Noticeable |

**Likelihood:** MEDIUM (depends on customer org size)  
**Current Mitigation:** None  
**Recommended Fix:** Pagination (LIMIT 1000) + parallel queries  
**Status:** ✅ **ACCEPTABLE FOR MVP** (optimize post-launch)

---

## Final Recommendation

### ✅ GREEN TO PROCEED WITH CONDITIONS:

1. **MUST FIX (Pre-Launch):**
   - coach_id ↔ coach_client_assignments sync (create trigger or modify edge functions)

2. **SHOULD FIX (Pre-Launch):**
   - None (others are post-MVP)

3. **CAN DEFER (Post-MVP):**
   - mi-red auth_id secondary check
   - mi-red performance optimization
   - Branding URL sanitization
   - organizations table deprecation

### Timeline:

| Phase | Tasks | Est. Time |
|-------|-------|-----------|
| **Blocking Fix** | coach_id sync trigger | 2-4 hours |
| **MVP** | MultiCoach integration tests | 1-2 days |
| **Post-MVP** | Performance, security hardening | 1 sprint |

---

## Verdict

**🟢 PROCEED WITH MULTICOACH INTEGRATION** (after fixing coach_id sync)

The Pathway schema is production-ready for MultiCoach IF you resolve the coach_id/assignments divergence. All other findings are post-MVP optimizations.

**Risk if you launch without fixing coach_id sync:** HIGH (silent data inconsistency, coach confusion)  
**Risk if you defer other fixes:** LOW (degraded performance/security in edge cases, manageable post-MVP)
