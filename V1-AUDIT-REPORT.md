# V1 CODE AUDIT — CONSERVAR / MODIFICAR / ABANDONAR

**Investigation Date:** August 13, 2026  
**Scope:** 7 critical files/services in booking flow  
**Assessment Basis:** Code review + root cause investigation (Gmail account → no Meet links)

---

## SUMMARY

V1 has **architectural fragmentation**: URL decision is made in 3 places independently, email is sent with hardcoded content (not from DB), and multiple "providers" exist but aren't formalized. 

| Component | Status | Reason |
|-----------|--------|--------|
| `reservar.html` | MODIFY (extract URL logic) | 3-way branching; unify in V2 |
| `sync-cita-to-gcal` | MODIFY (make provider-agnostic) | Hardcoded for Google; V2 uses provider model |
| `gcal-push` | CONSERVAR + ARCHIVE | Keep for Google Meet (if re-enabled); archive in V2 favor of provider interface |
| `send-email` | CONSERVAR (with contract change) | Reusable email service; must read `provider_url` from DB, not trust frontend |
| `panel-v2.html` | MODIFY (read `provider_url`) | Currently reads `meet_link`; V2 reads provider-aware field |
| `cliente.html` | MODIFY (read `provider_url`) | Same as panel-v2 |
| `sala.html` | CONSERVAR + PROMOTE | Fallback → first-class provider; token validation ✅ |

---

## FILE-BY-FILE AUDIT

### 1. `reservar.html` — MODIFY (EXTRACT URL LOGIC TO V2)

**Current State (lines 902-977):**

Three independent video URL decisions:

```javascript
// Decision 1: Zoom link (lines 914-935)
_getZoomLink(function(zoomLink){
  if(zoomLink && /^https?:\/\//i.test(zoomLink)){
    _link = zoomLink;
    _sendEmail(zoomLink);  // ← URL decision made here
  } else {
    // Decision 2: Google Meet (lines 943-976)
    fetch(SB+'/functions/v1/sync-cita-to-gcal', { ... })
      .then(function(d){
        if(d.ok && d.link_saved && d.hangoutLink){
          _link = d.hangoutLink;
          _sendEmail(_link);  // ← URL decision made here
        } else if(d.ok && !d.link_saved){
          // Decision 3: Fallback Sala (lines 908-912)
          _link = _fallbackSalaUrl;
          _sendEmail(_link);  // ← URL decision made here
        }
      })
  }
});
```

**What's Good:**
- ✅ Cascade logic is sound (Zoom → Google Meet → Fallback)
- ✅ Async-safe with proper callback chaining
- ✅ Anti-double-booking check (lines 1014-1033)
- ✅ Token generation for "manage booking" link (line 1037)
- ✅ Calendar invite (.ics) is well-formed (lines 1041-1049)
- ✅ Marketplace integration (lines 993-1000)

**What's Broken:**
- ❌ **CRITICAL:** `_sendEmail(joinLink)` is called with URL from frontend decision
  - Line 1076: `postEmail({ html:htmlCli, ... })` passes hardcoded HTML with `joinLink`
  - Email service **never reads from database** — trusts frontend to provide correct URL
  - If frontend crashes mid-sync, email promises link that doesn't exist in DB
  - Race condition: sync completes AFTER email sends → divergence

- ❌ URL decision is made in 3 places (violates single source of truth)
  - Zoom check in reservar.html
  - Google Meet check in reservar.html → sync-cita-to-gcal → gcal-push
  - Sala fallback in reservar.html
  - V2 decision must be deferred to **backend after all syncs complete**

- ❌ No provider formalization
  - Zoom is just a URL field in usuarios.configuracion
  - Google Meet is created async via sync-cita-to-gcal
  - Sala is hardcoded fallback
  - No explicit provider type in citas table

- ❌ Email template builds HTML inline (lines 1060-1075)
  - Not reusable
  - If link changes, email and UI diverge
  - Client portal (cliente.html) has different template (duplication)

- ❌ Sendmail is called BEFORE sync completes reliably
  - `_retryEmail(2)` retries 3 times with 1s delay (lines 1096-1104)
  - But sync-cita-to-gcal can take >1s on network delay
  - Race condition window exists

**For V2:**
- ❌ ABANDON this decision logic
- ✅ KEEP: anti-double-booking, token generation, .ics builder
- ✅ KEEP: Marketplace integration (best-effort)
- ✅ KEEP: Async callback structure (refactor to promises)
- **NEW:** Backend decides provider AFTER sync completes + saves to `citas.provider_url`
- **NEW:** Email service reads `provider_url` from database (not frontend)
- **NEW:** Booking confirmation shows URL from database, not memory

---

### 2. `sync-cita-to-gcal` — MODIFY (GENERALIZE TO PROVIDER INTERFACE)

**Current State:**

Synchronizes a booking to Google Calendar only. Good transactional contract, but hardcoded for one provider.

```typescript
// Calls gcal-push (Google Meet only)
const pushResp = await fetch(`${SB_URL}/functions/v1/gcal-push`, {
  body: JSON.stringify({
    coach_id,
    op: "create",
    event: { summary, description, location, startISO, endISO },
  }),
});

// Saves hangoutLink to meet_link
if (hangoutLink) {
  const ur = await fetch(`${SB_URL}/rest/v1/citas?id=eq.${citaId}`, {
    body: JSON.stringify({ meet_link: hangoutLink }),
  });
}
```

**What's Good:**
- ✅ Transactional contract: saves meet_link ONLY if Supabase PATCH succeeds
- ✅ Distinguishes "no Google connection" (ok:true, no link) from "Google error" (ok:false)
- ✅ Logs full details (lines 100, 96)
- ✅ Handles missing coach_id gracefully (line 50)
- ✅ 1-hour session duration assumption is reasonable default (line 54)

**What's Broken:**
- ❌ **Hardcoded for Google Meet only**
  - Cannot handle Zoom, Sala, or future providers
  - Assumes `hangoutLink` field exists and will be in response

- ❌ **Does NOT save `google_event_id`**
  - For V2, must save event_id to distinguish "created in provider" from "not yet created"
  - Investigation found: 0/63 bookings have google_event_id (sync never saved it)

- ❌ **No retry logic**
  - If Supabase PATCH fails (line 95), returns 500 immediately
  - No exponential backoff for transient failures
  - Frontend must retry manually (reservar.html doesn't)

- ❌ **Description is hardcoded empty**
  - Line 66: `description: "", // JULIO 2026: Empty description; Google Meet is auto-generated`
  - Should include Pathway Room fallback link or client portal URL

- ❌ **Assumes modalidad logic**
  - Line 67: only sets location for "presencial" (in-person)
  - For online bookings, location is empty
  - But coach might want video provider name in event description

**For V2:**
- ❌ ABANDON this hardcoded implementation
- ✅ KEEP: transactional contract pattern
- ✅ KEEP: logging detail level
- ✅ KEEP: graceful "no Google" handling
- **NEW:** Generic provider sync function that accepts:
  - `provider` type (google_meet, zoom, pathway_room, etc.)
  - Provider-specific config (refresh_token, API key, room params, etc.)
  - Common fields (summary, startISO, endISO)
  - Returns: `{ ok, provider_url, event_id, error }`
- **NEW:** Save BOTH event_id (for provider) AND provider_url (for client)
- **NEW:** Exponential retry (3 attempts: immediate, 2s, 4s)

---

### 3. `gcal-push` — CONSERVAR (ARCHIVE IN V2, KEEP AS REFERENCE)

**Current State (lines 1-157 in `/supabase/functions/gcal-push/index.ts`):**

Creates Google Calendar events with optional Google Meet links.

**What's Good:**
- ✅ **OAuth scope is CORRECT** (line 39-49: `accessToken()` function, refresh_token rotation)
- ✅ **API payload is CORRECT** (lines 114-120: conferenceData with hangoutsMeet type)
- ✅ **Strict validation** (lines 150-153: returns 422 if hangoutLink is empty, not false positive)
- ✅ **Comprehensive error handling** (lines 134-155: HTTP errors, missing fields, etc.)
- ✅ **Detailed logging** (line 146: logs Google response for debugging)
- ✅ **Supports cancel operation** (lines 96-101: DELETE request for event cancellation)
- ✅ **Supports update operation** (lines 126-127: PATCH for event modification)

**What's Broken:**
- ❌ **Only handles Google Meet**
  - Cannot be repurposed for Zoom, Sala, or other providers
  - Entire request/response cycle is Google-specific

- ❌ **Detects Gmail accounts only by absence of conferenceData**
  - No explicit account type check
  - Investigation showed: Gmail accounts get 200 OK + empty conferenceData
  - Would benefit from explicit "Gmail not supported" error message

- ❌ **No support for user-configurable Meet settings**
  - Always requests hangoutsMeet
  - No option for other conference types (e.g., videoRTC with custom server)

**For V2:**
- ✅ CONSERVAR: Keep this function as-is in codebase (reference implementation)
- ✅ KEEP: For coaches with Google Workspace who explicitly want Google Meet
- ❌ ARCHIVE: Don't call by default; use provider interface instead
- **NEW:** Provider wrapper that:
  - Detects Gmail vs Workspace (could inspect token claims or test event creation)
  - Returns explicit error: "Gmail accounts cannot generate Google Meet; use Pathway Room"
  - Allows coaches to opt-in if they have Workspace account

---

### 4. `send-email` — CONSERVAR (WITH CRITICAL CONTRACT CHANGE)

**Current State (lines 143-250 in `/supabase/functions/send-email/index.ts`):**

Reusable email service via Brevo transactional API. Accepts HTML + signature type.

**What's Good:**
- ✅ **Reusable contract** (lines 35-50: EmailPayload interface)
- ✅ **Flexible signatures** (lines 44-49: pathway | coach | none)
- ✅ **XSS protection** (lines 61-65: HTML escape function)
- ✅ **Coach branding support** (lines 103-111: white-label logo for Pro coaches)
- ✅ **Handles multiple recipients** (lines 185-195: comma/semicolon-separated emails)
- ✅ **Multipart email support** (lines 206-220: HTML + text fallback for Outlook)
- ✅ **Calendar attachments** (lines 222-227: .ics invitations)
- ✅ **List-Unsubscribe header** (lines 228-232: improves deliverability)

**What's Broken:**
- ❌ **CRITICAL:** Expects HTML with embedded video link from caller
  - reservar.html line 1076: passes complete HTML with `joinLink` variable
  - Email service **never reads from database**
  - If booking sync fails async, email promises broken link

- ❌ **No provider awareness**
  - Email template hardcodes "Videollamada" (video call)
  - Could be customized per provider (Google Meet, Zoom, Sala, etc.)
  - No way to handle provider-specific messaging

- ❌ **No fallback link in case of sync failure**
  - If provider URL is null, email shows "El link aparecerá pronto" (link will appear soon)
  - Should instead show escalation path or phone number to contact coach

- ❌ **Coach signature requires manual data passing**
  - reservar.html must fetch coach details and pass to email
  - No central source of coach branding

**For V2:**
- ✅ CONSERVAR: Keep as reusable email service
- ✅ KEEP: Signature system (pathway, coach, none)
- ✅ KEEP: XSS protection, multipart support, attachments
- **CRITICAL CHANGE:** Must NOT expect HTML from caller
  - **NEW:** Accept `{ cita_id, template_type, language? }`
  - **NEW:** Service fetches cita + coach + provider details from Supabase
  - **NEW:** Builds HTML server-side (reads `citas.provider_url`)
  - **NEW:** Handles missing provider_url gracefully (retry later if still syncing)
- **NEW:** Support provider-specific email copy (e.g., "Entra a Google Meet aquí" vs "Entra a Zoom aquí")
- **NEW:** Include escalation contact if provider URL missing

---

### 5. `panel-v2.html` — MODIFY (READ `provider_url` INSTEAD OF `meet_link`)

**Current State (audited previously):**

Coach dashboard. Reads `meet_link` from citas table and displays to coach.

```javascript
// Example from panel (inferred from context):
// var cita = { meet_link: "https://meet.google.com/abc-def-ghi", ... }
// Display: `<a href="${cita.meet_link}">Entrar a Google Meet</a>`
```

**What's Good:**
- ✅ Reads from database (not frontend decision)
- ✅ Displays to coach for joining

**What's Broken:**
- ❌ Assumes all links are Google Meet
  - If provider is Zoom: `meet_link` = Zoom URL (wrong label)
  - If provider is Sala: `meet_link` = Pathway Room URL (confusing)
  - No provider awareness in UI

- ❌ No fallback handling
  - If `meet_link` is NULL, shows nothing (client doesn't know why)
  - Should show: "Room será generada pronto" or "Contactá al cliente"

- ❌ No state machine visibility
  - Coach doesn't know if provider is being created (PENDING), ready (READY), or failed (ERROR)
  - Can't retry if provider creation failed

**For V2:**
- ✅ CONSERVAR: Reading from database structure
- ❌ MODIFY: Read `provider`, `provider_url`, `provider_ready_at`, `provider_error` instead of `meet_link`
- **NEW:** Display provider-aware UI:
  - Provider = "google_meet": "Entrar a Google Meet"
  - Provider = "zoom": "Entrar a Zoom"
  - Provider = "pathway_room": "Entrar a Sala"
  - Provider = "none": "Sin videollamada"
- **NEW:** Show state:
  - CONFIRMED + provider_url: `<a>Entrar</a>`
  - CONFIRMED + !provider_url + !provider_error: `<span>Sala en preparación...</span>`
  - CONFIRMED + provider_error: `<span style="color:red">Error: ${provider_error} <button>Reintentar</button></span>`
- **NEW:** Retry button if provider_error is set

---

### 6. `cliente.html` — MODIFY (READ `provider_url` INSTEAD OF INFERRED URL)

**Current State (audited previously):**

Client portal. Displays video call link.

**What's Good:**
- ✅ Reads from citas table
- ✅ Shows link to client

**What's Broken:**
- ❌ Same issues as panel-v2:
  - No provider awareness
  - No state visibility
  - No fallback handling

**For V2:**
- Same as panel-v2: Read `provider` + `provider_url`, show provider-aware UI + state

---

### 7. `sala.html` — CONSERVAR + PROMOTE TO FIRST-CLASS PROVIDER

**Current State (audited in AGENDA-V2-ARCHITECTURE.md):**

Pathway Room video provider. Fallback in V1, becomes explicit provider in V2.

```javascript
// Lines 332: TOKEN = qp('token')
// Lines 390-410: Token validation against citas.token in Supabase
// Lines 517-545: 8x8 JaaS video with room name based on cita.id
// Line 689: P2P + TURN fallback for unreliable networks
```

**What's Good:**
- ✅ **Secure token validation** (citas.token checked in Supabase)
- ✅ **Deterministic room name** (same coach + client always get same room)
- ✅ **P2P + TURN fallback** (works on corporate networks)
- ✅ **JaaS integration** (8x8 hosted infrastructure)
- ✅ **No third-party OAuth needed** (Pathway controls entirely)
- ✅ **Coach + client auto-disconnect after 30m** (session timeout)
- ✅ **Mobile-friendly** (responsive design)

**What's Broken:**
- ❌ Only accessible via URL query param (token)
  - Not integrated into cita workflow
  - No state tracking (who joined, when, duration)
  - No recording capability
  - No session analytics

- ❌ No explicit state in citas table
  - No way to know if room was ever entered
  - No session_id or session_start_time
  - No participant data

- ❌ In V1, only used as fallback
  - Not promoted as primary option
  - Coach might expect Google Meet instead
  - Client gets Sala without explanation

**For V2:**
- ✅ CONSERVAR: Keep sala.html entirely (no changes needed)
- ✅ KEEP: Token generation (see reservar.html line 1037)
- ✅ KEEP: Token validation (see sala.html line 390-410)
- **PROMOTE:** First-class provider (cita.provider = "pathway_room")
- **NEW:** Track session lifecycle:
  - `citas.provider_ready_at` = when room was first generated
  - `sesiones_registro` table = coach entered room (timestamp, duration, participants)
  - Optional: coach can enable recording (if 8x8 plan supports it)
- **NEW:** Coach can explicitly choose Pathway Room in booking creation (not just fallback)
- **NEW:** Client portal explains: "Video call runs on Pathway Room (no signup needed)"

---

## SUMMARY TABLE: WHAT TO KEEP/CHANGE/DROP

| Component | KEEP | CHANGE | DROP | Reason for V2 |
|-----------|------|--------|------|----------------|
| `reservar.html` booking form | Anti-double-booking ✅, .ics ✅, token gen ✅ | URL decision logic, email call ❌ | 3-way branching logic | Backend decides provider after all syncs complete |
| `sync-cita-to-gcal` | Transactional pattern ✅, logging ✅ | Hardcoded Google ❌ | Yes, archive | Generic provider sync function |
| `gcal-push` | Correct OAuth ✅, validation ✅ | Gmail detection | No, keep as ref | Use provider interface; keep for Workspace opt-in |
| `send-email` | Reusable contract ✅, signatures ✅ | HTML from caller ❌ | No | Read cita.provider_url from DB, build HTML server-side |
| `panel-v2.html` | Database reading ✅ | meet_link → provider_url ❌ | No | Show provider-aware UI + state machine |
| `cliente.html` | Database reading ✅ | Same as panel-v2 ❌ | No | Same changes as panel-v2 |
| `sala.html` | Token validation ✅, P2P ✅ | Promote status | No | First-class provider, optional session tracking |

---

## CROSS-CUTTING ISSUES ADDRESSED IN V2

1. **Single Source of Truth**
   - V1: URL decided in 3 places (reservar, sync-cita-to-gcal, gcal-push)
   - V2: Backend decides, saves to `citas.provider_url`, all clients read from DB

2. **Email Coherence**
   - V1: Email HTML hardcoded in reservar.html, sent before sync completes
   - V2: Email service fetches cita after sync completes, reads provider_url from DB

3. **Provider Abstraction**
   - V1: Google Meet, Zoom, Sala are separate code paths
   - V2: Formal `provider` + `provider_url` fields; extensible to future providers

4. **State Machine**
   - V1: No visibility into "is provider being created?" → client confused by "link coming soon"
   - V2: `provider_ready_at`, `provider_error`, `provider_retry_count` track lifecycle

5. **Error Handling**
   - V1: Silent fallback (coach doesn't know Google Meet failed)
   - V2: Explicit error states; coach can retry or switch provider

---

## NEXT STEP

This audit informs the V2 Model design. See `AGENDA-V2-FINAL-MODEL.md` for how these findings shape the new architecture.
