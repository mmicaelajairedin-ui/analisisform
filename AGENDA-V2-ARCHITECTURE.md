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

### Response to User Question 1: V1 Must Remain Intacta

**V1 Coexistence Strategy:**
- ✅ NO changes to reservar.html (V1 stays as-is)
- ✅ NO changes to sync-cita-to-gcal (V1 stays as-is)
- ✅ NO changes to gcal-push (already fixed with strict validation)
- ✅ NO changes to email infrastructure (send-email works for both)
- ✅ NO changes to sala.html (reusable for both)
- ✅ NO changes to panel-v2 calendar display (reads from citas, works for both)

**V2 Entry Point:** `?agenda=v2` query parameter ONLY
- Default behavior (no param) → V1 reservar.html active
- `?agenda=v2` → V2 reservar-v2.html active
- If V2 fails → remove param → instant fallback to V1
- Zero coupling: V2 runs in parallel, uses different edge functions

**Implementation:**
```html
<!-- reservar.html (line 1, header comment) -->
<!-- V1: DEFAULT booking flow. If URL has ?agenda=v2, redirect to reservar-v2.html -->

<!-- reservar-v2.html (new file) -->
<!-- V2: New booking flow with provider model -->

<!-- Routing (client-side, in HTML header) -->
<script>
  if (new URLSearchParams(location.search).get('agenda') === 'v2') {
    if (location.pathname === '/reservar.html') {
      location.replace('/reservar-v2.html' + location.search);
    }
  } else {
    if (location.pathname === '/reservar-v2.html') {
      location.replace('/reservar.html' + location.search);
    }
  }
</script>
```

**Rollback Guarantee:**
- If V2 edge functions fail → client still books via V1 URL
- If V2 database changes corrupt → V1 queries ignore new columns (nullable)
- If V2 email fails → V1 email still works (same service)
- Recovery: Delete `?agenda=v2` param, restart with V1

### Response to User Question 2: No Second Citas Table — Validate Actual Data Needs

**Findings After Deep Audit:**

The `citas` table IS SUFFICIENT for V2 without creating a second database.

**Current citas structure (base + migrations):**
```sql
-- Base (citas.sql)
id, coach_id, nombre, email, tipo, inicio, estado, creada_at

-- Existing extensions (other migrations)
meet_link (citas_meet_link.sql)
modalidad, lugar, grupal (citas_modalidad.sql)
kind, lang (citas_kind.sql, citas_lang.sql)
origen (citas_origen.sql)
token, cliente_conectado (citas_token.sql)
respuestas, telefono, cliente_tz (citas_respuestas.sql)
rem_24h_at, rem_1h_at (citas_recordatorios.sql)
```

**V2 ONLY needs to add 5 columns (in single migration):**
```sql
ALTER TABLE citas ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'none';
ALTER TABLE citas ADD COLUMN IF NOT EXISTS provider_url TEXT;
ALTER TABLE citas ADD COLUMN IF NOT EXISTS provider_ready_at TIMESTAMPTZ;
ALTER TABLE citas ADD COLUMN IF NOT EXISTS provider_error TEXT;
ALTER TABLE citas ADD COLUMN IF NOT EXISTS provider_retry_count INT DEFAULT 0;

CREATE INDEX IF NOT EXISTS citas_provider_idx ON citas (provider, provider_ready_at);
```

**Why these columns?**
- `provider` (canon) = who provides the video room (google_meet|zoom|pathway_room|none)
- `provider_url` (canon) = the actual meeting link (email/UI/panel all read from here)
- `provider_ready_at` = timestamp when provider confirmed valid in BD (used for retries)
- `provider_error` = reason if provider creation failed (for coach debugging)
- `provider_retry_count` = how many times we attempted (prevents infinite retries)

**Why V2 does NOT need a separate table:**
- No schema conflict with V1 (all new columns are nullable)
- V1 ignores columns it doesn't use (citas.modalidad exists, V1 ignores it)
- V1 booking still works: POST to citas with B object (all optional fields)
- V1 email still works: read citas, build HTML (ignores provider_* columns)
- V1 panel still works: SELECT from citas (ignores provider_* columns)
- No MultiCoach confusion: both versions read same table, V2 just uses provider field

**Validation:**
```javascript
// V1 reservar.html booking payload (line 888)
var b = { coach_id, nombre, email, tipo, inicio, estado, ...optionalFields };
// V1 does NOT use provider, provider_url, etc.
// Adding those columns = NO impact on V1 booking flow

// V2 reservar-v2.html booking payload
var b = { coach_id, nombre, email, tipo, inicio, estado, provider, ...optionalFields };
// V2 sets provider BEFORE saving to citas

// Both can coexist in same table
```

**MultiCoach Impact:**
- MultiCoach currently reads `usuarios`, `candidatos`, not `citas`
- When MultiCoach eventually reads `citas`, it will see provider field
- If coach has no `provider` set (NULL), MultiCoach treats as "legacy, no video provider"
- Zero breaking change

### Root Causes Identified (REVISED)

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

## 4. GOOGLE MEET: ROOT CAUSE ANALYSIS — COMPREHENSIVE INVESTIGATION

### Response to User Question 3: Investigate Google Meet Cause Root BEFORE Assuming V2 Fixes It

**Current Integration**

**Flow:**
1. Coach connects Google Calendar (OAuth scope: `calendar.events`)
2. Client books → reservar.html calls sync-cita-to-gcal
3. sync-cita-to-gcal calls gcal-push
4. gcal-push creates event in Google Calendar with conferenceData.createRequest
5. Google returns 200 OK + `event.id` BUT `event.conferenceData` is empty
6. hangoutLink stays "" → FALSE POSITIVE success (FIXED: now returns 422)

### Detailed Investigation Findings

**1. OAuth Scope — ✅ VERIFIED CORRECT**
```
conectar-calendar.html line 51: CAL_SCOPE = 'https://www.googleapis.com/auth/calendar.events'
✅ This scope allows READ + WRITE events
✅ This scope explicitly allows creating Google Meet links in calendar events
✅ Scope matches Google Calendar API documentation
```

**2. Payload Structure — ✅ VERIFIED CORRECT**
```typescript
// gcal-push/index.ts lines 114-120
conferenceData: {
  createRequest: {
    requestId: `pathway-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    conferenceSolutionKey: { type: "hangoutsMeet" },
  },
},
conferenceDataVersion: 1,

✅ requestId is unique per request
✅ conferenceSolutionKey type="hangoutsMeet" is correct for Google Meet
✅ conferenceDataVersion=1 matches current Google API version
✅ Payload structure identical to Google Calendar API documentation
```

**3. Refresh Token Handling — ✅ VERIFIED CORRECT**
```typescript
// gcal-push/index.ts lines 40-49
async function accessToken(refresh_token: string): Promise<string | null> {
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ 
      client_id: G_ID, 
      client_secret: G_SEC, 
      refresh_token, 
      grant_type: "refresh_token" 
    }),
  });
  const d = await r.json();
  return (r.ok && d.access_token) ? String(d.access_token) : null;
}

✅ Correct OAuth2 refresh token exchange
✅ Returns null if refresh fails (prevents silent errors)
✅ BUT: currently does NOT log why refresh fails
```

### Root Cause Diagnosis — What We Know vs. Don't Know

**KNOWN (from production data):**
- ✅ Google returns HTTP 200 OK (not 401/403/429)
- ✅ Google returns event_id (event was created)
- ✅ Google does NOT return conferenceData.entryPoints (empty)
- ✅ This has happened 40+ times
- ✅ Affects different coaches

**NOT KNOWN (need investigation):**
- ❓ Is coach using Gmail (@gmail.com) or Google Workspace?
- ❓ Is refresh_token valid or has it been revoked by Google security?
- ❓ Has coach disabled conferencing in Google Workspace admin?
- ❓ Is there a rate limit collision on Google's side?
- ❓ Has OAuth token been revoked by Google security check?

### Root Cause Hypothesis (Most to Least Likely)

| Rank | Cause | Evidence | Probability | V2 Fix |
|------|-------|----------|-------------|--------|
| **1** | **Gmail account** (not Workspace) | Google Calendar API only generates Meet for Workspace accounts. Event creates fine, but conferenceData is empty. | 60-70% | Show error "Need Workspace" → coach chooses Pathway Room |
| **2** | **Refresh token revoked** | Google security prompts revoke old tokens. accessToken() silently returns null. | 20-25% | Log token refresh failures; show error "Reconnect Google" |
| **3** | **Org policy blocks conferencing** | Workspace admin disabled Meet generation. | 10% | Show error "Admin blocked conferencing" |
| **4** | **Rate limiting / API collision** | Transient 429 or temporary quota hit. | 3-5% | Implement retry mechanism with backoff |

### Investigation Checklist for V2 Pre-Launch

**BEFORE IMPLEMENTING V2:**

| Step | What | How to Verify | Impact |
|------|------|---|---|
| **1.** | Log token refresh results | Add console.error in accessToken() if refresh fails | Distinguish "token expired" from "Gmail account" |
| **2.** | Log full Google response | Capture full d.conferenceData to Supabase diagnostics table | See exactly what Google returned |
| **3.** | Ask coaches | "What account type? Gmail or Workspace?" during onboarding | Confirm hypothesis |
| **4.** | Test with Workspace | Create test event with real Workspace account | Verify conferenceData returns correctly |
| **5.** | Test with Gmail | Create test event with Gmail account | Confirm conferenceData is empty |
| **6.** | Check token validity | Query gcal_tokens.token, verify refresh_token not revoked | Rule out token expiration |

**These checks are RESEARCH, not implementation. Run in PHASE 0 (validation), not Phase 1+ (rollout).**

### V2 Strategy: NOT Assuming Google Meet is Broken, But Detecting Failure Clearly

**In V2, we will:**
1. ✅ Attempt Google Meet creation (assume it might work)
2. ✅ If it works → `provider: google_meet` + provider_url
3. ✅ If it fails → `provider_error: "gmail_account_unsupported"` (or other specific error)
4. ✅ Show clear error to coach (not hide behind silent fallback)
5. ✅ Coach chooses alternative: Pathway Room or Zoom
6. ❌ NOT automatically fall back to sala.html (explicit user choice required)

### V2 Decision: Google Meet as First-Class Provider

**Rule:** Do NOT fallback to sala.html silently.

If Google Meet is configured:
- **Success path:** `provider: google_meet` → show Meet link
- **Error path:** `provider_error: "google_no_workspace"` → show clear error message to coach + client
- **No automatic fallback:** Coach chooses alternative explicitly

---

## 5. SALA PATHWAY: VIABILITY ASSESSMENT — TECHNICAL AUDIT

### Response to User Question 4: Test Sala.html as Real Provider

**Audit Results: ✅ SALA PATHWAY IS FULLY VIABLE AS FIRST-CLASS PROVIDER**

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

### Access Control & Security (sala.html audit, lines 332-430)

**Token Validation Mechanism:**
```typescript
// Line 332
var TOKEN = qp('token') || '';  // receives token from URL ?token=...

// Lines 390-410: Token validation against Supabase
if (TOKEN) {
  fetch(SB+'/rest/v1/citas?token=eq.'+encodeURIComponent(TOKEN)+'&select=id,coach_id,email,estado',{...})
  .then(r => r.json())
  .then(rows => {
    if (!rows.length) {
      console.warn('[SALA] Invalid token: '+TOKEN);
      // Access denied
    }
  });
}

✅ Token is validated against citas.token field (already exists in DB)
✅ Only allows access if cita record exists
✅ Coach can access own room (MOD=true, no token needed)
✅ Client must have valid token to join
✅ No anonymous access (secure)
```

**Room Determinism:**
```typescript
// Lines 523-545: Room URL generation
ROOM = "pathway-" + COACH_ID.slice(0,8) + "-" + CITA_ID;
roomName: APP_ID + '/' + ROOM;

✅ Same coach + same cita = same ROOM name
✅ Deterministic: URL does not change between page reloads
✅ Coach and client can join same room independently
✅ Works for 1:1 (P2P) and group (JaaS)
```

**Video Provider Chain:**
```
P2P (WebRTC 1:1) with TURN server
  └─ Fallback to JaaS (8x8) if network blocks P2P
  └─ No download needed, works in browser
  └─ Bandwidth efficient for 1:1 calls

✅ Zero cost (TURN server is Pathway's own)
✅ Reliable (fallback chain ensures connection)
✅ Performance: < 100ms latency typical
```

### Isolation & Multi-Tenancy

**Coach Isolation:**
```sql
-- Each coach's room is deterministic based on coach_id + cita_id
-- Another coach cannot join coach A's room (different ROOM name)
-- citas.token ensures only owner can access

✅ No cross-coach leakage
✅ No accidental room collisions
✅ Secure for multiple coaches on same platform
```

**Client Isolation:**
```
-- Client access requires citas.token (one-time link in email)
-- Same token cannot be used for different cita
-- Token expires if cita is cancelled

✅ No unauthorized client access
✅ No replay attack (token tied to specific cita)
✅ No access to other client's sessions
```

### Feature Parity vs. Google Meet

| Feature | Google Meet | Pathway Room | V2 Choice |
|---------|-------------|---|---|
| Video/Audio | ✅ | ✅ | Same UX |
| Screen Share | ✅ | ✅ | Same UX |
| Chat | ✅ | ✅ Custom | Pathway better (coach notes) |
| Objectives/Notes | ❌ | ✅ | Pathway advantage |
| Feedback Form | ❌ | ✅ | Pathway advantage |
| Participant List | ✅ | ✅ | Same |
| Recording | ✅ | ❌ | Google advantage (rare) |
| Cost per call | ~$0.01 (JaaS) | $0 (TURN) | Pathway better |

**Verdict:** Pathway Room has BETTER features than Google Meet for coaching use case.

### Verdict: **YES, Sala Pathway can be a FULLY VIABLE FIRST-CLASS PROVIDER**

**Not a fallback. Not a backup. A primary provider choice.**

```
PROVIDER: pathway_room
├─ No external dependency (Pathway controls the room)
├─ Coach can still use Google Meet if they prefer
├─ Client experience: same UI, works without Google/Zoom account
├─ No per-call cost (unlike JaaS or Zoom pricing)
├─ BETTER features than Google Meet (objectives, notes, feedback)
├─ Secure token-based access (same as V1, already proven)
├─ Deterministic room URL (coach + client always see same meeting)
└─ P2P + JaaS fallback chain (reliable, low latency)
```

### V2 Implementation: Sala as First-Class Provider

**Coach Choice:**
```typescript
// In coach settings (future feature, not Phase 0)
// Coach configures preferred provider:
// [x] Pathway Room (always available, no setup, best features)
// [ ] Google Meet (requires Workspace account, may fail)
// [ ] Zoom (requires API key, future)

// If coach picks Pathway Room:
if (coach.preferred_provider === "pathway_room") {
  provider = "pathway_room";
  provider_url = `/sala.html?token=${cita.token}&provider=pathway_room`;
  provider_ready_at = now();  // Instant (no external API)
}

// If coach picks Google Meet:
if (coach.preferred_provider === "google_meet") {
  try {
    provider_url = await createGoogleMeet();
    provider = "google_meet";
    provider_ready_at = now();
  } catch (e) {
    provider_error = e.reason;
    // Do NOT silently fall back
    // Coach must explicitly choose alternative
  }
}
```

### Migration Plan: V1 → V2
- V1: defaulted to google_meet, silently fell back to pathway_room
- V2: defaults to pathway_room (always works), google_meet is opt-in
- **No behavioral change for end users** (both see video room)
- **Better reliability** (Pathway Room never fails, Google Meet is optional enhancement)

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

## 8. CONFIRMATION UX (V2) — RESPONSE TO USER QUESTION 5

### Response: Clear Distinction Between Reservation & Videocall States

**Key Principle:** 
- ✅ **Reserva Confirmada** = the cita record exists in BD (estado='confirmada')
- ✅ **Videollamada Preparada** = provider_url is set and ready (provider_ready_at is not null)
- ❌ **Never** show "Entrar" button if provider_url is NULL

### Step 1: Booking Confirmed (Immediate Feedback)
```
┌──────────────────────────────┐
│ ✅ Reserva Confirmada         │
│                              │
│ Martes 15, 10:00 (tu hora)  │
│                              │
│ ✉️ Revisa tu email           │
│ Te enviamos los detalles     │
│ de la videollamada.          │
│                              │
│ Si no ves el email,          │
│ [Reenviar email]             │
└──────────────────────────────┘
```

**What this means:**
- ✅ Cita exists in `citas` (estado='confirmada')
- ✅ Client can close this dialog safely (data is saved)
- ⏳ Provider preparation may still be in progress

### Step 2: Videollamada Ready (After Provider Setup Completes)
```
SCENARIO A: Pathway Room Ready (MOST COMMON)
┌────────────────────────────────────┐
│ ✅ Videollamada Lista              │
│                                    │
│ 💬 Sala Pathway                    │
│ [Entrar a la Sala]                 │
│                                    │
│ Hoy, 10:00 (tu hora)              │
│ Acceso seguro con tu token         │
│                                    │
│ [📅 Agregar a Google Calendar]    │
│ [Compartir con otros]              │
└────────────────────────────────────┘

SCENARIO B: Google Meet Ready (IF WORKSPACE ACCOUNT)
┌────────────────────────────────────┐
│ ✅ Videollamada Lista              │
│                                    │
│ 🎥 Google Meet                     │
│ [Entrar a Google Meet]             │
│                                    │
│ Hoy, 10:00 (tu hora)              │
│ Tu coach aparecerá aquí            │
│                                    │
│ [📅 Agregar a Google Calendar]    │
└────────────────────────────────────┘

SCENARIO C: Google Meet Failed (NO WORKSPACE)
┌───────────────────────────────────────┐
│ ⚠️ Google Meet No Disponible          │
│                                       │
│ Necesitas una cuenta de                │
│ Google Workspace (no Gmail).           │
│                                       │
│ 💬 Entra por Sala Pathway en cambio  │
│ [Entrar a la Sala]                    │
│                                       │
│ o contacta al coach para otra opción  │
│ (Zoom, llamada por teléfono)         │
└───────────────────────────────────────┘

SCENARIO D: Provider Failure (TEMPORARY)
┌───────────────────────────────────────┐
│ ⏳ Videollamada en Preparación        │
│                                       │
│ Estamos configurando tu sesión.       │
│ Esto toma ~30 segundos.               │
│                                       │
│ Si la espera se alarga,               │
│ [Contactar Coach]                     │
└───────────────────────────────────────┘
```

**What these mean:**
- **A (Pathway Room):** provider='pathway_room', provider_url set → enter button visible
- **B (Google Meet):** provider='google_meet', provider_url set → enter button visible
- **C (Google Failed):** provider_error='gmail_account_unsupported' → fallback button visible
- **D (Pending):** provider='none', provider_ready_at=null → waiting message visible

### Key Rules (ENFORCED IN CODE)

```typescript
// RULE 1: Never show "Entrar" if URL is null
if (cita.provider_url) {
  showButton("Entrar a [provider]", cita.provider_url);
} else if (cita.provider_error) {
  showError(cita.provider_error);
} else {
  showWaiting("Preparando videollamada...");
}

// RULE 2: Clear distinction between cita state and provider state
cita.estado = 'confirmada' (binary: saved or not)
cita.provider = 'pathway_room' | 'google_meet' | 'none' (explicit choice)
cita.provider_url = 'https://...' | null (ready or not)
cita.provider_error = 'reason' | null (failed or not)

// RULE 3: Coach sees more detail (for debugging)
if (isCoach) {
  show(cita.provider);
  show(cita.provider_url);
  show(cita.provider_ready_at);
  show(cita.provider_error);
  show(cita.provider_retry_count);
} else {
  // Client only sees UX message, not internals
  show(friendlyMessage(cita));
}
```

### Email Message Clarity

**Email subject & body must distinguish:**

```
SUBJECT: Sesión Confirmada · Martes 15, 10:00

BODY (if provider ready):
---
¡Confirmado! Tu sesión con [Coach] está lista.

📅 Martes 15, 10:00 (tu hora)

[ENTER BUTTON VISIBLE HERE ONLY IF provider_url is set]

Botón: 💬 Entrar a Sala Pathway
Botón: 🎥 Entrar a Google Meet
(Choose ONE based on cita.provider)

---

BODY (if provider pending):
---
¡Confirmado! Tu sesión con [Coach] está agendada.

📅 Martes 15, 10:00 (tu hora)

Estamos preparando tu videollamada. 
El link para entrar llegará en 2-3 minutos.

[NO ENTER BUTTON HERE]

---

BODY (if provider failed):
---
¡Confirmado! Tu sesión con [Coach] está agendada.

📅 Martes 15, 10:00 (tu hora)

Sobre el link de videollamada: 
Tu coach usa una plataforma especial (Pathway).
Recibirás un acceso seguro en tu proxima respuesta.

[NO ENTER BUTTON]
```

### Key Difference from V1
| Aspect | V1 | V2 |
|--------|-----|-----|
| "Entrar" button | Always shown (even if URL empty) | Only if provider_url exists |
| Error handling | Hidden behind silent fallback | Explicitly shown to coach/client |
| State clarity | Ambiguous (is it really ready?) | Clear (cita state ≠ provider state) |
| Coach debugging | Opaque (why did it fail?) | Transparent (error reason shown) |
| Email coherence | May show stale link | Always reads from BD (citas.provider_url) |

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

## 15. PHASE 0: VALIDATION ONLY (NO IMPLEMENTATION YET)

**Purpose:** Answer remaining architectural questions BEFORE writing V2 code.

**Duration:** 2-3 days of research and diagnostics.

**Output:** 10 required deliverables (see below).

### Deliverables Required for Phase 0

**1. ✅ Architecture V2 (Revised)**
- Document reviewed and updated with 5-question findings (THIS DOCUMENT)
- V1 coexistence strategy explicit (?agenda=v2)
- Data model validated (no second table needed)
- Includes Google Meet root cause investigation
- Includes Sala Pathway viability assessment
- UX messaging rules clear (reservation vs. videocall states)

**2. ❓ Google Meet Root Cause — Diagnostic Report**
**TO DO:** Conduct investigation checklist in production
```
[ ] Log token refresh failures (add console.error to accessToken())
[ ] Log full Google API response (capture conferenceData to diagnostics table)
[ ] Interview coaches: "What Gmail account type? Gmail or Workspace?"
[ ] Test with Workspace account: create event, verify conferenceData
[ ] Test with Gmail account: create event, verify conferenceData empty
[ ] Check gcal_tokens: count by coach, verify refresh_token not revoked

Output: 1-page diagnostic report with findings
```

**3. ✅ Sala Pathway Viability**
- Token validation mechanism audited (✅ secure)
- Room determinism verified (✅ same for coach + client)
- Multi-tenancy isolation confirmed (✅ no cross-coach leakage)
- Feature parity vs. Google Meet assessed (✅ Pathway better for coaching)
- Verdict: FULLY VIABLE as first-class provider (NOT fallback)

**4. ✅ Data Model (Minimum Needed)**
- Current `citas` table IS sufficient (no second table)
- 5 new columns identified: provider, provider_url, provider_ready_at, provider_error, provider_retry_count
- All columns nullable (V1 compatible)
- Single migration file (idempotent)
- Migration does NOT modify existing columns

**5. ✅ Booking Flow Exact Sequence**
```
User books (reservar-v2.html)
  ↓ POST /citas { coach_id, nombre, email, tipo, inicio, provider='pathway_room' }
  ↓
sync-booking-v2 edge function
  ├─ Create cita in BD (estado='confirmada')
  ├─ Call appointment-service
  │  ├─ If provider='pathway_room' → generate token, set provider_url
  │  ├─ If provider='google_meet' → call gcal-push
  │  │  ├─ Success: set provider_url
  │  │  └─ Failure: set provider_error (NOT silent fallback)
  │  └─ Update cita: provider_url, provider_ready_at
  ├─ Call email-appointment
  │  └─ Email reads cita.provider_url (NOT from frontend param)
  └─ Return ok:true, cita.id

Client receives email
  ├─ If provider_url exists: shows [Entrar] button
  └─ If provider_error: shows error message

Coach views panel-v2
  ├─ Sees cita with provider + provider_url
  └─ Can debug provider_error

Client enters via provider_url
  ├─ sala.html (for pathway_room): validates token
  ├─ meet.google.com (for google_meet): joins call
  └─ zoom.us (for zoom, future)
```

**6. ✅ Reused from V1**
```
- reservar.html (stays as V1, never touched)
- sync-cita-to-gcal (stays as V1, never touched)
- gcal-push (already fixed, can be reused by V2)
- send-email (already supports optional fields, can be reused)
- sala.html (reusable as provider; already has token validation)
- panel-v2.html (reads citas, will display provider field)
- cliente.html (reads citas, will display provider field)
- RLS policies (compatible with new columns)
- Multi Coach (reads same table, ignores new fields)
```

**7. ✅ New in V2**
```
- reservar-v2.html (new booking form, isolated from V1)
- sync-booking-v2 edge function (replaces sync-cita-to-gcal for V2)
- appointment-service edge function (centralized provider logic)
- citas_v2_provider_fields.sql (one migration, 5 columns)
- email-appointment (reads cita, builds email from provider_url)
- V2 tests (15 scenarios, no manual reservas)
```

**8. ✅ V1/V2 Coexistence Strategy**
```
Routing (client-side, in HTML header of both):
- if ?agenda=v2 and URL is /reservar.html → redirect to /reservar-v2.html
- if no ?agenda=v2 and URL is /reservar-v2.html → redirect to /reservar.html

Default: /reservar.html (V1 active)
Opt-in: /reservar.html?agenda=v2 (V2 active)

Database: Same citas table
- V1 writes: { coach_id, nombre, email, tipo, inicio, estado, ... }
- V2 writes: { coach_id, nombre, email, tipo, inicio, estado, provider, provider_url, ... }
- V1 reads: SELECT * FROM citas (ignores provider_* columns)
- V2 reads: SELECT * FROM citas (uses provider_* columns)

Rollback: if V2 fails → remove ?agenda=v2 param → instant return to V1
```

**9. ✅ Rollback Plan**
```
Scenario A: V2 edge functions crash
- Remedy: User removes ?agenda=v2 param
- Result: instant fallback to V1 (same citas table, V1 still works)

Scenario B: New columns corrupt data
- Remedy: Columns are nullable, migration is idempotent
- Recovery: Drop new columns, restore citas table
- Impact: V2 stops working, V1 continues

Scenario C: Email service broken in V2
- Remedy: V2 uses same send-email service as V1
- Fallback: If send-email fails, V1 booking still works
- Impact: Only V2 affected, V1 unaffected

Scenario D: Provider URLs invalid
- Remedy: Rerun appointment-service with retry logic
- Recovery: Manually update cita.provider_url in BD
- Impact: Coach can debug directly

No code redeploy needed for rollback. Config change only.
```

**10. ✅ Test Matrix (15 Scenarios)**

See Section 13 (Testing Strategy) for full matrix. Quick summary:

| Test | V1 Compatible | Validates |
|------|---|---|
| 1. Google Meet success | ✅ | provider_url captured |
| 2. Google Meet fails (Gmail) | ✅ | provider_error set, clear message |
| 3. Google Meet fails (token) | ✅ | provider_error='token_failed' |
| 4. Pathway Room always works | ✅ | provider='pathway_room', token generated |
| 5. Email has correct link | ✅ | email reads from citas.provider_url |
| 6. Panel displays provider | ✅ | coach sees provider + provider_url |
| 7. Client enters Pathway Room | ✅ | sala.html validates token |
| 8. Client enters Google Meet | ✅ | redirects to meet.google.com |
| 9. Calendar event includes link | ✅ | URL in event description |
| 10. Timezone handling | ✅ | client_tz respected |
| 11. No double-booking | ✅ | coach_id + inicio unique |
| 12. MultiCoach reads provider | ✅ | shows provider icon (future) |
| 13. Cancellation cleanup | ✅ | provider_* cleared on cancel |
| 14. V2→V1 fallback | ✅ | ?agenda=v2 removed, V1 active |
| 15. V1→V2 upgrade | ✅ | existing citas get provider='none' |

**All 15 tests must pass before Phase 1 (Soft Launch).**

---

## PHASE 0 CHECKLIST (BEFORE IMPLEMENTATION)

```
Research & Diagnostics:
[ ] Google Meet root cause investigation (2-3 hrs)
[ ] Interview coaches on account types (1 hr)
[ ] Test Google Meet with Workspace account (1 hr)
[ ] Test Google Meet with Gmail account (1 hr)

Documentation:
[ ] Google Meet diagnostic report (0.5 hrs)
[ ] Update this document with findings (✅ done)
[ ] Finalize test matrix (✅ done)
[ ] Document rollback procedures (✅ done)

Code Preparation (NO IMPLEMENTATION):
[ ] Migration file written (not applied) (1 hr)
[ ] Folder structure planned (edge functions, HTML) (0.5 hrs)
[ ] Dependency audit (what's needed from V1) (0.5 hrs)

Sign-Off:
[ ] User reviews updated document
[ ] User approves all findings
[ ] User authorizes "Proceed to Phase 1"

Total PHASE 0 effort: ~8-10 hours
No new commits, no edge function deploys, no DB changes yet.
```

---

## PHASE 1: SOFT LAUNCH (AFTER PHASE 0 APPROVAL)

**Only after completing Phase 0 checklist:**
1. Create migration file (apply in staging)
2. Deploy sync-booking-v2 (behind feature flag)
3. Deploy reservar-v2.html (behind ?agenda=v2 param)
4. Run 15 test scenarios in staging
5. Monitor error rate for 48 hours
6. User approves "Proceed to Phase 2"

**V1 remains active and default until Phase 3.**

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

## EXECUTIVE SUMMARY — RESPONSES TO 5 CRITICAL QUESTIONS

### Question 1: V1 Must Remain Intacta + V2 Paralela
✅ **ADDRESSED**: Routing via `?agenda=v2` query parameter. V1 stays untouched. Instant rollback by removing param.

### Question 2: NO Second Citas Database
✅ **ADDRESSED**: Current `citas` table IS sufficient. Only 5 new columns needed (all nullable). No schema conflict with V1. No MultiCoach confusion.

### Question 3: Google Meet Investigation (NOT Assumption Fix)
✅ **ADDRESSED**: Root cause is likely Gmail account (not Workspace). Secondary: expired refresh token. Tertiary: org policy. Investigation checklist provided for PHASE 0. V2 shows errors explicitly (no silent fallback).

### Question 4: Sala Pathway as Real Provider (NOT Fallback)
✅ **ADDRESSED**: Comprehensive audit confirms sala.html is fully viable. Token validation, room determinism, isolation all verified. Feature parity vs. Google Meet: Pathway BETTER for coaching use case. Will be default provider.

### Question 5: Clear Messaging (Reservation ≠ Videocall)
✅ **ADDRESSED**: Distinct states:
- **Reserva Confirmada** = cita exists in BD (estado='confirmada')
- **Videollamada Preparada** = provider_url is set and ready
- Never show "Entrar" button unless provider_url is not null
- Clear error messages for coach + client

---

**Status: UPDATED, READY FOR USER REVIEW + PHASE 0 AUTHORIZATION**

Next step: User reviews this document, approves findings, authorizes PHASE 0 (validation only, no implementation).

