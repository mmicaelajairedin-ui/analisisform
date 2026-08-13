# FASE 1 — IMPLEMENTATION PLAN: AGENDA V2 + SALA PATHWAY PROVIDER

**Date:** August 13, 2026  
**Status:** BLOCKED until Phase 1A validation completes  
**Timeline:** 4 weeks (Week of September 3 - September 24, 2026)  
**Success Criteria:** V2 live in production, all citas routing to provider correctly, zero provider_url=NULL in completed sessions, Sala adoption ≥70%

---

## PART 1: SCOPE SUMMARY

### What We're Doing

1. **Deploy V2 data model** — 6 new columns to `citas` table (provider, provider_url, provider_ready_at, provider_error, provider_retry_count, sala_token)
2. **Implement provider abstraction** — Backend decides provider (Google Meet, Zoom, Pathway Room) AFTER booking confirms
3. **Change email contract** — Email service reads provider_url from DB instead of trusting HTML from frontend
4. **Update UI** — panel-v2 and cliente.html show provider-aware labels and status
5. **Zero-downtime migration** — V1 and V2 coexist during Phase 1, gradual switchover

### What We're NOT Doing

- ❌ Implementing new payment models or provider licensing
- ❌ Building admin dashboards for provider usage analytics (Phase 2+)
- ❌ Multi-provider load balancing (Phase 2+)
- ❌ Modifying RLS policies beyond provider field (Phase 2)
- ❌ Touching MultiCoach or other frozen modules

### What Gets Frozen

- Equipo (team management)
- Permiso (permissions system)
- Cobros (billing)
- Anything outside agenda + booking flow

---

## PART 2: TIMELINE (4 Weeks)

### Week 1: September 3-7 (Development Sprint)

**Goal:** Implement V2 backend and frontend, ready for Phase 1A testing

| Day | Component | Responsibility | Deliverable |
|-----|-----------|-----------------|------------|
| Mon-Tue | Supabase migration | Tech Lead | `ALTER TABLE citas ADD COLUMN...` deployed, indexes created, RLS verified |
| Tue-Wed | `select-provider` edge function | Backend | TypeScript function, logic tests pass (Google/Zoom/Sala decision tree) |
| Wed-Thu | `sync-provider-v2` edge function | Backend | Provider API calls, error handling, retry logic, idempotency verified |
| Thu-Fri | `send-email-v2` edge function | Backend | Modified to read DB, retry loop for provider_url |
| Thu-Fri | `reservar-v2.html` frontend | Frontend | New booking form, insert with `provider='none'`, NO provider logic in frontend |
| Fri | `panel-v2.html` updates | Frontend | Show provider status (PENDING/READY/ERROR), "Reintentar" button |
| Fri | `cliente.html` updates | Frontend | Show provider_url link with label (Google Meet / Zoom / Sala Pathway) |
| Fri | Smoke tests | QA | Local test: create cita, verify provider flow end-to-end |

**Gate:** Code review on all edge functions, smoke tests green, ready for Phase 1A

---

### Week 2: September 10-14 (Phase 1A Internal Testing)

**Goal:** Validate Sala Pathway viability with internal pair (Micaela + QA tester)

**Execution:** Run scenarios A-I from SALA-PATHWAY-VALIDATION-PLAN.md Part 2-6

| Scenario | Duration | Owner | Go/No-Go |
|----------|----------|-------|---------|
| A (Coach first, 5 min wait) | 10 min | QA | ✅ Go or 🛑 BLOCKER |
| B (Client first, 5 min wait) | 10 min | QA | ✅ Go or 🛑 BLOCKER |
| C (Simultaneous join) | 5 min | QA | ✅ Go or 🛑 BLOCKER |
| Chat (Test 1) | 5 min | QA | ✅ Go or ⚠️ HIGH |
| Screen share (Test 2) | 5 min | QA | ✅ Go or ⚠️ HIGH |
| Audio quality (Test 3) | 10 min | QA | ✅ Go or ⚠️ HIGH |
| Video quality (Test 4) | 10 min | QA | ✅ Go or ⚠️ HIGH |
| Mobile Android (Scenario E) | 10 min | QA | ✅ Go or ⚠️ HIGH |
| Room isolation (Scenario I) | 10 min | QA | ✅ Go or 🛑 BLOCKER |

**Decision Friday, September 14:**
- **BLOCKER or 2+ HIGH failures** → Fix bugs, retry Phase 1A Week 3
- **All scenarios PASS or 1 HIGH with workaround** → Proceed to Phase 1B

---

### Week 3: September 17-21 (Phase 1B Pilot + Fixes)

**Goal:** Validate with 5-10 volunteer coaches, gather feedback, fix non-blocker issues

**Setup:**
- Invite coaches from existing customer base
- Each coach pair: desktop + mobile test (A, B, C + audio/video/chat + 30-min endurance)
- Collect results in standardized JSON (SALA-PATHWAY-VALIDATION-PLAN.md Part 8)

**Daily standups (Micaela + Tech Lead):**
- Any BLOCKER reported? → Priority fix, re-test same coach
- HIGH issue? → Document, continue testing, batch fixes
- All coaches reporting PASS? → Confidence builds

**Friday decision:** Launch decision gate (Part 1, "PHASE 1B → PRODUCTION APPROVAL")

---

### Week 4: September 24-28 (Go-Live Preparation)

**If Phase 1B all PASS:**
- Micaela sign-off (Part 1, "BEFORE PUBLIC LAUNCH → MICAELA SIGN-OFF")
- Final smoke test in staging
- Prod deployment (database migration + edge functions + HTML)
- Monitor first 24h for errors, be ready to rollback

**If Phase 1B has non-blocker issues:**
- Deploy with feature flag: `ENABLE_V2_BOOKING=true/false`
- Gradually enable for 10% of coaches first, monitor, ramp to 100%
- Or: delay to Week 5 for additional fixes

---

## PART 3: INFRASTRUCTURE REQUIREMENTS

### Supabase Changes

| Item | Current State | Required for V2 | Effort |
|------|---------------|-----------------|--------|
| `citas` table schema | 15 columns | +6 new columns (see schema below) | 1 hour (migration + index) |
| RLS policies | Existing per-coach filters | No change needed (column-level SELECT/UPDATE rules) | 0 hours |
| Edge functions quota | 3 functions (sync-cita-to-gcal, gcal-push, send-email) | +2 functions (select-provider, sync-provider-v2) = 5 total | 0 hours (no quota increase needed) |
| Edge function logs | Currently logged to stdout | Need structured logging for provider decision + sync retries | 2 hours (log parser) |
| JWT secrets | Existing (Stripe, EmailJS, Uploadcare) | +Google OAuth (refresh), Zoom OAuth (optional), Sala (no auth needed) | 1 hour (config) |

### New Columns (Idempotent Migration)

```sql
-- supabase/migrations/add_v2_provider_columns.sql
ALTER TABLE citas ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'none' 
  CHECK (provider IN ('none', 'google_meet', 'zoom', 'pathway_room'));
ALTER TABLE citas ADD COLUMN IF NOT EXISTS provider_url TEXT;
ALTER TABLE citas ADD COLUMN IF NOT EXISTS provider_ready_at TIMESTAMPTZ;
ALTER TABLE citas ADD COLUMN IF NOT EXISTS provider_error TEXT;
ALTER TABLE citas ADD COLUMN IF NOT EXISTS provider_retry_count INT DEFAULT 0;
ALTER TABLE citas ADD COLUMN IF NOT EXISTS sala_token TEXT;

-- Indexes for async job processing
CREATE INDEX IF NOT EXISTS idx_citas_provider_pending 
  ON citas(provider_ready_at DESC, provider_error) 
  WHERE provider_ready_at IS NULL AND provider_error IS NULL;
CREATE INDEX IF NOT EXISTS idx_citas_provider_error 
  ON citas(creada_at DESC) 
  WHERE provider_error IS NOT NULL;

-- Comment for debugging
COMMENT ON COLUMN citas.provider IS 
  'Provider decided by select-provider after booking confirmed. Values: none (default, legacy) | google_meet | zoom | pathway_room';
COMMENT ON COLUMN citas.provider_url IS 
  'URL to join meeting. Set by sync-provider-v2 after provider API succeeds. NULL means sync in progress or failed.';
COMMENT ON COLUMN citas.sala_token IS 
  'JWT token for Sala Pathway room access. Generated client-side in sala.html, stored for audit trail.';
```

### Secrets (Supabase Edge Functions)

No new secrets needed if:
- Google OAuth already configured (auto-refresh token)
- Zoom integration (if using) already has API key
- Sala (self-hosted) needs no auth

If Google OAuth not yet set up:
- Create OAuth client in Google Cloud Console (or use existing from gcal-push)
- Store `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN` in Supabase Secrets

---

## PART 4: COMPONENT BREAKDOWN & RESPONSIBILITIES

### Edge Functions

#### 1. `select-provider` (New)

**Purpose:** Decide which provider to use after cita is confirmed

**Responsibility:** Backend only

**Decision tree:**
```
if (coach.zoom_token exists AND zoom_token.valid) {
  return 'zoom'
} else if (coach.google_refresh_token exists AND google_token.valid AND NOT coach.email.endsWith('@gmail.com')) {
  return 'google_meet'
} else {
  return 'pathway_room'
}
```

**Triggers:** Runs async after cita INSERT confirmation (webhook or background job)

**Output:** `{ provider: 'google_meet' | 'zoom' | 'pathway_room' }`

**Error handling:** If all tokens invalid or missing → default 'pathway_room' (never fail)

**Owner:** Tech Lead

---

#### 2. `sync-provider-v2` (New)

**Purpose:** Call provider API and sync meeting URL back to DB

**Responsibility:** Backend only

**Inputs:**
```json
{
  "cita_id": "uuid",
  "coach_id": "uuid",
  "provider": "google_meet | zoom | pathway_room",
  "event_data": { "titulo": "1:1 Coaching", "fecha": "2026-09-10T15:00:00Z", ... }
}
```

**Retry strategy:**
- Retriable errors (timeout, rate limit, transient network): retry with backoff [2s, 4s, 8s, 16s, 60s]
- Non-retriable (401 auth, 403 revoked, 422 invalid data): fail immediately, set `provider_error`
- Max retries: 5
- Timeout per call: 15s

**On success:** `PATCH citas SET provider_url=$url, provider_ready_at=now(), provider_error=NULL`

**On failure:** `PATCH citas SET provider_error=$error_msg, provider_retry_count++`

**Idempotency:** If already patched, don't patch again (check provider_ready_at IS NOT NULL)

**Owner:** Tech Lead

---

#### 3. `send-email-v2` (Modified)

**Purpose:** Send coaching cita email with provider link

**Responsibility:** Backend reads DB

**Changes:**
```typescript
// OLD: trust HTML passed from frontend
const html = req.body.html; // ❌ WRONG: sent before provider_url available

// NEW: read cita from DB and wait for provider_url
let cita = await supabase.from('citas').select('provider_url, provider, cliente_email').eq('id', cita_id).single();
let retries = 5;
while (cita.provider_url === null && retries > 0) {
  await delay(30_000); // wait 30s
  cita = await supabase.from('citas').select('provider_url, provider').eq('id', cita_id).single();
  retries--;
}

if (!cita.provider_url) {
  return { ok: false, error: 'provider_url not set after retries' };
}

// Build email HTML server-side with provider label
const html = buildEmailHTML({
  provider: cita.provider,
  provider_url: cita.provider_url,
  titulo: cita.titulo,
  ...
});

// Send via EmailJS / Brevo
const result = await sendEmail(cita.cliente_email, html);
return { ok: result.ok };
```

**Trigger:** After `sync-provider-v2` succeeds (provider_url set)

**Owner:** Backend

---

### Frontend Components

#### 4. `reservar-v2.html` (New/Modified)

**Purpose:** Booking form (replaces or mirrors reservar.html)

**Changes:**
- Insert cita with `provider='none'` (NOT decided here)
- `estado='confirmada'` immediately
- DO NOT call provider APIs
- DO NOT try to guess provider_url
- Show confirmation: "Tu cita está confirmada. Estamos preparando el enlace de videoconferencia..."

**Responsibilities:**
1. Collect: title, date, time, coach_id, client_email, client_name
2. Validate: date is future, date not already booked
3. INSERT to `citas` with `provider='none'`
4. Redirect to confirmation page or panel

**NO provider logic in frontend code**

**Owner:** Frontend (Micaela or dev)

---

#### 5. `panel-v2.html` (Modified)

**Purpose:** Coach's booking management panel

**Changes:**
1. Show provider status for each cita:
   ```
   ✅ READY: [Google Meet link] OR [Zoom link] OR [Entrar a Sala]
   ⏳ PENDING: "Preparando enlace..."
   ❌ ERROR: [error message] [Reintentar button]
   ```

2. "Reintentar" button for ERROR state:
   ```typescript
   async function retryProvider(cita_id) {
     const result = await fetch('/functions/v1/sync-provider-v2', {
       method: 'POST',
       body: JSON.stringify({ cita_id })
     });
     if (result.ok) {
       showNotification('Reintentando sincronización...');
       // Poll or await webhook to update UI
     }
   }
   ```

3. Read from DB: `provider`, `provider_url`, `provider_error`, `provider_retry_count`

4. Icon/label for each provider:
   - Google Meet: 🎥 "Videollamada Google"
   - Zoom: 🎥 "Videollamada Zoom"
   - Sala Pathway: 🚪 "Sala Pathway"

**Owner:** Frontend

---

#### 6. `cliente.html` (Modified)

**Purpose:** Client portal, show meeting links

**Changes:**
1. In dashboard or "Sesiones" tab, show cita with provider link:
   ```html
   <div class="session">
     <p>Coaching Session — Sept 10, 3:00 PM</p>
     <p>Status: 
       <span id="provider_status">Preparando enlace...</span>
     </p>
     <a id="provider_link" href="#">Entrar a la videoconferencia</a>
   </div>
   ```

2. Fetch and update:
   ```typescript
   const cita = await supabase.from('citas').select('provider, provider_url, estado').eq('id', cita_id).single();
   if (cita.provider_url) {
     document.getElementById('provider_link').href = cita.provider_url;
     document.getElementById('provider_link').textContent = providerLabel(cita.provider);
     document.getElementById('provider_status').textContent = '✅ Listo';
   } else if (cita.estado === 'confirmada') {
     document.getElementById('provider_status').textContent = '⏳ En preparación...';
   } else {
     document.getElementById('provider_status').textContent = '❌ Error — contacta al coach';
   }
   ```

3. Poll DB every 10s until provider_url appears (or timeout after 5 min)

**Owner:** Frontend

---

### Legacy Components (V1 Frozen During Phase 1)

#### 7. `reservar.html` (V1 - READ ONLY)

**Status:** Not modified during Phase 1
**Purpose:** Legacy bookings continue to use old flow
**Why:** Zero-downtime migration: some coaches may still use V1 form

---

#### 8. `sync-cita-to-gcal` (V1 - READ ONLY)

**Status:** Not modified; receives `provider_error` contract change from earlier audit
**Purpose:** Still syncs Google Calendar events for historical data
**Why:** Coaches with Google OAuth can still use GCal sync (doesn't conflict with V2 provider)

---

#### 9. `sala.html` (V1 - PROMOTED)

**Status:** Promoted to first-class provider in V2
**New responsibility:** Handle Sala bookings from reservar-v2.html
**Changes needed:** Receive `room_id` in URL params instead of seat key
**Owner:** Frontend (verify token validation works with V2 schema)

---

## PART 5: RISK REGISTER & MITIGATION

### Risk 1: Provider URL Never Populated (Provider Sync Fails Silently)

**Likelihood:** HIGH (async race between email send and sync-provider-v2)  
**Impact:** HIGH (email has no link, client confused)  

**Mitigation:**
1. Email service waits for provider_url (30s retry loop, Part 4 component 3)
2. Monitoring alert: `SELECT COUNT(*) FROM citas WHERE provider_url IS NULL AND creada_at > now() - interval '1 hour' AND estado='confirmada'` should be <1
3. Fallback email: if provider_url not ready after 5 min, send email anyway with "link coming soon" (better UX than silent fail)
4. Test: deliberately fail sync-provider-v2 for one cita, verify email handling

**Owner:** Tech Lead (implement + test)

---

### Risk 2: Provider Decision Wrong (Wrong Provider Selected)

**Likelihood:** MEDIUM (coach has multiple tokens, logic picks wrong one)  
**Impact:** MEDIUM (coach uses Zoom link when expecting Google Meet)  

**Mitigation:**
1. Clear UI: show which provider was selected on confirmation page
2. Coach can edit before confirmation: "Provider: [Zoom ▼] [Change]"
3. Monitoring: dashboard showing provider distribution by coach (why is coach always getting Zoom when Google available?)
4. Test: coach with multiple tokens, verify correct decision tree

**Owner:** Tech Lead (logic verification)

---

### Risk 3: Room Isolation Fails (Audio Cross-Talk)

**Likelihood:** LOW (code audit passed, P2P/TURN separate)  
**Impact:** CRITICAL (privacy breach, coaching content leaked)  

**Mitigation:**
1. Part 6 of validation plan: explicit room isolation test (Scenario I)
2. If fails: BLOCKER, do NOT launch V2
3. Root cause: token validation in sala.html (verify rooms use distinct cita.sala_token)
4. Fallback: disable Sala provider, revert to Google Meet only

**Owner:** Tech Lead (mandatory test before prod)

---

### Risk 4: Google/Zoom Token Expiration, No Fallback

**Likelihood:** MEDIUM (tokens expire, refresh fails)  
**Impact:** HIGH (coach booking broken, client sees ERROR)  

**Mitigation:**
1. select-provider checks token.expires_at, refreshes if needed
2. If refresh fails: fall back to pathway_room
3. Email to coach: "Your Google token expired, we've switched to Sala Pathway for this session"
4. Coach can re-auth Google/Zoom in settings to restore preference
5. Test: deliberately expire token, verify fallback

**Owner:** Tech Lead

---

### Risk 5: Rollback Needed (Major Bug in V2)

**Likelihood:** LOW (Phase 1 validation mitigates)  
**Impact:** HIGH (coaching sessions interrupted)  

**Mitigation:**
1. Feature flag: `ENABLE_V2_BOOKING=false` disables all new V2 code, routes to V1
2. Rollback procedure (Part 7 below): 1-click revert to V1
3. Have V1 and V2 coexist for 2 weeks: if V2 issues arise, flip flag and continue on V1
4. Monitoring: error rate by provider (if V2 errors spike, auto-flag)

**Owner:** Tech Lead + Micaela (decision to rollback)

---

### Risk 6: Email Contract Change Breaks Existing Integrations

**Likelihood:** LOW (only send-email modified, controlled by Supabase)  
**Impact:** MEDIUM (email templates hardcoded in frontend may still work but future changes conflict)  

**Mitigation:**
1. Deprecate all HTML templates passed from frontend (reservar.html)
2. Send-email-v2 is server-side only: templates live in `supabase/functions/send-email-v2/templates.html`
3. Gradual deprecation: old templates still work but log warning, new deployments use send-email-v2
4. Test: old flow (reservar.html → send-email) still works; new flow (reservar-v2.html → send-email-v2) works

**Owner:** Backend

---

### Risk 7: Mobile/iOS Sala Performance Issues Discovered Late

**Likelihood:** MEDIUM (code audit doesn't catch runtime issues)  
**Impact:** MEDIUM (iOS users can't join, relegated to audio-only)  

**Mitigation:**
1. Phase 1A and 1B explicitly test iOS Safari (scenarios F)
2. If issues found: document as limitation, provide workaround
3. If show-stopper: disable Sala for iOS, fall back to Google Meet (if available)
4. Monitoring: session_errors by platform (iOS, Android, Desktop)

**Owner:** QA (Phase 1A/1B testing)

---

### Risk 8: Performance Regression (Polling DB Every 10s, High Query Load)

**Likelihood:** LOW (select * from citas WHERE id is single row, fast)  
**Impact:** LOW (database load spike)  

**Mitigation:**
1. cliente.html polls every 10s (not 1s), timeout after 5 min
2. Monitor: query count on citas SELECT by hour
3. If load spike: implement WebSocket subscription instead of polling (Phase 2)
4. Benchmark: 1000 clients polling every 10s = 100 queries/sec, Supabase can handle

**Owner:** Backend (monitoring)

---

## PART 6: DECISIONS REQUIRING MICAELA APPROVAL

| # | Decision | Options | Recommendation | Owner |
|---|----------|---------|-----------------|-------|
| 1 | **Go/No-Go after Phase 1A** | Launch Phase 1B OR Fix+Retry Phase 1A | Tech Lead proposes, Micaela decides Friday Sept 14 | Micaela |
| 2 | **Go/No-Go after Phase 1B** | Full launch OR Gradual rollout (10%→100%) OR Delay | Tech Lead + Micaela joint decision Friday Sept 21 | Micaela |
| 3 | **Sala as default** | Yes (default if Google/Zoom unavailable) OR No (only opt-in) | Default (reduces friction, proven code) | Micaela |
| 4 | **Kill V1 Booking** | Migrate all coaches to V2 OR Keep both during Sept | Hybrid: new coaches → V2, existing coaches → both | Micaela |
| 5 | **Rollback plan** | Feature flag OR Full revert to Sept 2 code | Feature flag (safest, can toggle instantly) | Tech Lead + Micaela |

---

## PART 7: ROLLBACK PROCEDURE (If Needed)

**Scenario:** Major bug discovered in production (e.g., room isolation fails)

**Time to rollback:** <5 minutes

**Steps:**
1. **Immediate action:** Set `ENABLE_V2_BOOKING=false` in Supabase env vars
2. **Route existing V2 citas:** Manually sync any pending provider_urls to meet_link (1-time SQL script)
3. **Notify coaches:** "V2 temporarily disabled, using Sala/Google Meet for new bookings"
4. **Investigate:** Root cause analysis (log review, code audit)
5. **Fix:** Deploy patch to Edge Functions or HTML
6. **Re-enable:** Set `ENABLE_V2_BOOKING=true`, monitor for 1 hour

**No data loss:**
- All V2 columns remain (nullable, backward compatible)
- V1 code still works as before
- Coaches don't lose bookings

---

## PART 8: TEAM RESPONSIBILITIES

| Role | Sprint Tasks | Success Criteria |
|------|--------------|------------------|
| **Tech Lead** | Supabase migration + 2 edge functions (select-provider, sync-provider-v2) + monitoring setup | Code reviewed, smoke tests green, deployment doc ready |
| **Backend** | send-email-v2 modification + error handling + retry logic | Email tests pass, provider_url read from DB not frontend |
| **Frontend** | reservar-v2.html + panel-v2 updates + cliente.html updates | Providers shown correctly, "Reintentar" button works, polling implemented |
| **QA** | Phase 1A validation (internal pair) + Phase 1B coordination (5-10 coach pairs) | Test matrix completed, all results logged, blocker escalated |
| **Micaela** | Coach recruitment (5-10 pilot coaches), daily standups, go/no-go decisions | Phase 1B complete by Sept 21, launch decision made |

---

## PART 9: DEPLOYMENT STEPS (Week 4)

### Pre-Deployment Checklist

- [ ] All Phase 1B tests passed (or approved with workaround)
- [ ] Code reviewed and merged to main
- [ ] Monitoring dashboards set up (error rate, provider distribution, response times)
- [ ] Rollback plan tested (feature flag toggles correctly)
- [ ] Team trained on new flow and troubleshooting

### Deployment (Prod, Friday Sept 24)

1. **10:00 AM:** Database migration
   ```bash
   supabase migration deploy
   ```

2. **10:15 AM:** Deploy edge functions
   ```bash
   supabase functions deploy select-provider --no-verify-jwt
   supabase functions deploy sync-provider-v2 --no-verify-jwt
   supabase functions deploy send-email-v2 --no-verify-jwt
   ```

3. **10:30 AM:** Deploy frontend (reservar-v2.html, panel-v2, cliente.html)
   ```bash
   git push origin main  # auto-deploys via Cloudflare Pages
   ```

4. **10:45 AM:** Smoke test
   - Create test cita via reservar-v2.html
   - Verify provider selected and synced
   - Verify email arrives with provider_url
   - Verify client portal shows link

5. **11:00 AM:** Monitor for 1 hour
   - error_rate dashboard
   - client_errors table for XSS/auth issues
   - provider distribution (should match decision tree)
   - email delivery rate

### Post-Deployment (First 24h)

- Micaela monitors coaching sessions
- Coach feedback collected (Slack channel: #v2-launch)
- If issue: escalate immediately, consider rollback
- If smooth: celebrate! 🎉

---

## PART 10: SUCCESS METRICS

**Phase 1 is successful if:**

| Metric | Target | Owner |
|--------|--------|-------|
| Phase 1A scenarios pass | ≥80% (A, B, C, I must 100% pass) | QA |
| Phase 1B coaches approve | ≥80% recommend Sala | Micaela (survey) |
| Prod citas with provider_url | ≥95% within 5 min of creation | Backend (monitoring) |
| Email delivery rate | ≥98% | Backend (EmailJS logs) |
| Zero room isolation failures | 100% | QA (validation) |
| Rollback time if needed | <5 minutes | Tech Lead (procedure tested) |
| Coach support tickets | <3/week provider-related | Micaela |

---

## PART 11: PHASE 2+ ROADMAP (Do Not Implement in Phase 1)

These are explicitly OUT OF SCOPE for Phase 1:

- ❌ Provider analytics dashboard (usage by provider, cost tracking)
- ❌ Coach provider preference editor (let coach choose default)
- ❌ Load balancing (auto-switch provider if one fails)
- ❌ Multi-language support for provider labels
- ❌ Webhook-based provider status updates (polling only, Phase 1)
- ❌ Video recording integration (Sala + Google Meet archiving)

---

## SUMMARY

**Phase 1 is NOT a full product launch. It's a minimal viable deployment of V2 architecture with Sala Pathway as the primary provider, validated with real coaches and clients.**

**Key principle:** Move fast, validate often, rollback easily. If Phase 1A fails, learn and retry. If Phase 1B fails, toggle feature flag and iterate without disrupting production.

**Next checkpoint:** Micaela's approval of SALA-PATHWAY-VALIDATION-PLAN.md test results (Friday, Sept 14 for Phase 1A go/no-go).
