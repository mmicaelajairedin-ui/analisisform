# FASE 1A — EXECUTION PLAN (Internal Validation)

**Responsable:** Micaela + QA tester  
**Duración:** Week 1-2 (Sept 3-14)  
**Goal:** Validar V2 backend + Sala Pathway internamente ANTES de Phase 1B  
**Gate:** Todos los tests PASS o documentados → PHASE 1B con coaches reales

---

## PARTE 1: SETUP (Sept 3-4)

### Paso 1: Clonar rama + instalar

```bash
git fetch origin claude/pathway-booking-root-cause-ely53m
git checkout claude/pathway-booking-root-cause-ely53m
git pull
```

### Paso 2: Aplicar SQL migration en Supabase STAGING

```bash
# Verificar que estamos en staging (NO producción)
echo $SUPABASE_URL  # Debe ser https://staging-...supabase.co

# Aplicar migration
supabase db push

# Verificar columnas creadas
supabase db execute -- \
  "SELECT column_name FROM information_schema.columns \
   WHERE table_name='citas' AND column_name IN ('provider','provider_url','provider_ready_at','provider_error','provider_retry_count','sala_token')"

# Output esperado: 6 rows (provider, provider_url, provider_ready_at, provider_error, provider_retry_count, sala_token)
```

### Paso 3: Deploy edge functions en STAGING

```bash
# Verificar entorno staging
supabase functions list  # No debe mostrar functions V2 aún

# Deploy
supabase functions deploy select-provider --no-verify-jwt
supabase functions deploy sync-provider-v2 --no-verify-jwt
supabase functions deploy send-email-v2 --no-verify-jwt

# Verificar
supabase functions list | grep -E 'select-provider|sync-provider-v2|send-email-v2'
# Output esperado: 3 rows
```

### Paso 4: Configurar variables de entorno

```bash
# En Supabase dashboard → Project Settings → Edge Functions → Secrets:
# Agregar (si no existen):
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REFRESH_TOKEN=...  (del coach que vamos a testear)
ZOOM_API_KEY=...  (si aplica)
EMAILJS_SERVICE_ID=...
EMAILJS_TEMPLATE_ID_V2=...  (o usar EMAILJS_TEMPLATE_ID si existe)
SALA_BASE_URL=https://pathwaycareercoach.com
```

### Paso 5: Crear usuario test

```sql
-- En SQL Editor de Supabase (staging):
-- Crear coach test con Google token (Workspace, no Gmail personal)

INSERT INTO usuarios (email, password_hash, nombre, rol, google_refresh_token)
VALUES (
  'test-coach@workspace.com',
  'sha256_hash_of_pwd',
  'Test Coach',
  'coach',
  'GOOGLE_REFRESH_TOKEN_FROM_WORKSPACE_ACCOUNT'
);

-- Copiar el usuario ID para tests
-- Ej: coach_id = 'abc123def456'
```

---

## PARTE 2: TEST MATRIX FASE 1A (Sept 5-7)

### Test 1: Provider Selection (select-provider)

**Goal:** Verificar que select-provider decide el provider correcto

**Steps:**

```bash
# Crear una cita con el coach test
curl -X POST https://staging-xxx.supabase.co/rest/v1/citas \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "titulo": "TEST: Provider Selection",
    "fecha": "2026-09-10T15:00:00Z",
    "coach_id": "abc123def456",
    "cliente_email": "test@example.com",
    "estado": "confirmada",
    "provider": "none"
  }'

# Guardar el cita_id que se retorna

# Ejecutar select-provider manualmente (o esperar webhook)
curl -X POST https://staging-xxx.supabase.co/functions/v1/select-provider \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "cita_id": "CITA_ID",
    "coach_id": "abc123def456"
  }'

# Respuesta esperada:
# { "ok": true, "provider": "google_meet", "reason": "Google Workspace token valid" }

# Verificar en DB:
curl https://staging-xxx.supabase.co/rest/v1/citas?id=eq.CITA_ID \
  -H "Authorization: Bearer $JWT_TOKEN" \
  | jq '.[] | {provider, provider_url, provider_error}'

# Esperado: { "provider": "google_meet", "provider_url": null, "provider_error": null }
```

**Pass Criteria:**
- ✅ select-provider retorna provider != "none"
- ✅ DB cita.provider actualizado
- ✅ Sin error

**Fail → Blocker:** Si provider='none' o error, investigar:
- ¿Coach token válido? (verificar google_refresh_token en DB)
- ¿¿Email del coach es Workspace (no @gmail.com)? 
- ¿Supabase secrets configurados?

---

### Test 2: Provider Sync (sync-provider-v2)

**Goal:** Verificar que sync-provider-v2 obtiene URL correctamente

**Steps:**

```bash
# Ejecutar sync-provider-v2 para la cita anterior
curl -X POST https://staging-xxx.supabase.co/functions/v1/sync-provider-v2 \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "cita_id": "CITA_ID",
    "coach_id": "abc123def456",
    "provider": "google_meet"
  }'

# Respuesta esperada:
# { "ok": true, "provider_url": "https://meet.google.com/..." }

# Verificar en DB:
curl https://staging-xxx.supabase.co/rest/v1/citas?id=eq.CITA_ID \
  -H "Authorization: Bearer $JWT_TOKEN" \
  | jq '.[] | {provider_url, provider_ready_at, provider_error}'

# Esperado: { "provider_url": "https://meet.google.com/...", "provider_ready_at": "2026-09-05T...", "provider_error": null }
```

**Pass Criteria:**
- ✅ provider_url populated
- ✅ provider_ready_at set
- ✅ provider_error NULL
- ✅ URL es válida (starts with https://meet.google.com)

**Fail → Blocker:** Si URL no generada:
- ¿Google Calendar API respondiendo?
- ¿Workspace account tiene permisos?
- Check: Supabase edge function logs → `supabase functions logs sync-provider-v2`

---

### Test 3: Email Sending (send-email-v2)

**Goal:** Verificar que email se envía con provider_url

**Steps:**

```bash
# Ejecutar send-email-v2
curl -X POST https://staging-xxx.supabase.co/functions/v1/send-email-v2 \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "cita_id": "CITA_ID",
    "coach_id": "abc123def456",
    "cliente_email": "test@example.com"
  }'

# Respuesta esperada:
# { "ok": true, "provider_url": "https://meet.google.com/...", "email_sent": true }

# Verificar email recibido:
# 1. Ir a inbox de test@example.com
# 2. Buscar email con subject "Cita confirmada: TEST: Provider Selection"
# 3. Verificar que contiene link a Google Meet (https://meet.google.com/...)
# 4. Verificar que HTML se construyó server-side (no frontend HTML)
```

**Pass Criteria:**
- ✅ Email recibido
- ✅ Link a Google Meet presente
- ✅ No errores 403/401 (auth OK)

**Fail → Blocker:** Si email no llega:
- ¿EmailJS service ID/token válido?
- Check logs: `supabase functions logs send-email-v2`
- ¿SMTP settings correctos?

---

### Test 4: Panel Display (panel-v2.html)

**Goal:** Verificar que panel muestra provider status

**Steps:**

```bash
# 1. Loguear en panel-v2.html como coach test
# 2. Ir a sección de Clientes
# 3. Buscar cita creada en Test 1
# 4. Verificar que muestra:
#    - ✅ Listo (Google Meet)
#    - 🎥 Entrar a la Videoconferencia [link]
#    - URL funciona (click → abre https://meet.google.com/...)

# Verificar en DevTools:
# 1. Console: debe mostrar "updateProviderStatus(CITA_ID)" sin errores
# 2. Network: GET /rest/v1/citas?... debe retornar provider_url
# 3. Elements: <div class="provider_status ready"> debe estar presente
```

**Pass Criteria:**
- ✅ Provider status visible
- ✅ Link funciona
- ✅ No console errors

**Fail:** Si no muestra status:
- ¿panel-v2.html tiene updateProviderStatus() function?
- ¿JWT token válido?
- Check console para errores

---

### Test 5: Cliente Portal Display (cliente.html)

**Goal:** Verificar que cliente ve sesión con provider link

**Steps:**

```bash
# 1. Loguear en cliente.html como cliente test (test@example.com)
# 2. Ir a "Tus Próximas Sesiones"
# 3. Buscar cita "TEST: Provider Selection"
# 4. Verificar que muestra:
#    - ✅ Videoconferencia lista (Google Meet)
#    - 🎥 Entrar [link]
#    - Botón cliqueable → abre Google Meet

# Verificar en DevTools:
# 1. Console: debe ejecutar renderSesiones() sin errores
# 2. Network: GET /rest/v1/citas?cliente_email=eq... debe retornar cita con provider_url
# 3. Elements: <div class="session_provider ready"> presente
```

**Pass Criteria:**
- ✅ Sesión lista mostrada
- ✅ Link a Google Meet funciona
- ✅ Sin console errors

---

### Test 6: Sala Pathway Provider (Fallback)

**Goal:** Verificar que Sala Pathway se usa si no hay Google/Zoom token

**Steps:**

```bash
# 1. Crear cita CON COACH QUE NO TIENE GOOGLE NI ZOOM TOKENS
# 2. Ejecutar select-provider
#    Respuesta esperada: { "ok": true, "provider": "pathway_room", ... }
# 3. Ejecutar sync-provider-v2
#    Respuesta esperada: { "ok": true, "provider_url": "https://pathwaycareercoach.com/sala.html", ... }
# 4. Verificar en panel-v2:
#    - 🚪 Entrar a la Sala (label diferente)
#    - Link a /sala.html
# 5. Verificar en cliente.html:
#    - 🚪 Entrar a la Sala
#    - Link cliqueable
```

**Pass Criteria:**
- ✅ Fallback a Sala Pathway funciona
- ✅ Panel y cliente portal muestran correctamente
- ✅ Sala link abre correctamente

---

### Test 7: Room Isolation (CRITICAL BLOCKER)

**Goal:** Verificar que dos salas simultáneas NO comparten audio/video

**Setup:** Micaela + QA tester, ambos con acceso a Sala

**Steps:**

```
SALA 1: Coach A + Client A
  → Generar room_id con token_A
  → Coach A entra a sala.html?room=room_A&token=token_A
  → Client A entra a sala.html?room=room_A&token=token_A

SALA 2: Coach B + Client B (SIMULTÁNEAMENTE)
  → Generar room_id con token_B (DIFERENTE)
  → Coach B entra a sala.html?room=room_B&token=token_B
  → Client B entra a sala.html?room=room_B&token=token_B

VERIFICACIÓN:
1. Coach A speaks "Hola soy Coach A"
   → Client A hears "Hola soy Coach A" ✓
   → Coach B does NOT hear Coach A ✓
   → Client B does NOT hear Coach A ✓

2. Coach B speaks "Hola soy Coach B"
   → Client B hears "Hola soy Coach B" ✓
   → Coach A does NOT hear Coach B ✓
   → Client A does NOT hear Coach B ✓

3. Check participant list:
   → Sala 1 shows: [Coach A, Client A] ✓
   → Sala 2 shows: [Coach B, Client B] ✓
   → No cross-contamination ✓

4. Chat isolation:
   → Sala 1 chat: Client A messages invisible in Sala 2 ✓
   → Sala 2 chat: Coach B messages invisible in Sala 1 ✓
```

**Equipment needed:**
- 2 computers (Micaela + QA tester)
- Headphones (verify no audio cross-talk via speakers)
- Screen recording (for evidence)

**Pass Criteria (BLOCKER IF FAILS):**
- ✅ Audio isolated
- ✅ Video isolated
- ✅ Participant lists separate
- ✅ Chat separate

**FAIL = DO NOT PROCEED:** Si falla aislamiento:
- 🛑 BLOCKER: Investigate sala.html token validation
- 🛑 Check: cita.sala_token stored correctly?
- 🛑 Check: WebRTC P2P using correct room ID?
- 🛑 STOP Phase 1A, escalate to tech lead

---

### Test 8: Audio Quality

**Goal:** Verify audio is clear and low-latency

**Setup:** Coach + Client, both with microphones/speakers

**Steps:**

```
1. Coach speaks: "Prueba de audio, uno dos tres cuatro cinco"
   → Client listens for clarity
   → Measurement: DevTools → WebRTC stats → round-trip time (RTT)

2. Check: RTT < 300ms (latency acceptable)
3. Check: No echo detected
4. Check: No packet loss > 1% (DevTools → RTT, packet loss stats)
5. Check: Audio not cutting out

Success: Clear audio, RTT <300ms, no echo, no dropouts
Fail: If audio unintelligible or RTT >500ms → document as HIGH (network issue)
```

**Pass Criteria:**
- ✅ Speech intelligible
- ✅ RTT < 300ms
- ✅ No echo
- ✅ No packet loss > 1%

---

### Test 9: Video Quality

**Goal:** Verify video is smooth and clear

**Setup:** Coach + Client with cameras, good lighting

**Steps:**

```
1. Coach enables video
   → Client sees coach's face within 2s
   → Check resolution: >= 320x240 (mobile) or 640x480 (desktop)
   → Check FPS: >= 15 fps (DevTools → WebRTC stats)

2. Coach moves quickly (hand wave)
   → Video smooth, no pixelation
   → No freezes > 1 second

3. Check color accuracy
   → Skin tones look natural
   → No green/blue distortion

Success: >= 15 fps, <150ms latency, natural colors
Fail: If fps < 10 or video frozen → document as HIGH
```

**Pass Criteria:**
- ✅ Video appears within 2s
- ✅ FPS >= 15
- ✅ Natural colors
- ✅ No stutter

---

### Test 10: Mobile (Android on 4G)

**Goal:** Verify works on mobile 4G

**Setup:** QA tester on Android phone with 4G enabled

**Steps:**

```
1. Open sala.html on mobile Chrome
   → Page loads within 3s
   → Permissions dialog appears

2. Allow microphone + camera
   → WebRTC starts
   → Coach (desktop) sees mobile video within 5s

3. Audio: Coach speaks, mobile client hears
   → RTT < 300ms acceptable
   → Battery drain < 10%/min

4. Video: Enable camera
   → Desktop coach sees mobile video
   → FPS >= 15

Success: Loads <3s, audio/video work, battery <10%/min
Fail: If load >5s or battery drain >15%/min → document as HIGH
```

**Pass Criteria:**
- ✅ Page load < 3s
- ✅ Audio/video work
- ✅ Battery drain < 10%/min

---

### Test 11: iOS Safari

**Goal:** Verify works on iPhone Safari

**Setup:** QA tester on iPhone with Safari (iOS 14+)

**Steps:**

```
1. Open sala.html on Safari on iPhone
   → Page loads
   → Permissions dialog appears

2. Allow microphone + camera
   → WebRTC starts
   → Coach (desktop) sees iPhone video within 5s
   → NOTE: Video may be lower fps (H.264 codec limitation)

3. Audio works, chat works, screen share visible

Success: Connects, audio/video work
Known Limitation: Video may be lower fps than desktop (H.264 only)
Fail: If CRASH or complete video failure → BLOCKER

Documentation: "Video fps may be lower on iOS Safari; use desktop Chrome for high-motion sessions"
```

**Pass Criteria:**
- ✅ Connects
- ✅ Audio works
- ✅ Video appears (even if lower fps)
- ✅ No crash
- ✅ Document iOS limitation

---

### Test 12: Chat & Screen Share

**Goal:** Verify chat messages and screen share

**Steps:**

```
Chat:
1. Coach types: "¿Cómo te sientes?"
   → Client receives within 2s
   → Message order preserved

2. Client replies: "Bien, gracias"
   → Coach receives within 2s

Success: Messages <2s, order preserved
Fail: If messages >5s or order wrong → BLOCKER

Screen Share:
1. Coach clicks "Share screen"
   → Browser dialog appears
   → Select "Entire screen"

2. Screen appears on client within 2s
   → Text readable
   → No lag > 150ms

3. Coach moves mouse
   → Client sees movement instantly
   → No freezing

Success: Screen crisp, synchronized
Fail: If lag >500ms or freezes → HIGH
```

**Pass Criteria:**
- ✅ Chat < 2s
- ✅ Order preserved
- ✅ Screen share < 2s
- ✅ No lag

---

## PARTE 3: GATE (Sept 10-14)

### Friday Decision: Go/No-Go to Phase 1B

**Compile Results:**

| Test # | Name | Result | Issue? | Blocker? |
|--------|------|--------|--------|----------|
| 1 | Provider Selection | PASS | — | ✓ |
| 2 | Provider Sync | PASS | — | ✓ |
| 3 | Email Sending | PASS | — | ✓ |
| 4 | Panel Display | PASS | — | ✓ |
| 5 | Cliente Portal | PASS | — | ✓ |
| 6 | Sala Fallback | PASS | — | ✓ |
| 7 | **Room Isolation** | **PASS** | **—** | **🛑 CRITICAL** |
| 8 | Audio Quality | PASS | High RTT on 4G | ⚠️ Document |
| 9 | Video Quality | PASS | — | ✓ |
| 10 | Mobile (Android) | PASS | — | ✓ |
| 11 | iOS Safari | PASS | Lower fps (known) | ⚠️ Document |
| 12 | Chat & Screen Share | PASS | — | ✓ |

### Decision Matrix:

**PHASE 1B → YES if:**
- ✅ Tests 1-7 all PASS (especially room isolation)
- ✅ Tests 8-12 PASS or documented as acceptable limitations
- ✅ Zero unexpected blockers
- ✅ Rollback procedure tested and working

**PHASE 1B → CONDITIONAL if:**
- ⚠️ 1 HIGH issue with clear root cause + workaround
- ⚠️ Example: "iOS video lower fps (H.264 limitation); use desktop for video-intensive sessions"

**PHASE 1B → NO if:**
- 🛑 Room isolation fails
- 🛑 Audio/video completely broken on mobile
- 🛑 Email never sent
- 🛑 Crashes observed

---

## PARTE 4: DELIVERABLES (Friday Sept 14)

Entregar a Micaela:

```
1. ✅ SQL applied in staging (with rollback tested)
2. ✅ Edge functions deployed (select-provider, sync-provider-v2, send-email-v2)
3. ✅ Frontend changes deployed (reservar-v2.html, panel-v2, cliente.html)
4. ✅ Test results matrix (12 tests, all results documented)
5. ✅ Logs from each test (edge function logs, console logs, screenshots)
6. ✅ Room isolation evidence (recording or screenshot showing no cross-talk)
7. ✅ Rollback procedure tested (can revert in <5 min)
8. ✅ V1 compatibility verified (reservar.html still works)
9. ✅ Feature flag ready (ENABLE_V2_BOOKING=true/false)
10. ✅ Recommendations (PHASE 1B → YES/NO/CONDITIONAL)
```

---

## PARTE 5: ROLLBACK READINESS

Before Phase 1B, test rollback:

```bash
# Set feature flag to disable V2
# (If feature flag not yet implemented, be ready to:)
# 1. Revert deployment
# 2. Drop V2 columns (OR leave them, disable in app)
# 3. Confirm V1 reservar.html still works

ENABLE_V2_BOOKING=false

# Test:
# 1. Create cita via reservar.html (V1)
# 2. Verify it inserts successfully
# 3. Email still sends (via old send-email)
# 4. Panel shows cita (no provider columns used)
```

---

## SUMMARY

**FASE 1A = 2 weeks of rigorous internal validation**

✅ 12 tests covering provider selection, sync, email, UI, mobile, iOS, room isolation  
✅ Gate Friday Sept 14: Go/No-Go to Phase 1B  
✅ Deliverables: results, logs, rollback tested, recommendations  
✅ Blocker: Room isolation MUST pass  

**Next:** If all pass → Phase 1B with 5-10 real coaches (Week 3: Sept 17-21)
