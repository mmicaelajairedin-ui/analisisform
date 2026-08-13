# AGENDA V2 — FINAL DATA & ARCHITECTURE MODEL

**Status:** COMPLETE (Design Phase)  
**Effective Date:** Post-FASE-0 approval  
**Implementation:** NOT YET (blocked until user review)

---

## EXECUTIVE SUMMARY

Agenda V2 replaces V1's fragmented URL decision logic (3 independent branches) with:

1. **Provider Model:** Explicit `provider` + `provider_url` fields in `citas` table
2. **State Machine:** Clear lifecycle (CREATED → CONFIRMED → PROVIDER_PENDING → PROVIDER_READY → MEETING_LIVE → COMPLETED/FAILED)
3. **Single Source of Truth:** Backend decides provider after sync completes; all UI/email read from `citas.provider_url`
4. **Zero-Downtime:** V1 continues working; V2 accessible via `?agenda=v2` query param

---

## 1. DATA MODEL

### 1.1 New Columns in `citas` Table

```sql
ALTER TABLE citas ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'none';
ALTER TABLE citas ADD COLUMN IF NOT EXISTS provider_url TEXT;
ALTER TABLE citas ADD COLUMN IF NOT EXISTS provider_ready_at TIMESTAMPTZ;
ALTER TABLE citas ADD COLUMN IF NOT EXISTS provider_error TEXT;
ALTER TABLE citas ADD COLUMN IF NOT EXISTS provider_retry_count INT DEFAULT 0;

-- Also keep for compatibility:
-- meet_link TEXT  (legacy, V1 will write here for Google Meet)
-- google_event_id TEXT (legacy, gcal-push writes here if attempt made)

-- For Sala provider:
ALTER TABLE citas ADD COLUMN IF NOT EXISTS sala_token TEXT;

-- For session tracking:
-- CREATE TABLE sesiones_registro (...)  -- already exists

CREATE INDEX IF NOT EXISTS citas_provider_idx ON citas (provider, provider_ready_at);
```

### 1.2 Valid Provider Values

```
provider = 'none' | 'google_meet' | 'zoom' | 'pathway_room'

'none'           — No video provider (in-person booking, or coach not configured)
'google_meet'    — Google Calendar Meet (requires Google Workspace account)
'zoom'           — Zoom meeting (requires coach to have Zoom API credentials)
'pathway_room'   — Pathway's built-in video (secure, no third-party OAuth)
```

### 1.3 Backward Compatibility

**V1 continues to work unchanged:**
- V1 queries SELECT meet_link, ignore new columns
- V1 writes meet_link (V2 code ignores it)
- New columns are nullable (V1 can INSERT without them)
- V1 queries work (SELECT * doesn't fail if columns exist)

**V2 Coexistence:**
- V2 code routes through separate booking flow (`reservar-v2.html`)
- Accesses same `citas` table but uses new columns
- Email service can handle both `meet_link` (legacy) and `provider_url` (V2)

---

## 2. STATE MACHINE

### 2.1 Booking Lifecycle

```
┌─────────────────────────────────────────────────────────┐
│ CREATED                                                 │
│ ├─ cita_id generated                                    │
│ ├─ estado = 'confirmada' (user clicked confirm)        │
│ └─ provider = 'none' (not yet assigned)                │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼ [Backend Async: Assign Provider]
┌─────────────────────────────────────────────────────────┐
│ PROVIDER_PENDING                                        │
│ ├─ provider = 'google_meet'|'zoom'|'pathway_room'      │
│ ├─ provider_url = NULL (not yet created)               │
│ ├─ provider_ready_at = NULL                            │
│ └─ Background job attempts to create room/event        │
└────────────────┬────────────────────────────────────────┘
                 │
        ┌────────┴────────┐
        │                 │
        ▼                 ▼
    [SUCCESS]         [FAILURE]
        │                 │
        ▼                 ▼
┌─────────────────┐  ┌─────────────────────┐
│ PROVIDER_READY  │  │ PROVIDER_ERROR      │
│ ├─ provider_url │  │ ├─ provider_error   │
│ │   is SET      │  │ │   = reason        │
│ ├─ ready_at =   │  │ ├─ ready_at = NULL  │
│ │   timestamp   │  │ ├─ retry_count++   │
│ ├─ Email sent   │  │ └─ Retry scheduled │
│ │   with link   │  └─────────────────────┘
│ └─ Coach can    │        │
│   join via URL  │        │ [After backoff]
└────────┬────────┘        │
         │                 ▼
         │       [Retry attempt]
         │                 │
         └────────┬────────┘
                  │
                  ▼
        ┌─────────────────────┐
        │ MEETING_LIVE        │
        │ ├─ coach + client    │
        │ │   entered room     │
        │ └─ session started   │
        └────────┬────────────┘
                 │
        ┌────────┴────────┐
        │                 │
        ▼                 ▼
   [30+ mins]        [<30 mins]
        │                 │
        ▼                 ▼
 COMPLETED          INCOMPLETE
 (session OK)    (network issue?)
```

### 2.2 State Ownership

| State | Owned By | Trigger | Action |
|-------|----------|---------|--------|
| CREATED | reservar.html | User confirms booking | INSERT cita with estado='confirmada' |
| PROVIDER_PENDING | async provider job | After INSERT | Call appropriate provider (Google/Zoom/Sala) |
| PROVIDER_READY | provider job | Provider returns URL | PATCH provider_url, send email |
| PROVIDER_ERROR | provider job | Provider fails | PATCH provider_error, schedule retry |
| MEETING_LIVE | sala.html or Google Meet | Coach/client join | Track in sesiones_registro (optional) |
| COMPLETED | coach or timeout | 30+ min session | Mark estado='completada' (optional) |

---

## 3. PROVIDER IMPLEMENTATIONS

### 3.1 Google Meet Provider

**Ownership:** `sync-cita-to-gcal-v2` (new edge function)

**Input:**
```typescript
{
  cita_id: number,
  coach_id: uuid,
  coach_email?: string,  // required for detecting account type
  startISO: string,
  endISO: string,
}
```

**Process:**
```
1. Load coach OAuth token from gcal_tokens
2. Attempt to refresh token (if stale)
3. Call Google Calendar API with conferenceData
4. Check response:
   - If conferenceData.entryPoints.length > 0 → SUCCESS
   - If conferenceData is empty → Gmail account (not Workspace)
   - If HTTP 401/403 → Token revoked/permissions lacking
5. Return { ok, provider_url, error }
```

**Output:**
```typescript
{
  ok: true,
  provider_url: "https://meet.google.com/abc-def-ghi",
  event_id: "xyz@google.com",
  provider: "google_meet",
}
// OR
{
  ok: false,
  error: "gmail_not_supported" | "token_revoked" | "workspace_disabled",
  retry_after_seconds: 3600,  // don't retry immediately for permission errors
}
```

**Fallback:** If error, provider job tries next provider (Zoom) or defaults to Pathway Room

**Cost:** 1 Google Calendar API call per booking. Rate limit: 10 calls/sec per project.

---

### 3.2 Zoom Provider

**Ownership:** `sync-cita-to-zoom-v2` (new edge function, not yet implemented)

**Prerequisites:**
- Coach has Zoom account + API key stored in `usuarios.configuracion.zoom_*`
- Zoom Client ID + Client Secret in Supabase secrets
- `refresh_token` for Zoom OAuth

**Input:** Same as Google Meet

**Process:**
```
1. Load coach Zoom credentials
2. Call Zoom "Create Meeting" API
3. Return meeting_url
```

**Output:**
```typescript
{
  ok: true,
  provider_url: "https://zoom.us/j/123456789",
  event_id: "123456789",  // meeting ID
  provider: "zoom",
}
```

---

### 3.3 Pathway Room Provider

**Ownership:** `generate-sala-token-v2` (new edge function, minimal)

**Input:**
```typescript
{
  cita_id: number,
  coach_id: uuid,
}
```

**Process:**
```
1. Generate JWT with cita_id + coach_id + expiry (24h)
2. Store token in citas.sala_token
3. Build sala.html URL with token
4. Immediate success (no external API)
```

**Output:**
```typescript
{
  ok: true,
  provider_url: "https://pathwaycareercoach.com/sala.html?token=eyJxx...",
  event_id: null,  // no external event
  provider: "pathway_room",
}
```

**Advantages:**
- Always available (no external dependency)
- Fast (no API calls)
- No OAuth needed
- Coach has full control

---

## 4. PROVIDER SELECTION LOGIC

### 4.1 Decision Tree

```
IF coach.config.zoom_url AND Zoom_credentials_valid:
  TRY Zoom
  IF fails → TRY Google Meet
  IF fails → USE Pathway Room
ELSE IF coach.config.gcal (Google connected):
  TRY Google Meet
  IF fails (Gmail account) → USE Pathway Room
  IF fails (token revoked) → USE Pathway Room + notify coach
ELSE:
  USE Pathway Room (default)
```

### 4.2 Implementation Location

This logic lives in a new function: `select-provider-v2` (edge function)

Called by `reservar-v2.html` AFTER user confirms booking:

```typescript
// In reservar-v2.html, after INSERT cita succeeds:
fetch(SB + '/functions/v1/select-provider-v2', {
  method: 'POST',
  body: JSON.stringify({ cita_id }),
})
  .then(resp => {
    // Returns: { provider, provider_url, error? }
    // Frontend acknowledges receipt but doesn't use it
    // (cita.provider_url is canonical source of truth)
  });
```

---

## 5. TRANSACTIONAL GUARANTEES

### 5.1 Contract: Provider Sync Must Be Idempotent

**Problem in V1:** If sync is retried, events get duplicated in Google Calendar

**Solution in V2:**
1. Check if cita.google_event_id already exists (for Google Meet)
   - If yes, skip event creation; just fetch current state
2. Check if cita.provider_url already exists
   - If yes, don't retry; provider was already successfully created
3. Generate deterministic request IDs
   - Google: `requestId = "pathway-v2-" + cita_id + "-" + coach_id`
   - Zoom: Use cita_id as unique constraint

### 5.2 Contract: Email Must Read From Database

**Problem in V1:** Email HTML hardcoded in reservar.html; sent before sync completes

**Solution in V2:**

```typescript
// send-email NO LONGER accepts HTML from caller
// OLD:  postEmail({ html: "<a href='${joinLink}'>..." })
// NEW:  fetch('/functions/v1/send-email', { cita_id })

// send-email fetches cita + builds HTML:
const cita = await supabase
  .from('citas')
  .select('*, usuarios(nombre, email, configuracion)')
  .eq('id', citaId);

if (!cita.provider_url && cita.estado === 'confirmada') {
  // Provider still pending; retry this email later (max 5 attempts, 30s delay)
  return json({ ok: false, reason: 'provider_not_ready_yet' }, 202);
}

// Now build HTML with current provider_url from DB
const html = buildEmailHTML({
  cita,
  joinLink: cita.provider_url || null,
  provider: cita.provider,
});
```

This ensures email always matches what's in the database.

---

## 6. ERROR HANDLING & RETRY

### 6.1 Retriable vs Non-Retriable Errors

| Error | Retriable | Reason | Backoff |
|-------|-----------|--------|---------|
| Network timeout | YES | Transient | 2s, 4s, 8s |
| Gmail account not supported | NO | Architectural | None; suggest Workspace or Sala |
| Token revoked | NO | User action needed | None; notify coach |
| Zoom quota exceeded | YES | Temporary | 3600s (1 hour) |
| Google API rate limit | YES | Temporary | 60s |
| Supabase DB down | YES | Transient | 5s, 10s, 20s |

### 6.2 Retry Logic

```typescript
async function providerSync(citaId, provider, retryCount = 0) {
  try {
    const result = await callProvider(provider, cita);
    if (result.ok) {
      await supabase
        .from('citas')
        .update({
          provider_url: result.provider_url,
          provider_ready_at: new Date(),
          provider_retry_count: retryCount,
          provider_error: null,
        })
        .eq('id', citaId);
      return { ok: true };
    } else if (result.retriable) {
      const backoffMs = [2000, 4000, 8000, 16000][retryCount] || 60000;
      await scheduleRetry(citaId, backoffMs);
      return { ok: false, scheduled_retry: true };
    } else {
      // Non-retriable error; mark permanently failed
      await supabase
        .from('citas')
        .update({
          provider_error: result.error,
          provider_retry_count: retryCount,
        })
        .eq('id', citaId);
      return { ok: false, scheduled_retry: false };
    }
  } catch (e) {
    // Unknown error; treat as retriable
    if (retryCount < 3) {
      await scheduleRetry(citaId, 2000 * (retryCount + 1));
    } else {
      // Give up after 3 retries
      await supabase
        .from('citas')
        .update({
          provider_error: 'max_retries_exceeded',
          provider_retry_count: retryCount,
        })
        .eq('id', citaId);
    }
  }
}
```

---

## 7. EMAIL SERVICE (V2 CONTRACT)

### 7.1 New Signature

**OLD (V1):**
```typescript
fetch(SB + '/functions/v1/send-email', {
  body: JSON.stringify({
    to: email,
    subject: 'Tu sesión',
    html: '<p>Entra aquí: <a href="...">...</a></p>',  // caller builds HTML
    signature: 'none',
  }),
});
```

**NEW (V2):**
```typescript
fetch(SB + '/functions/v1/send-email-v2', {
  body: JSON.stringify({
    cita_id: number,
    recipient: 'client' | 'coach',  // determines template
    language: 'es' | 'en',
  }),
});
```

### 7.2 send-email-v2 Logic

```typescript
export async function sendEmailV2(citaId, recipient, language = 'es') {
  // 1. Fetch cita + coach + provider details
  const cita = await loadCitaWithCoach(citaId);
  
  // 2. If provider not ready, retry later
  if (!cita.provider_url && cita.estado === 'confirmada') {
    // Return 202 Accepted; caller retries in 30s
    return json({ retry_at: Date.now() + 30000 }, 202);
  }
  
  // 3. Build HTML based on provider type
  const providerLabel = {
    google_meet: 'Google Meet',
    zoom: 'Zoom',
    pathway_room: 'Sala Pathway',
    none: '(sin videollamada)',
  }[cita.provider];
  
  const html = renderTemplate('booking-confirmation', {
    client_name: cita.nombre,
    coach_name: cita.usuarios.nombre,
    session_time: formatTime(cita.inicio),
    provider: cita.provider,
    provider_label: providerLabel,
    provider_url: cita.provider_url,
    manage_url: buildManageLink(cita.token),
    language,
    recipient,  // 'client' or 'coach'
  });
  
  // 4. Send via Brevo
  return await breVoSend({
    to: recipient === 'client' ? cita.email : cita.usuarios.email,
    subject: `Tu sesión con ${cita.usuarios.nombre}`,
    html,
    signature: recipient === 'coach' ? 'pathway' : 'none',
  });
}
```

### 7.3 Email Templates

**Template: booking-confirmation-client-es.html**
```html
<p>Hola ${client_name},</p>
<p>Tu sesión con ${coach_name} está confirmada para ${session_time}.</p>

<a href="${provider_url}" class="btn">📹 Entrar a ${provider_label}</a>

<p>Si no puedes asistir: <a href="${manage_url}">cancelar o reprogramar</a></p>
```

**Template: booking-confirmation-coach-es.html**
```html
<p>Nueva reserva: ${client_name}</p>
<p>Cuándo: ${session_time}</p>
<p>Plataforma: ${provider_label}</p>

<a href="${provider_url}" class="btn">Entrar a ${provider_label}</a>
```

---

## 8. COACH PANEL (V2)

### 8.1 Booking List Changes

**OLD (V1):**
```
Nombre | Cuándo | Link
------|--------|-----
Juan  | Mie 3p | https://meet.google.com/...
```

**NEW (V2):**
```
Nombre | Cuándo | Plataforma | Acción
-------|--------|------------|-------
Juan   | Mie 3p | Google Meet | [Entrar]
María  | Jue 4p | Zoom        | [Entrar]
Carlos | Vie 5p | Sala        | [Preparando...] (retry if error)
Pedro  | Sab 2p | -           | [Error: revisar] (retry button)
```

### 8.2 States in UI

```javascript
if (cita.provider === 'none') {
  status = '(sin videollamada)';
  btn = null;
} else if (!cita.provider_url && !cita.provider_error) {
  status = 'Preparando...';
  btn = null;
  spinner = true;
} else if (cita.provider_url) {
  status = cita.provider;
  btn = <a href="${cita.provider_url}">Entrar</a>;
} else if (cita.provider_error) {
  status = 'Error';
  btn = <button onclick="retryProvider(${cita.id})">Reintentar</button>;
}
```

---

## 9. CLIENT PORTAL (V2)

### 9.1 Session Access

**OLD (V1):**
- Client sees hardcoded "Video call link coming soon" if Google Meet failed

**NEW (V2):**
- Client sees current `provider_url` from database
- If not ready: "Sala está en preparación. Te avisaremos cuando esté lista."
- If error: "Hubo un problema. Contactá a ${coach_name}."

---

## 10. SALA PATHWAY INTEGRATION

### 10.1 Role in V2

- **Default provider** when Google Meet / Zoom unavailable
- **Explicit choice** if coach prefers it
- **Fallback** for error cases
- Secure token validation (existing implementation ✅)

### 10.2 Session Tracking (Future)

```sql
CREATE TABLE IF NOT EXISTS sesiones_registro (
  id BIGSERIAL PRIMARY KEY,
  cita_id BIGINT,
  coach_id UUID,
  sala_token TEXT,
  client_entered_at TIMESTAMPTZ,
  coach_entered_at TIMESTAMPTZ,
  client_left_at TIMESTAMPTZ,
  coach_left_at TIMESTAMPTZ,
  duration_minutes INT,
  creada_at TIMESTAMPTZ DEFAULT now()
);
```

**Why track?**
- Coach portfolio: "1,234 hours of coaching delivered"
- Client portal: "You've completed 5 sessions"
- Coach analytics: "Average session: 45 minutes"
- Optional recording (if 8x8 supports it)

---

## 11. MULTICOACH READ-ONLY INTEGRATION

### 11.1 Constraints

Agenda V2 must NOT:
- Create new tables that multicoach can't access
- Add hard dependencies on multicoach workflows
- Assume multicoach scheduling format

### 11.2 Compatibility

- `citas` table stays flat (single coach per booking)
- If multicoach needs to query across coaches: use view or SQL union
- Provider selection is coach-specific (per coach OAuth config)
- No schema breaking changes

### 11.3 Future Opportunity

When multicoach needs to sync bookings:
- Pull `citas.provider_url` (already canonical)
- No need for separate Meet link sync
- Bookings already have provider info

---

## 12. ZERO-DOWNTIME MIGRATION PLAN

### Phase 1: Deploy V2 code (3 days)
- New edge functions: `select-provider-v2`, `sync-cita-to-gcal-v2`, `send-email-v2`
- New columns in `citas` table
- V1 continues unchanged

### Phase 2: Soft Launch (1 day)
- `reservar-v2.html` deployed (not linked anywhere)
- Internal testing only
- `?agenda=v2` query param activates V2 flow

### Phase 3: Provider Testing (1 week)
- Real coaches + clients test with all 3 providers
- Collect metrics: success rate, speed, error types

### Phase 4: Gradual Rollout (1 week)
- 10% of new bookings → V2
- Monitor error rate
- Rollback plan ready

### Phase 5: Full Cutover (1 week)
- 100% of new bookings → V2
- Keep V1 reading `meet_link` for backward compat
- Sunset V1 after 30 days (legacy data migration)

### Rollback Procedure
```
IF issues detected:
  1. Redirect ?agenda=v2 bookings back to V1 (reservar.html)
  2. Keep new citas columns (no schema rollback needed)
  3. V1 ignores new columns; continues with meet_link field
  4. Rollback time: < 1 minute (config change only)
```

---

## 13. SCHEMA LOCK

| Table | New Columns | Impact | Locked? |
|-------|-------------|--------|---------|
| citas | provider, provider_url, provider_ready_at, provider_error, provider_retry_count, sala_token | V1 ignores; nullable | ✅ LOCKED |
| sesiones_registro | (no changes to core) | (future session tracking) | (after V1 cutover) |
| usuarios | (no changes) | V1/V2 both read google/zoom config | ✅ LOCKED |

**Locking rationale:**
- Minimal schema additions
- All new columns nullable → V1 compatible
- Reduces risk of data corruption
- Easier to test before full rollout

---

## 14. FINAL CHECKLIST: V2 MODEL READY?

- [x] Data model defined (provider, provider_url, state tracking)
- [x] State machine documented (lifecycle, ownership, transitions)
- [x] Provider interface specified (Google Meet, Zoom, Sala)
- [x] Selection logic outlined (decision tree)
- [x] Transactional contract finalized (idempotence, email from DB)
- [x] Error handling + retry strategy
- [x] Email service rewritten (reads cita.provider_url)
- [x] Coach panel UI updates sketched
- [x] Client portal updates sketched
- [x] Sala integration plan (first-class provider)
- [x] MultiCoach read-only constraints confirmed
- [x] Zero-downtime migration defined (5 phases)
- [x] Rollback procedure clear (< 1 minute)
- [x] Schema locked (minimal changes, all nullable)

**Status:** ✅ **READY FOR IMPLEMENTATION** (pending user approval)

---

## NEXT DOCUMENTS

1. ✅ `GOOGLE-MEET-ROOT-CAUSE-REPORT.md` (Gmail account root cause)
2. ✅ `V1-AUDIT-REPORT.md` (what to keep/change/drop)
3. ✅ `AGENDA-V2-FINAL-MODEL.md` (this document)
4. ⏳ `SALA-PATHWAY-VIABILITY-REPORT.md` (real-world testing)
5. ⏳ Test scenario matrix (10+ scenarios with success criteria)

When all 5 are complete → FASE 0 FINISHED → Ready for implementation decision
