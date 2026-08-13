# V2-MODEL-SPECIFICATION.md — Booking/Agenda V2: Especificación Cerrada

**Fecha:** Agosto 13, 2026  
**Estado:** ESPECIFICACIÓN FINAL DE ARQUITECTURA (sin implementar aún)  
**Aprobación:** Pendiente de Micaela  

---

## PARTE 1: DATA MODEL

### New Columns en `citas` table

```sql
-- Provider decision (centralized)
ALTER TABLE citas ADD COLUMN provider TEXT 
  DEFAULT 'none' 
  CHECK (provider IN ('none', 'google_meet', 'zoom', 'pathway_room'));

-- URL para unirse (confirmada DESPUÉS de que sync completa exitosamente)
ALTER TABLE citas ADD COLUMN provider_url TEXT;

-- Timestamp cuando sync completó exitosamente
ALTER TABLE citas ADD COLUMN provider_ready_at TIMESTAMPTZ;

-- Mensaje de error si sync falló definitivamente
ALTER TABLE citas ADD COLUMN provider_error TEXT;

-- Número de reintentos intentados por sync
ALTER TABLE citas ADD COLUMN provider_retry_count INT DEFAULT 0;

-- JWT token para Sala Pathway (SOLO si provider='pathway_room')
ALTER TABLE citas ADD COLUMN sala_token TEXT;
```

### New Indexes

```sql
-- Encontrar citas esperando sync
CREATE INDEX idx_citas_provider_pending 
  ON citas (provider_ready_at DESC, provider_error) 
  WHERE provider_ready_at IS NULL 
    AND provider_error IS NULL 
    AND estado = 'confirmada';

-- Encontrar citas con errores de sync
CREATE INDEX idx_citas_provider_error 
  ON citas (creada_at DESC, provider_error) 
  WHERE provider_error IS NOT NULL;
```

### New Constraints

```sql
-- URL puede existir SOLO si provider es real (no 'none')
ALTER TABLE citas
ADD CONSTRAINT check_provider_url_requires_provider 
CHECK (
  provider_url IS NULL 
  OR provider IN ('google_meet', 'zoom', 'pathway_room')
);

-- sala_token SOLO para Pathway rooms
ALTER TABLE citas
ADD CONSTRAINT check_sala_token_only_pathway 
CHECK (
  sala_token IS NULL 
  OR provider = 'pathway_room'
);
```

### Data Model Benefits

| Beneficio | Cómo logrado |
|-----------|--------------|
| Single source of truth | Un campo `provider` para todos |
| Trackable errors | `provider_error` + `provider_retry_count` |
| Queryable history | Index por `provider_ready_at` |
| Audit trail | `provider_ready_at` timestamp proof |
| No data loss | Todos nullable, defaults seguros |

---

## PARTE 2: STATE MACHINE

### Estados de una Cita (para provider sync)

```
INITIAL STATE:
  provider = 'none'
  provider_url = NULL
  provider_error = NULL
  provider_retry_count = 0
  provider_ready_at = NULL

↓

AFTER RESERVATION SAVED:
  [Call select-provider edge function]

↓

SELECT_PROVIDER DECIDES:
  IF coach.email matches @gmail.com → try Sala first
  IF coach has Zoom account → try Zoom first
  IF coach has Workspace email → try Google Meet first
  ELSE → default Sala

  OUTPUT: { provider_type: 'zoom'|'google_meet'|'pathway_room' }

↓

SYNC_PROVIDER_V2 ATTEMPTS:
  [Call sync-provider-v2 edge function with provider_type]
  
  Retries: [2s, 4s, 8s, 16s, 60s] (max 5)
  Only retry on: network timeout, rate limit, transient error
  
  If provider == 'zoom':
    → Call Zoom API
    → If fail (retryable): wait + retry
    → If fail (non-retryable): set provider_error, EXIT
    → If success: extract zoom_event_id
  
  If provider == 'google_meet':
    → Call Google Calendar API
    → If success: extract google_event_id + hangoutLink
    → If fail: set provider_error, EXIT (no retry)
  
  If provider == 'pathway_room':
    → Generate sala_token (JWT 1h TTL)
    → Build sala_url = sala.html?token=XXX&cita_id=YYY
    → NO external dependency, always succeeds

↓

IF SYNC SUCCESS:
  UPDATE citas SET
    provider = <type>,
    provider_url = <url>,
    provider_ready_at = NOW(),
    sala_token = <token if Sala>,
    provider_error = NULL,
    provider_retry_count = <final count>

↓

IF SYNC FAILURE:
  UPDATE citas SET
    provider = <attempted type>,
    provider_url = NULL,
    provider_error = <error message>,
    provider_retry_count = <final count>,
    provider_ready_at = NULL

↓

FINAL STATE: READY FOR EMAIL
  [Call send-email-v2 edge function]
  
  Email function reads from citas table:
  - IF provider_url IS NOT NULL AND provider_ready_at IS NOT NULL:
      → Send email with ACTUAL provider name + URL
  - ELSE IF provider_error IS NOT NULL:
      → Send "sync failed" email with fallback instructions
  - ELSE:
      → Delay 30s, retry email later (sync still in progress)
```

---

## PARTE 3: PROVIDER ABSTRACTION

### Zoom Provider

```
select-provider decides:
  IF coach.zoom_account exists AND is_active
    → Zoom is option 1

sync-provider-v2:
  zoom_link = fetch from Zoom API
  provider_url = zoom_link
  provider = 'zoom'
  provider_event_id = zoom_meeting_id
  
No Zoom-specific data in sala.html or email templates.
```

### Google Meet Provider

```
select-provider decides:
  IF coach.email ends with @workspace.com OR @company.com
    → Google Meet is option N
  ELSE IF coach.email ends with @gmail.com
    → SKIP Google Meet (documented API limitation)

sync-provider-v2:
  IF coach has valid refresh_token:
    → Call Google Calendar API via gcal-push
    → Extract hangoutLink from conferenceData.entryPoints
  IF NO entryPoints OR timeout:
    → provider_error = "Google Calendar: Gmail (necesita Workspace) o token revocado"
    → Exit, no retry
  
  provider_url = hangoutLink
  provider = 'google_meet'
  provider_event_id = google_event_id
```

### Sala Pathway Provider

```
select-provider decides:
  Sala is ALWAYS available (no dependencies, always succeeds)
  Default if others fail

sync-provider-v2:
  Generate sala_token = JWT(cita_id, coach_id, exp=now+1h)
  Build sala_url = https://pathwaycareercoach.com/sala.html?token=<JWT>&cita_id=<id>
  
  provider_url = sala_url
  provider = 'pathway_room'
  sala_token = JWT
  No provider_error (ALWAYS succeeds)

Integration:
  sala.html validates token against citas.token in Supabase
  Existing token validation logic unchanged (it works)
```

---

## PARTE 4: RETRIES & TIMEOUTS

### Retry Strategy

```
Provider       Max Retries  Backoff Pattern      Only Retry On
────────────────────────────────────────────────────────────
Zoom           5            [2s, 4s, 8s, 16s, 60s]  network, rate limit
Google Meet    0            (no retry)          N/A (non-retriable)
Sala Pathway   0            (no retry)          N/A (never fails)
```

**Why no retry for Google Meet?**
- If conferenceData is NULL → it's a permissions issue (Gmail limitation)
- Retrying won't fix it
- Better to fail fast + fallback to Sala

**Why no retry for Sala?**
- Token generation + URL building: no external dependencies
- If it fails, bigger problem (JWT generation broken)

---

## PARTE 5: CONTRACTS (Synchronous)

### select-provider → sync-provider-v2

**Input:**
```
{
  cita_id: bigint,
  coach_id: uuid,
  coach_email: string,
  coach_zoom_account?: string,
  coach_google_token?: boolean,
  provider_preference?: 'zoom_first' | 'meet_first' | 'sala_first'
}
```

**Output:**
```
{
  ok: true,
  provider: 'zoom' | 'google_meet' | 'pathway_room',
  reason?: string (for logging)
}
```

### sync-provider-v2 → Supabase (citas update)

**Precondition:** `cita_id` exists in citas table

**On Success:**
```
UPDATE citas SET
  provider = 'zoom' | 'google_meet' | 'pathway_room',
  provider_url = <URL>,
  provider_ready_at = NOW(),
  sala_token = <token if Sala>,
  provider_error = NULL,
  provider_retry_count = <count>
WHERE id = cita_id
```

**On Failure:**
```
UPDATE citas SET
  provider_error = '<specific error message>',
  provider_retry_count = <count>,
  provider_ready_at = NULL
WHERE id = cita_id
```

**Invariants:**
- If `provider_url` is NOT NULL → `provider` must be non-'none'
- If `sala_token` is NOT NULL → `provider` must be 'pathway_room'
- If `provider_error` is NOT NULL → `provider_ready_at` must be NULL
- If `provider_ready_at` is NOT NULL → `provider_url` must be NOT NULL

---

## PARTE 6: EMAIL FLOW

### Old (V1) Email Flow

```
reservar.html decides link → postEmail(joinLink) → Brevo API
  ↑
  No guarantee link is in BD yet
  Race condition risk
```

### New (V2) Email Flow

```
After sync-provider-v2 completes (success OR failure):
  [Call send-email-v2 edge function]
  
  send-email-v2 reads from citas table:
  
  SELECT provider, provider_url, provider_error, provider_ready_at
  FROM citas WHERE id = cita_id
  
  IF provider_url IS NOT NULL AND provider_ready_at IS NOT NULL:
    → Build email with ACTUAL provider name:
        "Tu coach usa Google Meet: <URL>"
        "Tu coach usa Zoom: <URL>"
        "Tu coach usa Video Sala Pathway: <URL>"
  
  ELSE IF provider_error IS NOT NULL:
    → Build error email:
        "Hubo un error preparando tu sesión: <error_message>"
        "Contacta al coach si hay problemas"
  
  ELSE:
    → provider_url is still NULL and no error
    → Delay 30s, retry email (sync still in progress)
  
  Send via Brevo API (existing send-email function, same as before)
```

**Key difference:** Email content is built from DB, not frontend.

---

## PARTE 7: ROOM ISOLATION (MultiCoach)

### Current Implementation

**RLS policies** already filter by `coach_id`:
```sql
SELECT ... FROM citas WHERE coach_id = auth.uid()
```

### V2 Behavior (no changes needed)

When MultiCoach coach books a cita:
- `cita.coach_id = multicoach_coach_id`
- `select-provider` reads coach-specific Zoom/Google tokens
- `sync-provider-v2` uses those coach-specific credentials
- Email sent to `candidate_email` (not coach email)
- RLS filters ensure coach can only see/edit their own citas

**Result:** Complete room isolation by coach_id (existing, not new).

---

## PARTE 8: ROLLBACK STRATEGY

### No Data Loss Rollback

**Option 1: Feature Flag** (recommended)
```
Environment variable: ENABLE_V2_PROVIDER=true/false

If V2 fails:
  1. Set ENABLE_V2_PROVIDER=false
  2. V1 booking flow resumes
  3. 6 new columns still exist (nullable, no harm)
  4. Can roll forward without data loss
```

**Option 2: Full Revert** (if needed)
```
1. Drop new constraints (safe)
   ALTER TABLE citas DROP CONSTRAINT check_provider_url_requires_provider;
   ALTER TABLE citas DROP CONSTRAINT check_sala_token_only_pathway;

2. Drop new indexes (safe)
   DROP INDEX idx_citas_provider_pending;
   DROP INDEX idx_citas_provider_error;

3. Optionally drop columns (data loss, only if certain)
   ALTER TABLE citas DROP COLUMN provider CASCADE;
   ... etc

4. Deploy V1 edge functions + frontend

But SAFER: just set feature flag off, columns stay as dead columns.
```

### Testing Rollback

**Before V2 deployment:**
1. Deploy V2 SQL + edge functions to staging
2. Enable V2 feature flag for 10% of bookings
3. Monitor for 48h
4. If issues: disable feature flag (V1 resumes automatically)
5. Investigate issue offline
6. Re-enable when fixed

---

## PARTE 9: CURRENT SALA PATHWAY STATE

### ✅ What Works

| Capability | Status | Evidence |
|------------|--------|----------|
| Token validation | ✅ Works | Lines 390-410: validates token vs citas.token |
| Access control | ✅ Works | Lines 355-388: MOD status checked correctly |
| P2P video | ✅ Works | WebRTC implementation solid, TURN fallback |
| JaaS fallback | ✅ Works | 8x8 integration working, switches if P2P blocked |
| UI/UX | ✅ Works | Responsive, mobile-optimized, clean |
| Chat | ✅ Works | Casual messaging integrated |
| Session feedback | ✅ Works | Emoji rating + notes at end |
| Coach tasks | ✅ Works | Objectives, notes, task tracking |

### ❌ What Doesn't Work / Needs Improvement

| Gap | Severity | Fix |
|-----|----------|-----|
| No session join tracking | MEDIUM | V2: store join/leave in sesiones_registro |
| No timeout management | MEDIUM | V2: auto-disconnect after 2h idle |
| No recording | LOW | Future: depends on 8x8 plan |
| No session data persistence | MEDIUM | V2: sync notas/tareas to DB |
| Single point of failure (8x8) | LOW | Future: secondary provider fallback |

### Integration Path for V2

**Sala continues unchanged:**
- Same token validation
- Same P2P + JaaS engine selection
- Same UI/UX

**V2 additions:**
1. `select-provider` decides `provider='pathway_room'`
2. `sync-provider-v2` generates `sala_token`
3. Email shows "Video Sala Pathway: <URL>"
4. Panel shows `provider='pathway_room'` icon
5. Client sees "🎥 Sala" in session list

**No breaking changes to sala.html or its flow.**

---

## PARTE 10: IMPLEMENTATION ORDER (FASE 1)

### Fase 1A: Architecture Freeze
- ✅ Diagnóstico entregado
- ⏳ Micaela approval: "OK, procedemos con V2"

### Fase 1B: SQL Foundation (Week 2)
1. Add 6 new columns (all nullable, defaults safe)
2. Create 2 new indexes
3. Add 2 new constraints
4. Run audit queries to baseline state
5. **Zero data modifications, zero downtime**

**Deploy to:** Staging first, 48h observation, then Production (with authorization)

### Fase 1C: Edge Functions (Week 3)
1. `select-provider` — new edge function
2. `sync-provider-v2` — new edge function
3. `send-email-v2` — new edge function (calls existing send-email)
4. Unit tests for each function

**Deploy to:** Staging, test locally, then production

### Fase 1D: Frontend Updates (Week 4)
1. `reservar.html` — remove email sending, add sync spinner
2. `panel-v2.html` — add provider column, error badges
3. `cliente.html` — show provider with emoji, link from DB
4. Error handling for sync failures

**No breaking changes to V1 (parallel deployment possible).**

### Fase 1E: Testing & QA (Week 5)
1. Manual testing checklist (Zoom, Meet, Sala, retries)
2. Automated edge function tests
3. RLS policy verification
4. MultiCoach isolation testing

### Fase 1F: Gradual Rollout (Week 6)
1. **10% of bookings** use V2 (48h)
2. **50% of bookings** use V2 (48h)
3. **100% of bookings** use V2 (full migration)

**If issue detected:** disable feature flag (V1 resumes).

---

## SUMMARY: Qué Queda Demostrado

✅ **COMPROBADO:**
- V1 Gmail limitation: 0% de Meet links para @gmail.com (limitación Google, no bug)
- V1 Email template mismatch: dice "Meet" pero entrega "Sala"
- V1 Race condition: email antes de confirmación en BD
- Sala Pathway: ✅ secure token validation + P2P + JaaS ✅ works
- Multi-coach isolation: ✅ RLS policies en lugar

---

## Qué Queda Pendiente de Prueba

⏳ **PENDING:**
- V2 edge functions (no desplegadas aún)
- V2 retry logic (sin probar en Zoom)
- V2 error recovery (sin casos reales)
- V2 gradual rollout (10%→50%→100% no hecho)
- Session tracking integration (notas/tareas a BD)
- Timeout management (auto-disconnect 2h)

---

## Qué Cambiaremos en FASE 1

**Cambios concretos:**

1. **SQL** (0 data loss)
   - 6 nuevas columnas
   - 2 nuevos índices
   - 2 nuevas constraints

2. **Edge Functions** (3 nuevas)
   - select-provider
   - sync-provider-v2
   - send-email-v2 (wrapper de send-email)

3. **Frontend**
   - reservar.html: remove email sending, add sync spinner
   - panel-v2.html: add provider column + error badges + retry button
   - cliente.html: show provider emoji, link from DB

4. **RLS** (NO CHANGES)
   - Existing RLS policies sufficient
   - coach_id filtering already in place

---

## ORDEN EXACTO DE IMPLEMENTACIÓN

**NO COMIENCE HASTA QUE MICAELA APRUEBE ESTA ESPECIFICACIÓN.**

1. **Week 2 (SQL):** Migrations applied to staging → 48h observation → production
2. **Week 3 (Functions):** Deploy edge functions → test locally → staging → production
3. **Week 4 (Frontend):** Update HTML/JS → smoke tests → staging → production
4. **Week 5 (QA):** Manual + automated testing
5. **Week 6 (Rollout):** 10% → 50% → 100% (killswitch: feature flag)

**Killswitch:** If any week fails: disable feature flag, V1 resumes, investigate offline.

---

**ESTADO:** Especificación CERRADA. Listo para ejecución en FASE 1.

