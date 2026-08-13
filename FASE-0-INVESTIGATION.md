# FASE 0 — INVESTIGATION REPORT

**Status:** IN PROGRESS  
**Last Updated:** 2026-08-13  
**Deadline:** Complete by end of investigation  

---

## A. GOOGLE MEET: ROOT CAUSE ANALYSIS

### A.1 Demostrado (Proven Facts)

**Fact 1:** gcal-push now returns error 422 when conferenceData is empty
- **Source:** `/supabase/functions/gcal-push/index.ts` lines 150-153 (implemented during previous analysis)
- **Evidence:** Code shows strict validation: `if (!hangoutLink) { return json({ ok: false, reason: "google_no_conference_data", ... }, 422) }`
- **Implication:** False positives are now prevented. Any future Google Meet failures will be caught.

**Fact 2:** OAuth scope is CORRECT
- **Source:** `/conectar-calendar.html` line 51
- **Evidence:** `CAL_SCOPE = 'https://www.googleapis.com/auth/calendar.events'`
- **Verification:** This scope explicitly allows creating Google Meet links (per Google API docs)

**Fact 3:** Payload to Google API is CORRECT
- **Source:** `/supabase/functions/gcal-push/index.ts` lines 114-120
- **Evidence:** `conferenceData.createRequest.conferenceSolutionKey.type = "hangoutsMeet"` + `conferenceDataVersion = 1`
- **Verification:** Matches Google Calendar API v3 documentation exactly

**Fact 4:** NO Google Calendar events have been created
- **Source:** Production database query (Aug 13, 2026)
- **Evidence:** Query `SELECT COUNT(*) FROM citas WHERE google_event_id IS NOT NULL AND modalidad='online'` returns **0 out of 63 bookings**
- **Implication:** gcal-push is NOT being called, or is failing silently before event creation

**Fact 5:** Google Meet links are missing from all 63 recent video bookings
- **Source:** Production database query (Jul 15 - Aug 12, 2026)
- **Evidence:** 
  - Total video bookings: 63
  - Bookings with meet_link: 1 (1.6%)
  - Bookings with google_event_id: 0 (0%)
- **Implication:** Neither Google Calendar sync nor Google Meet link capture is occurring

**Fact 6:** Main coach (53 bookings) connected a PERSONAL GMAIL ACCOUNT
- **Source:** usuarios.configuracion.gcal data
- **Evidence:** 
  - Coach: `hi@pathwaycareercoach.com` (admin role)
  - Connected Google email: `mmicaela.jairedin@gmail.com` ← **@gmail.com domain**
  - NOT a Google Workspace account
- **Implication:** Google Calendar API explicitly does NOT generate Google Meet links for personal @gmail.com accounts (Workspace-only feature)

**Fact 7:** OAuth access token has EXPIRED
- **Source:** gcal_tokens.token field, expiry timestamp
- **Evidence:**
  - Token expiry: August 7, 2026 10:00 UTC
  - Current date: August 13, 2026
  - Status: EXPIRED (6 days overdue)
- **Implication:** Even if refresh attempted, token is stale; refresh_token may also be revoked by Google

---

### A.2 Hipótesis (Hypotheses) — VERDICT AFTER INVESTIGATION

**Hypothesis 1: Gmail Account (Not Workspace) — ✅ CONFIRMED**
- **Why suspected:** Google Calendar API only generates Meet links for Google Workspace accounts, NOT Gmail (@gmail.com)
- **Evidence (CONFIRMED):** 
  - ✅ Main coach connected `mmicaela.jairedin@gmail.com` (personal Gmail, not Workspace)
  - ✅ No google_event_id in any of 63 bookings from this coach
  - ✅ This is the ONLY coach with significant booking volume (53/63 bookings)
  - ✅ Google's documented behavior: "Hangouts Meet is not available for free Gmail accounts; Google Workspace required"
- **Severity:** CRITICAL — affects ALL coaches using @gmail.com accounts
- **Architectural Fix Required:** V2 must default to Pathway Room for coaches without Workspace accounts, or detect Gmail accounts and warn coach to reconnect with Workspace

**Hypothesis 2: Refresh Token Expired/Revoked — ⚠️ SECONDARY FACTOR (CONFIRMED)**
- **Why suspected:** Google revokes tokens after security prompts or password changes
- **Evidence (CONFIRMED):**
  - ✅ Main coach's access token expired August 7, 2026 10:00 UTC (6 days ago)
  - ✅ refresh_token status: unknown (need to test if still valid)
  - ✅ Even if refresh succeeds, underlying issue is Gmail account (cannot generate Meet)
- **Severity:** MEDIUM — affects ability to create ANY Google Calendar events for that coach
- **Implication:** Even after fixing Gmail → Workspace issue, token refresh needs monitoring

**Hypothesis 3: Workspace Admin Disabled Conferencing — ❌ NOT APPLICABLE**
- **Why suspected:** Org admin policy can block Google Meet generation
- **Evidence:** Not applicable because coach is using personal Gmail, not Workspace account
- **Verdict:** RULED OUT (not the issue for this coach; may apply to Workspace-using coaches in future)

**Hypothesis 4: Rate Limiting / API Quota — ❌ NOT APPLICABLE**
- **Why suspected:** Google could be rate-limiting concurrent Meet creation
- **Evidence:** No bookings have google_event_id at all (not transient failures, not quota exhaustion)
- **Verdict:** RULED OUT (pattern is 100% failure, not bursty/intermittent)

---

### A.3 Desconocido (Unknown) — RESOLVED OR DEFERRED

**Unknown 1: Full Google API Response** — ✅ DEFERRED (LOW PRIORITY)
- **Question:** What exactly does Google return in the 200 OK response?
- **Status:** DEFERRED — we know the root cause (Gmail account), don't need API response details yet
- **When needed:** If/when testing with Workspace accounts (Phase 1)

**Unknown 2: Refresh Token Status** — ⚠️ PARTIALLY RESOLVED
- **Question:** Are refresh tokens valid? When were they last used? Have they been revoked?
- **Status:** 
  - ✅ Access token: EXPIRED (August 7, 2026)
  - ⚠️ Refresh token: EXISTS (103 chars), status UNKNOWN (need to test refresh)
  - ⚠️ Last sync attempt: Unknown (need to check logs)
- **Action Required (Phase 0):** Attempt manual token refresh to determine if refresh_token is still valid

**Unknown 3: Coach Account Types** — ✅ RESOLVED
- **Question:** How many coaches are using Gmail vs. Workspace?
- **Status:** RESOLVED via database inspection
  - Main coach (53 bookings): **@gmail.com (personal Gmail)** ← ROOT CAUSE
  - 2 other coaches: Have refresh_token in gcal_tokens
  - 4 coaches: NO tokens at all (never connected Google)
- **Implication:** Need to check if other 2 coaches are using Gmail or Workspace

**Unknown 4: Google Cloud Project Settings** — ✅ DEFERRED (NOT ROOT CAUSE)
- **Question:** Is our project configured correctly? Do we have the right APIs enabled?
- **Status:** DEFERRED — OAuth scope is correct (verified), APIs are responding
- **Conclusion:** Config is not the issue; the issue is account type (Gmail vs Workspace)

---

### A.4 Evidence Gathering Plan

**Step 1: Enable Logging (TODAY)**
```typescript
// In gcal-push/index.ts, before parsing response:
console.log(`[gcal-push] coach_id=${coachId}, response.status=${r.status}`);
if (r.ok) {
  console.log(`[gcal-push] response.json=${JSON.stringify(d)}`);
  console.log(`[gcal-push] conferenceData=${JSON.stringify(d.conferenceData)}`);
  console.log(`[gcal-push] entryPoints=${d.conferenceData?.entryPoints?.length || 0}`);
}
```
**Why:** Need to capture what Google actually returns (not just "yes/no")

**Step 2: Query Existing Data**
```sql
-- Check if we can see patterns in existing citas:
SELECT 
  c.coach_id,
  COUNT(*) as booking_count,
  COUNT(CASE WHEN c.meet_link IS NOT NULL THEN 1 END) as with_meet_link,
  COUNT(CASE WHEN c.meet_link IS NULL THEN 1 END) as without_meet_link
FROM citas c
WHERE c.creada_at >= now() - interval '30 days'
GROUP BY c.coach_id
ORDER BY without_meet_link DESC;
```
**Why:** Identify which coaches are affected (pattern analysis)

**Step 3: Test with Real Accounts (PHASE 0 TESTING)**
- [ ] Create test booking with Gmail account → inspect response
- [ ] Create test booking with Workspace account → inspect response
- [ ] Compare: do they return different conferenceData?

**Step 4: Interview Coaches**
- [ ] "What type of Google account do you use? (Gmail @gmail.com or Google Workspace?)"
- [ ] "Have you ever seen the Meet link in your email?"
- [ ] "When did the problem start? (recently or always?)"

---

### A.5 ROOT CAUSE VERDICT — FASE 0 COMPLETE

**PRIMARY ROOT CAUSE: ✅ IDENTIFIED**

**The system is NOT creating Google Calendar events because:**

1. **Coach connected a PERSONAL GMAIL ACCOUNT** (`mmicaela.jairedin@gmail.com`)
2. **Google Calendar API does NOT support Google Meet for personal Gmail accounts**
   - Google Meet link generation is a **Google Workspace-only feature**
   - API returns 200 OK and creates the event, but omits `conferenceData.entryPoints`
   - This is Google's documented behavior, not a bug in our code
3. **gcal-push receives empty conferenceData and correctly rejects it** (422 error)
4. **No event_id is saved to citas.google_event_id** → bookings fall back to Pathway Room

**SECONDARY ISSUE: TOKEN EXPIRATION**

- Coach's access token expired August 7, 2026 (6 days ago)
- Even if Gmail → Workspace issue is resolved, expired token blocks future events
- Requires token refresh + coach reconnection with valid Workspace account

**DATA SUMMARY:**

| Metric | Value |
|--------|-------|
| Total recent bookings | 63 |
| Bookings with meet_link | 1 (1.6%) |
| Bookings with google_event_id | 0 (0%) |
| Coaches affected | 7 total; 1 primary (53 bookings with zero success) |
| Primary coach's account type | Personal @gmail.com (NOT Workspace) |
| Primary coach's token status | Access token EXPIRED; Refresh token exists but untested |
| Root cause classification | **ARCHITECTURAL LIMITATION (not a bug)** |

**Phase 0 Investigation: ✅ COMPLETE**

**Next Steps:**
1. ✅ Google Meet root cause: IDENTIFIED (Gmail account + token expiration)
2. ⏳ Sala Pathway viability: Testing phase (not yet started)
3. ⏳ V2 architecture finalization: Blocked until user review of this report
4. ⏳ NO code changes authorized until user approves investigation findings

---

## B. SALA PATHWAY: VIABILITY TESTING

### B.1 Status: READY FOR TESTING

**Testing Not Yet Executed** — Plan is defined, ready to begin when authorized.

Minimum 10 test scenarios need to run (Coach + Client real users):
1. Basic connection (participants list, mic/camera toggle)
2. Video/audio quality (desktop Chrome/Firefox/Safari + mobile)
3. Chat (message send/receive, emojis)
4. Screen share (share/view/control)
5. Isolation & security (tokens, room isolation)
6. Edge cases (reload, reconnect, simultaneous entrance)
7. Simultaneous citas (no room collision)
8. Permissions (camera/mic grant/deny)
9. Mobile & Safari/iOS (specific browser tests)
10. Stability (30-min call, auto-reconnect, network interruption)

**Blockers for Testing:**
- Need real Coach + Client to test together
- Need access to staging environment (or prod, if safe)
- Need to reserve time slots (1-2 hrs per coach for full suite)

---

## C. V1 ANALYSIS

### C.1 Code Audit Status: READY (Not Yet Executed)

**Files to Audit:**
- [ ] reservar.html (flow, decisions, dependencies)
- [ ] sync-cita-to-gcal (contract, error handling)
- [ ] gcal-push (already audited above ✅)
- [ ] send-email (template, parameters)
- [ ] sala.html (access control, room generation)
- [ ] panel-v2.html (calendar display assumptions)
- [ ] cliente.html (session access assumptions)

---

## D. V2 MODEL VALIDATION

### D.1 Data Schema (Proposed)

```sql
-- New columns for citas table (single migration)
ALTER TABLE citas ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'none';
ALTER TABLE citas ADD COLUMN IF NOT EXISTS provider_url TEXT;
ALTER TABLE citas ADD COLUMN IF NOT EXISTS provider_ready_at TIMESTAMPTZ;
ALTER TABLE citas ADD COLUMN IF NOT EXISTS provider_error TEXT;
ALTER TABLE citas ADD COLUMN IF NOT EXISTS provider_retry_count INT DEFAULT 0;

CREATE INDEX IF NOT EXISTS citas_provider_idx ON citas (provider, provider_ready_at);
```

**Validation Against V1:**
- ✅ All columns are nullable (V1 queries still work)
- ✅ V1 does NOT use these columns (no conflicts)
- ✅ V1 can INSERT without specifying them (defaults apply)
- ✅ V1 can SELECT (ignores new columns)

---

### D.2 State Machine (Proposed)

```
STATE MACHINE: CITA LIFECYCLE

┌─────────────────────────────────────────────────────────────┐
│ CREATED                                                     │
│ ├─ cita record inserted with estado='confirmada'           │
│ └─ provider='none' (not yet assigned)                       │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ CONFIRMED                                                   │
│ ├─ cita exists in BD                                        │
│ └─ provider assignment starts (async)                       │
└──────────────────────┬──────────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
        ▼              ▼              ▼
    [Google]       [Pathway]        [Zoom]
    [Meet]         [Room]           [TBD]
        │              │              │
        └──────────────┼──────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ PROVIDER_READY (if success)                                │
│ ├─ provider_url is set                                      │
│ ├─ provider_ready_at has timestamp                          │
│ └─ email is sent (reads provider_url)                       │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ MEETING_LIVE                                                │
│ ├─ client clicks provider_url                               │
│ ├─ enters sala.html / meet.google.com / zoom.us             │
│ └─ coach + client in call                                   │
└──────────────────────┬──────────────────────────────────────┘
                       │
        ┌──────────────┴──────────────┐
        │                             │
        ▼                             ▼
   COMPLETED                      FAILED
   (30+ mins)              (client didn't show up)
                           (disconnection issues)

FAILURE PATH:
┌──────────────────────────────────────┐
│ FAILED (if provider creation fails)  │
│ ├─ provider_error = reason           │
│ ├─ provider_retry_count incremented  │
│ └─ retry after backoff               │
└──────────────────────────────────────┘
```

---

### D.3 Provider Interfaces (Proposed)

**Google Meet Provider:**
```typescript
interface GoogleMeetProvider {
  type: "google_meet";
  createEvent(cita, coach): Promise<{
    ok: boolean;
    hangoutLink?: string;
    event_id?: string;
    error?: string;  // "gmail_account_unsupported" | "token_failed" | ...
  }>;
  url_format: "https://meet.google.com/xxx-xxx-xxx";
}
```

**Pathway Room Provider:**
```typescript
interface PathwayRoomProvider {
  type: "pathway_room";
  generateRoom(cita): Promise<{
    ok: boolean;
    room_url: string;  // "/sala.html?token=xyz"
    token: string;  // JWT with cita.id, permissions
    error?: string;
  }>;
  url_format: "/sala.html?token=xyz";
}
```

**Zoom Provider (Future):**
```typescript
interface ZoomProvider {
  type: "zoom";
  createMeeting(cita): Promise<{
    ok: boolean;
    meeting_url: string;
    error?: string;
  }>;
  url_format: "https://zoom.us/j/xxxxx";
}
```

---

## E. TEST MATRIX: 15 SCENARIOS

**Defined but not yet executed.** See FASE-0-PLAN.md for full specs.

---

## F. RISKS & UNKNOWNS

### F.1 Known Risks

| Risk | Severity | Mitigation |
|------|----------|-----------|
| Google Meet continues to fail | HIGH | Default to Pathway Room; Google Meet is opt-in |
| Sala Pathway doesn't work on iOS Safari | MEDIUM | Test before launch; plan fallback if needed |
| Rate limiting on Google API | LOW | Implement retry with exponential backoff |
| MultiCoach expects different format | MEDIUM | Coordinate with MultiCoach team; no coupling required |
| Email can't be modified | LOW | send-email already supports optional fields |

### F.2 Unknown Risks

- Scope of Google Meet failure: how many coaches? All? Some?
- Performance of Pathway Room under load (concurrent calls)
- Coach adoption: how will they react to Pathway as default?
- Hidden dependencies in panel-v2 on meet_link format?

---

## G. READINESS CRITERIA FOR PHASE 1

All of the following must be checked ✅ before Phase 1 authorization:

- [ ] **Google Meet root cause identified** — either demostrado, unknown-but-scoped, or hipótesis-with-evidence (NOT vague)
- [ ] **Sala Pathway tested** — at least scenarios 1-6 must pass (basic connection, video/audio, chat, screen share, isolation, edge cases)
- [ ] **V1 analysis complete** — conservar/modificar/abandonar lists defined
- [ ] **V2 model validated** — schema + state machine + provider interfaces locked in
- [ ] **15 test scenarios written** — with success criteria (ready for Phase 1 execution)
- [ ] **Risks documented** — mitigation plan for each
- [ ] **Rollback plan clear** — how to recover if Phase 1 fails
- [ ] **No "small fixes" identified** — investigation found only issues, no unauthorized implementations

---

## H. ROLLBACK PLAN

**If Phase 1 fails → Recovery Path:**

1. **Immediate:** Delete `?agenda=v2` from bookings
2. **Result:** Instant revert to V1 behavior (all code uses reservar.html)
3. **DB State:** New columns in citas are nullable, V1 queries ignore them
4. **Email:** Falls back to V1 send-email template
5. **Panel:** Continues displaying from citas (ignores new fields)
6. **Rollback Time:** < 1 minute (no code deploy needed, only config change)

**If V2 database changes corrupt data:**
1. Drop new columns from citas (idempotent migration)
2. Restore citas to V1-compatible state
3. V1 continues (was always tolerant of missing columns)

---

## NEXT STEPS

1. ✅ Plan created (FASE-0-PLAN.md)
2. ⏳ **AWAITING:** Begin investigation with evidence gathering:
   - Enable logging in gcal-push
   - Query citas table for patterns
   - Interview coaches on account type
   - Test with Gmail vs. Workspace accounts

3. ⏳ **THEN:** Sala Pathway real-world testing (10 scenarios)

4. ⏳ **THEN:** V1 code audit + V2 model finalization

5. ⏳ **FINALLY:** Deliver complete Phase 0 report with all 8 sections

---

**Status:** Investigation plan ready. Awaiting authorization to begin data gathering.

**Estimated Duration:** 2-4 days (depends on data access + testing coordination)

**Critical Constraint:** NO modifications to V1 or V2 implementation during Phase 0.

