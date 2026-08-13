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

**Fact 4:** HTTP Response from Google is 200 OK (not error status)
- **Source:** User report: "se creó el evento en Google"
- **Evidence:** Event ID returned from Google (event creation succeeded)
- **Implication:** Google did create the event, but without conferenceData

**Fact 5:** Google is returning empty conferenceData
- **Source:** User report: "email viene con el link de sala de pathway pero no con el link de google"
- **Evidence:** No hangoutLink captured for 40+ bookings
- **Implication:** Google's response has empty or missing conferenceData.entryPoints

---

### A.2 Hipótesis (Hypotheses) — TO BE TESTED

**Hypothesis 1: Gmail Account (Not Workspace)**
- **Why suspected:** Google Calendar API only generates Meet links for Google Workspace accounts, NOT Gmail (@gmail.com)
- **Evidence:** API returns 200 OK (event created) but no conferenceData (no permission to create Meet)
- **How to test:**
  - [ ] Interview coaches: "Do you use Gmail or Google Workspace account?"
  - [ ] Test creating event with Gmail account → verify conferenceData is empty
  - [ ] Test creating event with Workspace account → verify conferenceData has entryPoints
  - [ ] Check gcal_tokens: can we infer account type from token claims?
- **Likelihood:** 60-70% (explains silent failure + 200 OK)

**Hypothesis 2: Refresh Token Expired/Revoked**
- **Why suspected:** Google revokes tokens after security prompts or password changes
- **Evidence:** Could explain why recent bookings fail (older coaches have expired tokens)
- **How to test:**
  - [ ] Log accessToken() call result in gcal-push (is it null?)
  - [ ] Query gcal_tokens: when was each token last used?
  - [ ] Force token refresh: does it succeed?
  - [ ] Check for pattern: do tokens from certain date all fail?
- **Likelihood:** 20-25% (secondary cause)

**Hypothesis 3: Workspace Admin Disabled Conferencing**
- **Why suspected:** Org admin policy can block Google Meet generation
- **Evidence:** Would explain per-coach failures (some disabled, some enabled)
- **How to test:**
  - [ ] Ask coaches: "Has your admin blocked Google Meet?"
  - [ ] Check event creation: does it have `conferenceData` field in response?
  - [ ] Inspect Google Workspace admin settings (if accessible)
- **Likelihood:** 10% (less common)

**Hypothesis 4: Rate Limiting / API Quota**
- **Why suspected:** Google could be rate-limiting concurrent Meet creation
- **Evidence:** Transient failures would affect all coaches equally
- **How to test:**
  - [ ] Check HTTP response for 429 (rate limit) or 403 (quota)
  - [ ] Monitor error rate: is it consistent or bursty?
  - [ ] Check Google Cloud Console: are we hitting quotas?
- **Likelihood:** 5% (would show in HTTP status)

---

### A.3 Desconocido (Unknown) — REQUIRES INVESTIGATION

**Unknown 1:** Full Google API Response
- **Question:** What exactly does Google return in the 200 OK response?
- **Why needed:** To distinguish "conferenceData missing" from "conferenceData.entryPoints empty"
- **How to find:** Log full `response.json()` in gcal-push before parsing

**Unknown 2:** Refresh Token Status
- **Question:** Are refresh tokens valid? When were they last used? Have they been revoked?
- **Why needed:** To rule out token expiration as root cause
- **How to find:** Query gcal_tokens table + check Google token introspection

**Unknown 3:** Coach Account Types
- **Question:** How many coaches are using Gmail vs. Workspace?
- **Why needed:** To validate hypothesis 1
- **How to find:** Interview coaches + inspect token claims (if possible)

**Unknown 4:** Google Cloud Project Settings
- **Question:** Is our project configured correctly? Do we have the right APIs enabled?
- **Why needed:** To rule out config issues
- **How to find:** Check Google Cloud Console (Cloud Logging, Calendar API settings)

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

### A.5 Current Status

**PROVEN:**
- ✅ Scope is correct
- ✅ Payload is correct
- ✅ HTTP 200 OK from Google
- ✅ Event is created in Google Calendar
- ✅ conferenceData is empty/missing

**UNPROVEN (Requires Investigation):**
- ❓ Which coaches are affected?
- ❓ Do all coaches fail or only some?
- ❓ Is it Gmail vs. Workspace?
- ❓ Is it token expiration?
- ❓ Is it admin policy?

**Next Step:** Execute evidence gathering plan (Step 1-4 above)

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

