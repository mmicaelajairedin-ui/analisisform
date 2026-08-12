# AGENDA V2 ARCHITECTURE

**Status:** DESIGN DOCUMENT (NOT YET IMPLEMENTED)  
**Date:** 2026-08-12  
**Phase:** Architecture Proposal (user review + approval before implementation)  
**Impact:** Complete redesign of booking/calendar flow with clear provider model  

---

## 1. DIAGNOSIS OF AGENDA V1

### Current State
- **Location:** reservar.html, sala.html, sync-cita-to-gcal, gcal-push
- **Data model:** `citas` table with meet_link column (added July 2026)
- **Providers:** Google Calendar (via Google Meet), fallback to Pathway Room (sala.html)
- **Problem:** Multiple decision points about which URL to send, no single source of truth

### Root Causes Identified

#### 1.1 Decision Fragmentation
**The URL decision is made in 3 places:**

| Point | Decision Logic | Problem |
|-------|---|---|
| **reservar.html (lines 943-978)** | Try Zoom → Try Google Meet → Fallback to sala.html | Each branch passes different URL to _sendEmail() |
| **sync-cita-to-gcal** | Calls gcal-push, receives hangoutLink, PATCHes citas.meet_link | If PATCH fails silently, BD ≠ email/UI |
| **gcal-push (line 147)** | Returns ok:true even if no conferenceData (hangoutLink="") | FALSE POSITIVE: event created but no Meet link |

**Result:** Email receives a URL based on reservar.html's decision, NOT from what was actually saved to citas.meet_link.

#### 1.2 Google Meet Not Generating conferenceData
When gcal-push creates an event with:
```typescript
conferenceData: {
  createRequest: {
    requestId: `pathway-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    conferenceSolutionKey: { type: "hangoutsMeet" },
  },
},
conferenceDataVersion: 1,
```

Google API returns 200 OK but **conferenceData.entryPoints is missing** → hangoutLink = "".

**Verified scope:** `conectar-calendar.html` uses correct scope: `https://www.googleapis.com/auth/calendar.events` (read+write, can create Meet).

**Possible causes:**
1. **Gmail account (not Workspace)** — Meet only for Workspace/Business
2. **refresh_token expired/revoked** — token no longer valid
3. **Account policy** — org blocks conferencing
4. **Concurrent limiting** — transient Google API issue
5. **Missing header/version** — conference creation disabled

#### 1.3 sala.html: Silent Fallback
- Opens as fallback when Google fails
- No validation that meet_link was actually created
- Client doesn't know if sala.html is the intended choice or a failure state
- No clear UX distinction between "Pathway Room by design" vs "Google Meet failed"

#### 1.4 Email Coherence Gap
- Email template receives `joinLink` parameter from reservar.html
- Email does NOT verify what was actually saved to `citas.meet_link`
- If race condition: sync PATCH completes after email sends → client receives stale info

#### 1.5 Google Calendar Event Incompleteness
Button "Agregar a Google Calendar" (line 1088):
- Creates calendar.google.com/calendar/render?action=TEMPLATE
- Does NOT include meeting URL in the event parameters
- Client adds event to calendar WITHOUT the video link

---

## 2. WHAT WE REUSE (V1 → V2)

### Keep Unchanged (STABLE)
- ✅ `citas` table structure (all columns)
- ✅ RLS policies
- ✅ `gcal_tokens` table (refresh_token storage)
- ✅ Google OAuth flow (conectar-calendar.html)
- ✅ Edge function: `recordatorios-citas` (reminders)
- ✅ sala.html UI/controls (possibly as alternative provider)
- ✅ Email infrastructure (send-email edge function)
- ✅ panel-v2.html (calendar display)
- ✅ cliente.html (session access)
- ✅ MultiCoach (READ-ONLY consumers)

### Isolate (Create V2-specific versions)
- 🔄 `reservar.html` → **reservar-v2.html** (new booking flow)
- 🔄 `sync-cita-to-gcal` → **sync-booking-v2** (new transactional function)
- 🔄 Meeting provider logic (Google/Zoom/Pathway) → **appointment-service** (centralized)

### Eliminate (Post-V2, after proven stable)
- ❌ `sala.html?room=...` fallback (replace with explicit provider)
- ❌ Automatic fallback without explicit user choice
- ❌ Email receiving URL from frontend decision

---

## 3. FUNDAMENTAL DATA MODEL FOR V2

### Booking State Machine

```
CREATED
  ├─ (waiting for provider: Google/Zoom/Pathway)
  │
CONFIRMED
  ├─ (provider assignment started)
  │
PROVIDER_READY
  ├─ provider: google_meet | zoom | pathway_room
  ├─ meeting_url: {valid URL}
  ├─ email_sent: true
  │
MEETING_LIVE
  ├─ client_connected: (null | false | true)
  │
COMPLETED
  │
FAILED
  ├─ error_reason: google_no_workspace | refresh_token_expired | ...
```

### citas table — Extended Schema (V2)

```sql
-- Core (V1 compatible)
id BIGINT PRIMARY KEY
coach_id TEXT
nombre TEXT
email TEXT
tipo TEXT
inicio TIMESTAMPTZ
estado TEXT ('pendiente' | 'confirmada' | 'cancelada')
creada_at TIMESTAMPTZ

-- Existing extensions (keep)
meet_link TEXT -- DEPRECATED in V2 (use provider_url instead)
modalidad TEXT ('online' | 'presencial')
lugar TEXT -- presencial address
grupal BOOLEAN
kind TEXT ('sesion' | 'primera_llamada' | 'demo_pathway' | 'personal')
lang TEXT ('es' | 'en')
origen TEXT -- "Instagram", "LinkedIn", etc.
token TEXT -- for gestionar-cita.html
cliente_conectado BOOLEAN
respuestas JSONB
telefono TEXT
cliente_tz TEXT
rem_24h_at TIMESTAMPTZ
rem_1h_at TIMESTAMPTZ

-- V2 Additions (NEW)
provider TEXT NOT NULL DEFAULT 'none'
  -- 'google_meet' | 'zoom' | 'pathway_room' | 'none'
provider_url TEXT
  -- https://meet.google.com/xxx or https://zoom.us/j/xxx or /sala.html?token=...
provider_ready_at TIMESTAMPTZ
  -- when provider_url was confirmed valid in BD
provider_error TEXT
  -- if provider creation failed: 'google_no_workspace', 'zoom_api_error', etc.
provider_retry_count INT DEFAULT 0
  -- how many times we retried getting this provider
```

### Provider Model

```typescript
type Appointment = {
  id: bigint;
  coach_id: string;
  email: string;
  inicio: Date;
  
  // Provider information (source of truth)
  provider: "google_meet" | "zoom" | "pathway_room" | "none";
  provider_url: string | null; // e.g., https://meet.google.com/xxx
  provider_ready_at: Date | null; // when confirmed to BD
  provider_error: string | null; // if failed
  
  // Derived (READ from provider + cita fields)
  state: "created" | "confirmed" | "provider_ready" | "failed";
  modalidad: "online" | "presencial"; // if presencial → no video
};

// For email/UI consumption
type AppointmentView = {
  state: string;
  title: string;
  description: string; // "Google Meet is ready" or "Pathway Room" or "No video"
  meeting_link: string | null;
  enter_button: boolean; // true only if provider_ready && provider_url
  calendar_event: CalendarEvent;
};
```

---

## 4. GOOGLE MEET: ROOT CAUSE ANALYSIS

### Current Integration

**Flow:**
1. Coach connects Google Calendar (OAuth scope: `calendar.events`)
2. Client books → reservar.html calls sync-cita-to-gcal
3. sync-cita-to-gcal calls gcal-push
4. gcal-push creates event in Google Calendar with conferenceData.createRequest
5. Google returns 200 OK + `event.id` BUT `event.conferenceData` is empty
6. hangoutLink stays "" → FALSE POSITIVE success

### Investigation Checklist (V2 Pre-Launch)

**Before implementing V2, must verify:**

| Check | How to Test | Expected | Issue if Not |
|-------|---|---|---|
| **OAuth Scope** | Read token from gcal_tokens.scope | `calendar.events` (not just readonly) | Cannot create Meet |
| **Workspace Account** | Manual: try /gcal-push with test event | conferenceData ≠ empty | Gmail cannot make Meet |
| **Refresh Token Valid** | accessToken() call in gcal-push | Returns valid token (not expired) | Cannot call Google API |
| **conferenceDataVersion** | Check gcal-push line 120 | `1` (correct) | Possible protocol mismatch |
| **createRequest Structure** | Verify gcal-push lines 114-119 | Matches Google docs | Malformed payload |
| **Google API Response** | Log full response.json() | Has conferenceData.entryPoints | Google didn't create room |
| **Calendar API Limits** | Check rate limits | Not hitting 403/429 | Rate limit issue |
| **Coach Account Type** | Ask coach during onboarding | Workspace, not Gmail | Structural incompatibility |

### V2 Decision: Google Meet as First-Class Provider

**Rule:** Do NOT fallback to sala.html silently.

If Google Meet is configured:
- **Success path:** `provider: google_meet` → show Meet link
- **Error path:** `provider_error: "google_no_workspace"` → show clear error message to coach + client
- **No automatic fallback:** Coach chooses alternative explicitly

---

## 5. SALA PATHWAY: VIABILITY ASSESSMENT

### What exists today
- **sala.html:** Full UI for videocall (video, chat, controls, screen share, objectives, notes, tasks)
- **Architecture:** JaaS (8x8, multi-person video) + P2P fallback (WebRTC 1:1)
- **Capabilities:**
  - ✅ Video/audio (JaaS or P2P)
  - ✅ Chat (custom, not Jitsi's built-in)
  - ✅ Screen sharing
  - ✅ Participants list
  - ✅ Coach-only work panel (objectives, notes, tasks, feedback)
  - ✅ Feedback form at end of call

### Verdict: **YES, Sala Pathway can be a real provider**

**Pathway Room as Alternative to Meet/Zoom:**

```
PROVIDER: pathway_room
├─ No external dependency (Pathway controls the room)
├─ Coach can still use Google Meet if they prefer
├─ Client experience: same UI, works without Google account
├─ No per-call cost (unlike JaaS pricing)
└─ Full feature parity with Meet (video, chat, screen share)
```

### V2 Implementation: Sala as First-Class Provider

**Instead of fallback:**

```typescript
// Coach configures in settings:
// [ ] Google Meet (requires Workspace account)
// [x] Pathway Room (always available, no setup)
// [ ] Zoom (requires API key)

// Agenda V2 respects the choice
if (coach.preferred_provider === "google_meet") {
  provider = await createGoogleMeet();
  if (provider_error) {
    // Show error, do NOT silently fall back
    notify(coach, "Google Meet unavailable");
  }
} else if (coach.preferred_provider === "pathway_room") {
  provider = createPathwayRoom();
  // Deterministic room: same for coach + client
}
```

### Migration Plan: V1 → V2
- V1 defaulted to google_meet, fell back to pathway_room silently
- V2 defaults to pathway_room (always works), offers google_meet as opt-in
- No behavioral change for users, better reliability

---

## 6. MULTICOACH INTEGRATION (READ-ONLY)

### Current MultiCoach State
- Reads from `usuarios` (coaches in network)
- Reads from `candidatos` (clients)
- Does NOT currently read from `citas`
- Displays coach availability via iCal feed (external URL)

### V2 Integration Point
MultiCoach will eventually consume:

```sql
SELECT 
  c.id,
  c.coach_id,
  c.email,
  c.inicio,
  c.estado,
  c.provider,
  c.provider_url,
  c.provider_ready_at,
  c.modalida

de
FROM citas c
WHERE c.coach_id = $1
  AND c.inicio >= now()
  AND c.estado != 'cancelada'
ORDER BY c.inicio;
```

**MultiCoach does NOT need to know:**
- Why Google Meet failed
- How to retry provider creation
- Email sending logic

**MultiCoach only needs to display:**
- Appointment time
- Client name
- Provider type (for UI icon: 🎥 Google / 🎥 Zoom / 💬 Pathway)
- Status (ready to join / waiting for provider / failed)

### Non-Blocking Design
- MultiCoach continues reading from available APIs NOW
- V2 Booking Service can add `citas` integration incrementally
- No coupling: V2 can change provider logic without MultiCoach knowing

---

## 7. EMAIL ARCHITECTURE

### V1 Problem
Email receives URL from reservar.html's decision, not from BD.

### V2 Solution: Email as Read-Only Consumer

```
FLOW:
cita (created + provider_url confirmed in BD)
  ↓
Email Service reads cita
  ↓
Generates HTML from cita.provider (not from frontend param)
  ↓
Sends email with accurate link
```

**Implementation:**
```typescript
// Send email AFTER provider_ready_at is set
sendAppointmentEmail({
  to: cita.email,
  provider: cita.provider, // source of truth
  provider_url: cita.provider_url,
  start: cita.inicio,
});

// Email template:
// ├─ If provider === "google_meet":
// │  "🎥 Entrar a Google Meet → {provider_url}"
// ├─ If provider === "zoom":
// │  "🎥 Entrar a Zoom → {provider_url}"
// ├─ If provider === "pathway_room":
// │  "💬 Entrar a Sala Pathway → {provider_url}"
// └─ If provider === "none":
//    "Reserva confirmada (sin videollamada)"
```

### Key Rule
- **Email never constructs the URL**
- **Email only reads from citas table**
- **If citas.provider_url is NULL, email shows "link will arrive soon"**

---

## 8. CONFIRMATION UX (V2)

### Step 1: Booking Confirmed
```
┌─────────────────────────┐
│  ✅ Reserva Confirmada  │
│                         │
│ Martes 15, 10:00 (tu    │
│ hora)                   │
│                         │
│ Esperando preparar la   │
│ videollamada...         │
└─────────────────────────┘
```

### Step 2: Provider Ready (or Failed)
```
SCENARIO A: Google Meet Ready
┌─────────────────────────────────┐
│ ✅ Sesión Lista                 │
│                                 │
│ 🎥 Google Meet                  │
│ [Entrar a Google Meet]          │
│                                 │
│ 📅 Agregar a Google Calendar    │
│                                 │
│ El email ya está en tu inbox.   │
└─────────────────────────────────┘

SCENARIO B: Pathway Room
┌─────────────────────────────────┐
│ ✅ Sesión Lista                 │
│                                 │
│ 💬 Sala Pathway                 │
│ [Entrar a la Sala]              │
│                                 │
│ 📅 Agregar a Google Calendar    │
└─────────────────────────────────┘

SCENARIO C: Google Meet Failed
┌──────────────────────────────────┐
│ ⚠️ Problema con Google Meet      │
│                                  │
│ Tu cuenta no puede crear Meet.   │
│ (Requiere Google Workspace)      │
│                                  │
│ Contacta al coach para           │
│ alternativas:                    │
│ • Sala Pathway                   │
│ • Zoom                           │
│ • Llamada por teléfono           │
└──────────────────────────────────┘
```

### Key Difference from V1
- **V1:** "Entrar" button always shown (even if URL empty)
- **V2:** "Entrar" button only if provider_ready && provider_url
- **V1:** Error hidden behind silent fallback
- **V2:** Error explicitly shown to both coach and client

---

## 9. GOOGLE CALENDAR EVENT CONSTRUCTION

### V1 Problem
Button "Agregar a Google Calendar" creates event WITHOUT meeting URL.

### V2 Solution: Complete Event Template

```typescript
function buildGoogleCalendarUrl(cita: Appointment): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `${cita.tipo || "Sesión"} con ${cita.coach_name}`,
    details: buildEventDescription(cita),
    location: buildLocation(cita),
    dates: `${toGoogle(cita.inicio)}/${toGoogle(cita.fin)}`,
    ctz: cita.cliente_tz || "UTC",
    add: cita.email,
    // NEW: Add meeting link to event
    ...(cita.provider_url && {
      description: `Meeting: ${cita.provider_url}`,
    }),
  });
  
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function buildLocation(cita: Appointment): string {
  if (cita.modalidad === "presencial") {
    return cita.lugar || "Presencial";
  }
  
  // Online: return the video meeting link
  return cita.provider_url || "Online (link en email)";
}
```

### Result
- Client adds event to Google Calendar
- Event includes timezone, duration, description
- Event includes the actual video meeting link
- Works with Google Meet, Zoom, or Pathway Room

---

## 10. ARCHITECTURE DIAGRAM

```
┌────────────────────────────────────────────────────────────┐
│                    AGENDA V2 ARCHITECTURE                  │
└────────────────────────────────────────────────────────────┘

                        BOOKING FLOW
                            │
                    ┌───────▼────────┐
                    │  reservar-v2   │ (Step 1: User books)
                    └───────┬────────┘
                            │
                    ┌───────▼──────────────┐
                    │  sync-booking-v2     │ (Step 2: Create in BD)
                    │  • Creates cita      │
                    │  • provider = 'none' │
                    │  • start provider    │
                    └───────┬──────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
  │ Google Meet  │  │    Zoom      │  │ Pathway Room │
  │  Provider    │  │  Provider    │  │  Provider    │
  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘
         │                 │                 │
         └─────────────────┼─────────────────┘
                           │
                    ┌──────▼──────────┐
                    │  CITA (BD)      │
                    │  provider_url✓  │
                    │  provider_ready │
                    └──────┬──────────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
         ▼                 ▼                 ▼
    ┌────────┐         ┌────────┐       ┌────────┐
    │ EMAIL  │         │ PANEL  │       │ CLIENT │
    │(reads  │         │(reads  │       │(reads  │
    │from BD)│         │from BD)│       │from BD)│
    └────────┘         └────────┘       └────────┘
         │                 │                 │
         └─────────────────┼─────────────────┘
                           │
                    ┌──────▼────────┐
                    │  MULTICOACH   │
                    │  (READ-ONLY)  │
                    └───────────────┘

PROVIDERS (Pluggable):
┌─────────────────────────────────────────────────┐
│ ┌──────────┐  ┌────────┐  ┌──────────────────┐ │
│ │Google API│  │Zoom API│  │Pathway P2P/JaaS  │ │
│ │(gcal-    │  │        │  │(sala.html)       │ │
│ │push)     │  │        │  │                  │ │
│ └──────────┘  └────────┘  └──────────────────┘ │
└─────────────────────────────────────────────────┘

EDGE FUNCTIONS:
• gcal-push (existing, refactored for V2)
• zoom-webhook (new)
• pathway-room-handler (new)
• sync-booking-v2 (replaces sync-cita-to-gcal)
```

---

## 11. MIGRATION PLAN: V1 → V2 (Zero Downtime)

### Phase 0: V2 Development (Parallel)
- Build reservar-v2.html (NOT connected to any URLs yet)
- Build sync-booking-v2 (new function, reads from test data)
- Build provider services (Google/Zoom/Pathway)
- Build tests (no manual reservas)

### Phase 1: Soft Launch
- V2 code deployed to production
- V1 reservar.html still active (DEFAULT)
- New ENV var: `AGENDA_VERSION=v1` (default)
- V2 accessible via `?agenda=v2` query param (internal testing)

### Phase 2: Provider Testing (Staging)
- Test each provider independently in staging
- Verify Google Meet with real Workspace account
- Verify Zoom API flow
- Verify Pathway Room 1:1 and multi
- Email/UI/Panel/Client all working

### Phase 3: Gradual Rollout
- Switch `AGENDA_VERSION` to `v2` (config, not code)
- Monitor: email delivery, provider success rates, errors
- If issues: quick rollback to `v1`
- Batch of 10 real bookings → 100 → 1000

### Phase 4: Full Cutover
- V1 reservar.html marked as DEPRECATED
- Archive all V1 booking functions
- Docs updated

### Rollback Plan
If V2 fails → set `AGENDA_VERSION=v1` → instant revert (no code deploy needed)

---

## 12. FILES TO CREATE/MODIFY (V2)

### New Files (V2 Exclusive)
```
supabase/functions/
  ├─ sync-booking-v2/index.ts (replaces sync-cita-to-gcal)
  ├─ appointment-service/index.ts (centralized provider logic)
  └─ email-appointment/index.ts (V2 email service)

/
  ├─ reservar-v2.html (new booking form)
  ├─ AGENDA-V2-ARCHITECTURE.md (THIS FILE)
  └─ docs/V2-TESTING.md (test plan)

supabase/migrations/
  └─ 0XXX_citas_v2_provider_fields.sql (add provider, provider_url, etc.)
```

### Modified Files (Minimal Changes)
```
supabase/functions/
  ├─ gcal-push/index.ts (adapt for V2, keep backward compat)
  └─ send-email/index.ts (support V2 payload format)

HTML Pages (Add V2 Support, Keep V1):
  ├─ panel-v2.html (read provider + provider_url, display correctly)
  ├─ cliente.html (read provider + provider_url)
  ├─ multicoach.html (read provider for icon)
  └─ sala.html (add ?provider=pathway_room support)

Config:
  └─ settings.json / env (AGENDA_VERSION, feature flags)
```

### DO NOT TOUCH (V1 Legacy)
```
reservar.html (keep as-is)
sync-cita-to-gcal/index.ts (keep, may coexist)
gcal/index.ts (keep, read-only)
```

---

## 13. TESTING STRATEGY (NO MANUAL RESERVAS)

### Unit Tests (Automated)

```typescript
describe("Appointment Service V2", () => {
  // Google Meet
  test("creates Google Meet event successfully");
  test("handles Google no-Workspace error");
  test("returns null on invalid refresh_token");
  
  // Zoom
  test("creates Zoom meeting via API");
  test("handles Zoom API 401");
  
  // Pathway Room
  test("generates deterministic room URL");
  test("creates cita with provider=pathway_room");
  
  // Email
  test("sends email with Google Meet link");
  test("sends email with Zoom link");
  test("sends email with Pathway Room link");
  
  // Calendar
  test("Google Calendar URL includes meeting link");
  test("handles presencial modalidad (no video)");
});
```

### Integration Tests (Staging)

```
Scenario 1: Google Meet Works
  client books → provider=google_meet → email has link ✓

Scenario 2: Google Meet Fails (no Workspace)
  client books → provider=none + error_reason → error email ✓

Scenario 3: Pathway Room Default
  client books → provider=pathway_room → email has room URL ✓

Scenario 4: Panel Displays Correctly
  coach views cita → sees provider icon → clicks link ✓

Scenario 5: Client Portal Access
  client clicks email link → enters video room ✓

Scenario 6: MultiCoach Read
  multicoach queries citas → sees provider type ✓

Scenario 7: Google Calendar Event
  client adds to calendar → event has meeting link ✓

Scenario 8: Doble Booking Prevention
  same coach, same time → shows conflict ✓

Scenario 9: Timezone Handling
  client in CEST, coach in EST → both see correct time ✓

Scenario 10: Refresh/Retry
  if provider creation failed → retry mechanism ✓

Scenario 11: Email Delivery
  cita created → email arrives within 5 min ✓

Scenario 12: History
  coach views past citas → provider shown correctly ✓

Scenario 13: Doble Reservation Rejection
  same email + time → second booking rejected ✓

Scenario 14: Cancellation
  cita cancelled → email sent, provider cleaned up ✓

Scenario 15: Cascading Deletion
  coach deleted → citas? remain (read-only history) ✓
```

### Validation (Post-Tests, Before Cutover)
- ✅ All 15 scenarios passing
- ✅ Email delivery 100%
- ✅ Zero stale links (provider_url matches what client receives)
- ✅ Error messages clear (coach + client)
- ✅ Performance: < 2s per booking
- ✅ No DB locks or race conditions
- ✅ Rollback tested (v2 → v1 → v2)

---

## 14. KEY DECISIONS LOCKED IN

### Decision 1: Provider as First-Class Field
**Rule:** `provider` is canonical, NOT derived from meet_link or zona.

**Reasoning:** Enables multi-provider support without restructuring.

**Not negotiable:** All queries must use `provider`, not infer from URL.

### Decision 2: No Silent Fallback
**Rule:** If provider creation fails, show error to coach + client. Do not hide behind sala.html.

**Reasoning:** Coach must act (choose alternative, troubleshoot), not wonder why.

**Not negotiable:** Fallback requires explicit user choice, not automatic.

### Decision 3: Email Reads from BD
**Rule:** Email template receives cita record, not a URL passed from frontend.

**Reasoning:** Eliminates divergence between what frontend sends and what BD has.

**Not negotiable:** Email never accepts URL parameter from reservar.html.

### Decision 4: Pathway Room as Equal Provider
**Rule:** Sala Pathway is NOT a fallback, it's a primary provider choice.

**Reasoning:** Removes second-class UX, enables coach to pick Pathway by design.

**Not negotiable:** Coach configures preferred provider (Google, Zoom, Pathway).

### Decision 5: MultiCoach Non-Blocking
**Rule:** V2 must work without MultiCoach reading from V2 fields immediately.

**Reasoning:** MultiCoach continues with current flow, V2 integration is future work.

**Not negotiable:** V2 does not require MultiCoach changes to launch.

---

## 15. NEXT STEPS (PENDING USER REVIEW)

### Before Implementation
1. ✅ User reads this document
2. ✅ User approves/modifies architecture
3. ❓ User authorizes: "Proceed to implementation"

### Implementation Timeline (Estimated)
- Week 1: Provider services + sync-booking-v2 (40 hrs)
- Week 2: reservar-v2.html + email-appointment (30 hrs)
- Week 3: Panel/Cliente/MultiCoach integration (20 hrs)
- Week 4: Testing + staging validation (30 hrs)
- **Total: ~4 weeks**

### Non-Blocking Work (Parallel)
- Research Zoom API (if adding Zoom as provider later)
- Document provider API specs
- Plan MultiCoach integration (Phase 2)

---

## Appendix: Current State (Reference)

### Table: citas (V1 Final)
```sql
id | coach_id | nombre | email | tipo | inicio | estado | creada_at | meet_link | modalidad | lugar | grupal | kind | lang | origen | token | cliente_conectado | respuestas | telefono | cliente_tz | rem_24h_at | rem_1h_at
```

### V1 Booking Flow (For Context)
```
reservar.html:
  1. Get Zoom link (if configured)
  2. If no Zoom → call sync-cita-to-gcal
  3. Wait for sync response
  4. If ok + hangoutLink → send email with Meet
  5. If ok + !hangoutLink → send email with sala.html
  6. If error → send email with sala.html + error telemetry
  7. Show confirmation UI with same link as email
```

### Known Issues in V1 (Resolved in V2)
| Issue | Root Cause | V2 Fix |
|-------|---|---|
| Empty hangoutLink | gcal-push returns ok:true with "" | PATCH not executed, error 422 returned |
| Email ≠ UI | Different code paths | Email reads from BD, same source as UI |
| Google Calendar event lacks link | URL not in params | Build complete CalendarEvent with meeting_url |
| Silent fallback | No explicit provider state | Explicit provider + error_reason |
| 42501 RLS on candidatos | POST marketplace creates without permission | V2 uses separate flow for marketplace |

---

**Status: READY FOR USER REVIEW**

Does not proceed without explicit user approval on architecture.

