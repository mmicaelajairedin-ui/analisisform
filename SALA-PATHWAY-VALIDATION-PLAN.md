# SALA PATHWAY — REAL-WORLD VALIDATION PLAN (FASE 1)

**Date:** August 13, 2026  
**Purpose:** Detailed coach↔client real-world validation of Sala Pathway as video conferencing provider  
**Scope:** Entry sequences, chat, video, audio, screen share, mobile/iOS, room isolation  
**Status:** Ready for Phase 1 execution (post-V2 implementation)

---

## PART 1: VALIDATION STRATEGY

### Why Real-World Testing is Critical

The code audit in SALA-PATHWAY-VIABILITY-REPORT.md verified:
- ✅ Token validation secure (JWT scope)
- ✅ P2P + TURN fallback correct
- ✅ Mobile responsive layout
- ✅ Jitsi infrastructure proven (8x8 JaaS)

**But does NOT verify:**
- ❌ Audio clarity on home WiFi + mobile 4G
- ❌ Video smoothness under packet loss
- ❌ Reconnect behavior after network toggle
- ❌ Chat sync across entry sequences
- ❌ iOS Safari compatibility (WebRTC gaps)
- ❌ Room isolation (no audio cross-talk)
- ❌ Performance under 30+ minute sessions

**Decision:** Mark "viable" ONLY after Phase 1 coaching pairs validate on real networks.

### Testing Philosophy

1. **Real coaches + real clients** — not internal QA only
2. **Diverse networks** — home WiFi (50ms stable), mobile 4G (100-200ms jitter), corporate firewall (TURN-only)
3. **Diverse devices** — desktop Chrome/Firefox, mobile Android/iOS, iPhone Safari
4. **Real scenarios** — not just audio/video isolated; chat + screen share together
5. **Stress endurance** — 30-min sessions like real coaching, not 5-min isolated tests

### Autonomy Levels

**Triage autonomy** for issues found:
- **LEVEL 0** (Blocker) — Crash, no audio, video frozen, room isolation fails → escalate immediately
- **LEVEL 1** (High) — Audio echo, video lag >300ms, slow reconnect → tester documents, tech team investigates
- **LEVEL 2** (Medium) — Color distortion, slight lag <150ms → document and continue testing
- **LEVEL 3** (Low) — UI nitpick, font size, button label — continue testing

---

## PART 2: ENTRY SEQUENCE VALIDATION (4 Patterns)

### Scenario A: Coach Enters First, Client Joins Later (5 min gap)

**Why:** Most common real-world pattern. Coaches often set up early.

| Step | Coach | Client | Expected | Measurement |
|------|-------|--------|----------|-------------|
| 1 | Clicks "Entrar a Sala" → sala.html loads | — | Room code shown in coach panel | Visual check in panel-v2 |
| 2 | Token validates, WebRTC starts | — | Room ID matches cita.sala_token (from DB) | Browser DevTools → Network |
| 3 | Coach waits 5 minutes, sees "En espera del cliente" message | — | Message visible, no disconnect | Subjective |
| 4 | — | Receives link (email/WhatsApp), clicks "Entrar" → sala.html loads with room_id in URL | Redirects to Sala, token validates | Visual check |
| 5 | — | WebRTC connects, P2P negotiates or falls back to TURN | Both see each other <5 seconds | Browser console: ICE candidates, connection state CONNECTED |
| 6 | Coach speaks: "Hola, ¿me escuchas?" | Client listens | Audio clear, latency <150ms, no echo | WebRTC stats: round-trip time (RTT) |
| 7 | Client responds: "Sí, claro" | Coach listens | Audio clear, latency <150ms | WebRTC stats: RTT |
| **Success** | ✅ Both see each other, audio bidirectional <5s connection | | | |

**Pass Criteria:**
- ✅ Coach does NOT auto-disconnect while waiting
- ✅ Client joins within 30 seconds of clicking link
- ✅ Video appears within 5 seconds of join
- ✅ Audio latency <300ms round-trip
- ✅ No crashes, no console errors

**Failure Handling:** If client fails to join:
- Check: Sala.html loads? Yes → proceed
- Check: Token validates? (DevTools → Application → fetch `POST /room_access`)
- Check: WebRTC ICE candidates appear? (DevTools → WebRTC internals)
- If token 401/403 → escalate as BLOCKER (auth issue)
- If ICE candidates = 0 → TURN server down (BLOCKER)
- If join >30s → document as HIGH (slow connection or browser stall)

---

### Scenario B: Client Enters First, Coach Joins Later (5 min gap)

**Why:** Validates that client doesn't get stuck waiting. Chat/documents should still work.

| Step | Coach | Client | Expected | Measurement |
|------|-------|--------|----------|-------------|
| 1 | — | Receives link, clicks "Entrar" | Loads sala.html, "En espera del coach" message | Visual check |
| 2 | — | Token validates, WebRTC starts media stream (audio/video) | No disconnect, ready to chat | Client doesn't get bored or crash |
| 3 | Coach arrives (5 min later), clicks "Entrar" | — | Coach sees client waiting | Coach panel shows client online |
| 4 | Coach speaks: "¿Qué tal?" | Client listens | Clear audio, no lag | RTT <300ms |
| 5 | Client responds + types message in chat | Coach sees message and hears audio | Chat arrives <2s, audio synchronized | Timestamp comparison |
| **Success** | ✅ Neither party auto-disconnects during wait | | | |

**Pass Criteria:**
- ✅ Client waits without disconnect (no 5-min timeout)
- ✅ Coach sees "Client waiting" in panel UI
- ✅ Chat works before coach speaks (no UX lockout)
- ✅ Connection completes <5s after coach joins
- ✅ No media restart glitch when coach joins

**Failure Handling:**
- If client auto-disconnects → Investigate session timeout (edge function logic)
- If coach doesn't see "client waiting" → UI sync issue (local state not updated)
- If chat queued messages don't appear → Chat persistence bug (escalate)

---

### Scenario C: Simultaneous Join (Both Click Within 2 Seconds)

**Why:** Validates no race conditions or double-connection glitches.

| Step | Both | Expected | Measurement |
|------|------|----------|-------------|
| 1 | Coach + Client both have link (email + panel) | | |
| 2 | Both click "Entrar" within 2 seconds | Room initializes once, both see each other <5s | Browser timeline (order of network requests) |
| 3 | Coach speaks + Client speaks (overlapping) | No audio crosstalk, both voices heard in sequence | Subjective + WebRTC stats (both sending audio) |
| 4 | Both see participant list (2 people) | Correctly shows 2, no duplicates | Visual check |
| **Success** | ✅ No race condition, connection stable, both audio tracks independent | | |

**Pass Criteria:**
- ✅ Room initializes exactly once (not 2 rooms created)
- ✅ No duplicate participant in local view
- ✅ Both audio streams received cleanly
- ✅ Connection <5s for both

**Failure Handling:**
- If room created twice → Saga/token collision bug (BLOCKER)
- If participant list shows [Coach, Coach, Client] → WebRTC state machine broken (BLOCKER)
- If one person's audio delayed >1s → WebRTC track not attached correctly (HIGH)

---

### Scenario D: Coach Leaves & Rejoins (Automatic Reconnect)

**Why:** Validates graceful handle of connection loss (browser tab close, network flake).

| Step | Coach | Client | Expected | Measurement |
|------|-------|--------|----------|-------------|
| 1 | Both in active call, audio flowing | Both in active call | Baseline: RTT <200ms | WebRTC stats |
| 2 | Coach closes browser tab (or toggles WiFi off) | Continues listening | Coach's audio stops | Client observes silence |
| 3 | Coach reopens tab within 10s, clicks "Entrar" again | — | Coach reconnects, previous room_id in URL | Browser history/localStorage |
| 4 | Coach's WebRTC reconnects, P2P renegotiates or falls back to TURN | — | Coach sees client again <10s | Visual check + RTT <300ms |
| 5 | Coach speaks: "Volví" | Client hears | Audio clear, no lag | Subjective + RTT |
| **Success** | ✅ Automatic reconnect <10s, no data loss (chat history visible) | | | |

**Pass Criteria:**
- ✅ room_id preserved in URL or localStorage
- ✅ Reconnect completes <10 seconds
- ✅ Chat history visible after reconnect
- ✅ No duplicate entries in chat
- ✅ Audio re-syncs cleanly

**Failure Handling:**
- If room_id lost → localStorage cleanup bug (HIGH)
- If reconnect >10s → WebRTC negotiation slow (document, may be network)
- If chat shows duplicate message → Dedup issue (BLOCKER)
- If chat history lost → Persistence bug (BLOCKER)

---

## PART 3: FEATURE VALIDATION (Chat, Screen Share, Audio, Video)

### Test 1: Chat & Message Delivery

**Setup:** Both in active call.

| Action | Expected | Measurement |
|--------|----------|-------------|
| Coach types: "¿Cómo te sientes con el cambio?" | Message appears on Client <2s | Timestamp: send_time vs receive_time |
| Client types reply: "Bien, pero nervioso" | Message appears on Coach <2s | Timestamp comparison |
| Coach sends emoji reaction (👍) | Appears on Client | Check: rendered as emoji (not escaped) |
| Client types multiline (copy/paste long text) | Preserves line breaks, no XSS | Inspect HTML (should be textNode, not innerHTML) |
| **Pass** | All messages <2s, order preserved, no corruption | |

**Failure Handling:**
- If message >2s → Network lag (document) or queue backlog (investigate)
- If order wrong → Chat sync bug (BLOCKER)
- If emoji corrupted → Encoding issue (HIGH)
- If XSS (script executed) → Security breach (BLOCKER, escalate immediately)

---

### Test 2: Screen Share

**Setup:** Both in active call, coach desktop with browser open.

| Action | Expected | Measurement |
|--------|----------|-------------|
| Coach clicks "Compartir pantalla" button | OS dialog appears (Chrome/Firefox) | Browser screenshot |
| Coach selects "Entire screen" or browser tab | Share starts, client sees coach's screen <2s | Visual check on client |
| Coach moves mouse, opens a document | Client sees movement <150ms lag | WebRTC stats: video codec metrics |
| Client types in chat while screen shared | Both chat and screen visible | Layout check: no overlap/z-order issue |
| Coach clicks "Stop sharing" | Screen feed disappears, video resumes | Smooth transition, no glitch |
| **Pass** | Screen crisp, synchronized with audio, no lag | |

**Failure Handling:**
- If share fails to start → `navigator.mediaDevices.getDisplayMedia` not supported (document as iOS/Safari limitation or browser issue)
- If lag >500ms → High bitrate or CPU issue (document)
- If freezes >1s → Possible codec issue (investigate)
- If chat becomes unreadable → Layout broken (HIGH)

---

### Test 3: Audio Quality & Echo Testing

**Setup:** Coach + Client with microphones, headphones on both.

| Action | Expected | Measurement |
|--------|----------|-------------|
| Client speaks for 10 seconds: "Prueba de audio, uno dos tres..." | Coach hears clear, no echo | Subjective (use checklist: clarity Y/N, echo Y/N) |
| Coach speaks for 10 seconds | Client hears clear, no echo | Same checklist |
| **Quiet room test** | Background noise minimal (<40dB) | Audio spectrum (DevTools → WebRTC stats) |
| **Noisy room test** (fan, traffic) | Speech still intelligible | Subjective (can identify words?) |
| **Measurement:** Record RTT and packet loss | RTT should be <300ms, packet loss <1% | WebRTC stats: `roundTripTime`, `packetsLost` |
| **Pass** | Clear bidirectional audio, no echo, intelligible on noisy background | |

**Failure Handling:**
- If echo detected → Check: speaker volume too high near mic, or echo cancellation disabled
- If one-way audio → WebRTC track not attached to both remote + local (BLOCKER)
- If packet loss >5% → Network unstable, try TURN (document)
- If RTT >500ms → High latency network (document, expected on slow 4G)

---

### Test 4: Video Quality

**Setup:** Coach + Client with cameras, good lighting.

| Action | Expected | Measurement |
|--------|----------|-------------|
| Coach enables video | Client sees coach's face within 2s | Frame rate monitor (DevTools → Performance → WebRTC stats) |
| Client enables video | Coach sees client's face within 2s | Same |
| **Resolution check** | Video at least 320x240 (mobile) or 640x480 (desktop) | Inspect `<video>` element dimensions |
| **Frame rate check** | ≥15 fps sustained, target 25-30 fps | WebRTC stats: `framesPerSecond` over 30s window |
| **Color accuracy** | Skin tones natural, not green/blue | Visual check |
| **Latency** | <150ms video latency (mouth → ear sync with audio) | Difficult to measure objectively; subjective check: "Does lip sync look OK?" |
| Coach moves quickly (hand wave) | No pixelation, smooth motion | Visual check |
| **Sustained load** (5 min) | Video doesn't freeze for >1s, CPU <30% | WebRTC stats + DevTools → Performance |
| **Pass** | ≥15 fps, <150ms latency, natural colors, no lag >1s | |

**Failure Handling:**
- If fps <10 → Possible CPU overload or codec mismatch. Check: CPU%, memory, browser tabs open
- If video frozen >1s → ICE restart or track stall (investigate)
- If color distorted → Codec or camera calibration issue (document)
- If resolution <320x240 → Fallback mode triggered (check why — bandwidth or device)

---

## PART 4: MOBILE & iOS VALIDATION

### Scenario E: Mobile (Android 4G)

**Setup:** Coach on desktop Chrome, Client on Android mobile (Chrome or Firefox) over cellular 4G.

| Step | Coach | Client | Expected | Measurement |
|------|-------|--------|----------|-------------|
| 1 | — | Opens Sala link on mobile Chrome, allows camera/mic | Page loads <3s on 4G | Network waterfall (DevTools → Mobile) |
| 2 | — | Taps "Permitir acceso a cámara y micrófono" | Permissions granted, WebRTC starts | Browser permissions prompt |
| 3 | Coach speaks | Client hears over speaker (not earpiece yet) | Audio intelligible despite background | Subjective |
| 4 | — | Plugs in earbuds for better audio | Audio quality improves | Comparison before/after |
| 5 | Client enables video | Coach sees mobile video feed | Resolution ≥320x240, fps ≥15 | WebRTC stats |
| 6 | Client types chat message | Coach receives <2s | Timestamp check |
| 7 | Coach shares screen | Client's mobile shows shared screen (scaled to mobile viewport) | Readable, no overflow | Visual check (can client read text on screen?) |
| **Pass** | Audio clear on 4G, video smooth, chat responsive, screen readable | | |

**Pass Criteria:**
- ✅ Page load <3s on 4G (first meaningful paint)
- ✅ Audio latency <300ms
- ✅ Video fps ≥15, resolution ≥320x240
- ✅ Battery drain <10%/min (measure over 10 min session)
- ✅ Chat responds <2s
- ✅ No memory leak (app doesn't slow down over 10 min)

**Failure Handling:**
- If page load >5s → Possible asset bloat or 4G network issue (document)
- If audio dropout → Check: airplane mode toggle to force network switch
- If video freezes → Check: CPU (background apps running?) or mobile browser tab limitation
- If battery drain >15%/min → Investigate: video codec, WiFi off (4G uses more power), high CPU

---

### Scenario F: iOS Safari

**Setup:** Coach on desktop Chrome, Client on iPhone Safari (iOS 14+).

| Step | Coach | Client | Expected | Known Limitation? |
|------|-------|--------|----------|-------------------|
| 1 | — | Opens Sala link in Safari on iPhone | Page loads | ✅ WebRTC supported in iOS 11+ Safari |
| 2 | — | Taps "Allow Microphone/Camera" | Permissions granted | ✅ iOS requests each session |
| 3 | — | WebRTC tries P2P, falls back to TURN | Connection successful (may be slower on TURN) | ⚠️ iOS disallows P2P in Safari (privacy), TURN only |
| 4 | Client speaks | Coach hears | Audio works | ✅ Audio codec H.264/Opus supported |
| 5 | Client enables video | Coach sees video (possibly H.264, not VP8) | Video appears within 5s | ⚠️ H.264 only, may be lower fps than desktop |
| 6 | Coach shares screen (Chrome on desktop) | Client sees shared screen | Readable on mobile | Visual check |
| 7 | Client types chat | Coach receives | Chat delivery <2s | ✅ WebSocket same for all browsers |
| 8 | **Sustained call (10 min)** | Both stay in call | No crash, battery drain <10%/min | ✅ Safari stable, no memory leak observed |
| **Pass** | iOS Safari connects and sustains call; video may be lower fps but usable | | |

**iOS Limitations (Document):**
- ❌ P2P not allowed (Safari enforces privacy, TURN only)
- ⚠️ Video codec limited to H.264 (may lower fps vs VP8)
- ✅ Audio works
- ✅ Chat works
- ✅ Screen share visible (coach's screen shown, not iOS screen share)
- ✅ WebRTC stats available (DevTools on Mac, mirror iPhone)

**Pass Criteria:**
- ✅ Connects (TURN fallback OK)
- ✅ Audio works
- ✅ Video appears (even if lower fps)
- ✅ Chat works
- ✅ No crash during 10-min session
- ✅ Battery drain <10%/min

**If iOS Video Fails:** Document as known limitation (H.264/fps trade-off) and provide workaround: "Use desktop Chrome for video-heavy sessions, iPhone for audio-only coaching."

---

## PART 5: NETWORK INTERRUPTION & RESILIENCE

### Scenario G: WiFi Toggle (Simulate Network Switch)

**Setup:** Client on mobile with WiFi + 4G both available. Both in active call.

| Step | Action | Expected | Measurement |
|------|--------|----------|-------------|
| 1 | Both in call over WiFi, audio flowing | Baseline: RTT <100ms | WebRTC stats |
| 2 | Toggle WiFi off (keep 4G on) | Brief glitch (<2s), then reconnect via 4G | Observe: connection state changes to "reconnecting" |
| 3 | Audio resumes via 4G | RTT increases to ~100-200ms (4G slower than WiFi) | WebRTC stats updated |
| 4 | Coach speaks: "¿Seguimos?" | Client hears, latency acceptable | Subjective + RTT measurement |
| 5 | Toggle WiFi back on | Reconnect via WiFi | Brief glitch, then faster RTT again |
| 6 | Call continues uninterrupted | Audio clear, chat synced | Subjective |
| **Pass** | Handles network switch gracefully; call resumes <5s, no crash | | |

**Pass Criteria:**
- ✅ Detects network change
- ✅ Reconnect <5 seconds
- ✅ No crash or console errors
- ✅ Chat continues (no message loss)
- ✅ User notified of reconnection (UI feedback: "Reconnecting..." banner)

**Failure Handling:**
- If glitch >10s → ICE restart or TURN server issue (HIGH)
- If crash → Unhandled promise rejection (BLOCKER, fix WebRTC state machine)
- If messages lost → Chat persistence issue (BLOCKER)
- If user not notified → UX issue (HIGH, user confused if they're still connected)

---

### Scenario H: Long Session (30 Minutes)

**Setup:** Real coaching session. Coach + Client in live call for full 30 minutes.

| Interval | Metrics | Expected | Measurement |
|----------|---------|----------|-------------|
| **0-5 min** | Baseline audio, video, chat | All working, RTT <150ms | WebRTC stats |
| **5-15 min** | Sustained performance | No memory leak visible, CPU <30% | DevTools → Memory (heap snapshot), performance |
| **15-25 min** | Check for creep in latency | RTT should not increase >20ms over baseline | Trending: RTT plot |
| **25-30 min** | Final stretch | Same as baseline | Compare to 0-5 min metrics |
| **After disconnect** | Memory cleanup | Heap returns to baseline (within 10%) | Memory profiler: disconnect should free WebRTC tracks |
| **Pass** | Performance stable throughout; no memory leak; no crash | | |

**Pass Criteria:**
- ✅ CPU <30% sustained (video encoding + audio + chat)
- ✅ Memory doesn't grow >20% (no leak)
- ✅ RTT doesn't trend upward >20ms (no congestion buildup)
- ✅ No audio/video stutter after 20 min
- ✅ Battery drain <10%/min (mobile)
- ✅ No crash, no frozen frames

**Failure Handling:**
- If CPU creeps to 50%+ → Video codec issue or garbage collection stalls (investigate)
- If memory grows 50%+ → Leak in WebRTC track cleanup (HIGH, blocker for production)
- If RTT trends +100ms → Network congestion or TURN server overload (escalate)
- If battery drain >15%/min → High CPU or screen-on time (expected, not critical)

---

## PART 6: ROOM ISOLATION (Critical Security Test)

### Scenario I: Two Simultaneous Rooms (No Audio Cross-Talk)

**Setup:** Two pairs of coaches + clients in separate rooms, same Sala instance.

| Setup | Room A (Coach A + Client A) | Room B (Coach B + Client B) | Expected | Measurement |
|-------|----------------------------|----------------------------|----------|-------------|
| **Room isolation** | Room token: `aaa-aaa-aaa` | Room token: `bbb-bbb-bbb` | Both rooms use different tokens (from DB: cita.sala_token) | Database query: SELECT cita_id, sala_token FROM citas WHERE estado='live' |
| **Separate WebRTC** | P2P connection: Coach A ↔ Client A | P2P connection: Coach B ↔ Client B | Two independent WebRTC PeerConnections | Browser DevTools: RTCPeerConnection count = 2 (if 2 rooms on same browser) |
| **Coach A speaks** | "Hola, ¿cómo estás?" | (listening to Coach B's call, NOT Coach A) | Coach B does NOT hear Coach A | Room A recording (if available) vs Room B recording: different audio streams |
| **Coach B responds** | (listening to Coach A's call, NOT Coach B) | "Bien, gracias" | Coach A does NOT hear Coach B | Subjective: Coach A hears ONLY Client A responding, not Coach B |
| **Chat isolation** | Chat message sent to Room A | Chat message sent to Room B | Room A chat ≠ Room B chat | Database: SELECT cita_id, message FROM chat WHERE cita_id = 'A' vs 'B' (different rows) |
| **Participant lists** | Coach A sees [Coach A, Client A] | Coach B sees [Coach B, Client B] | No cross-contamination | Inspect: `document.querySelector('#participants').innerText` |
| **Pass** | ✅ No audio cross-talk, no message leakage, participant lists isolated | | |

**CRITICAL FAILURE CRITERIA:**
If any of these fail → **BLOCKER, DO NOT DEPLOY**:
- ❌ Coach A hears Coach B's audio → Critical room isolation bug
- ❌ Chat message from Room B appears in Room A → Message routing broken
- ❌ Coach A sees Coach B in participant list → State corruption

**Mitigation if isolation fails:**
1. Immediate investigation: Is token validation working? (Check sala.html `_validateToken()`)
2. Check: Are both rooms using same connection? (WebRTC should be separate)
3. Check: Database — do cita records have distinct sala_token values?
4. Root cause: If tokens identical → Token generation broken (BLOCKER)

---

## PART 7: EXECUTION PLAN & TIMELINE

### Phase 1A: Internal Validation (Week 1 of Agosto 27)

**Participants:** Micaela (coach, admin) + QA tester (client) + tech support

**Tests to run:**
- Scenario A (Coach first)
- Scenario B (Client first)
- Scenario C (Simultaneous join)
- Test 1 (Chat)
- Test 2 (Screen share)
- Test 3 (Audio quality)
- Test 4 (Video quality)

**Output:** Test results spreadsheet (pass/fail/notes), any BLOCKER issues logged

**Decision point:** If any Scenario A-C or Test 1-4 fails as BLOCKER → stop, fix, retry. If all pass → proceed to Phase 1B.

---

### Phase 1B: Pilot with Coaches (Week 2)

**Participants:** 5-10 volunteer coaches from existing customer base + their clients

**Each coach pair runs:**
- Entry sequences (A, B, C)
- Chat + Screen share
- Audio/Video quality
- One 30-min endurance session (real coaching content)

**Additional coverage:**
- Coach 1-2: Desktop Chrome (home WiFi)
- Coach 3-4: Mobile Android (4G)
- Coach 5: iPhone Safari (if available)

**Measurement:** Standardized form (see Part 8 below):
```
Date: _____
Coach: _____ | Client: _____
Platform: [Desktop Chrome] [Mobile Android] [iPhone Safari]
Network: [Home WiFi] [Mobile 4G] [Corporate]
---
Audio quality: [Excellent] [Good] [Acceptable] [Poor] [Failed]
Video quality: [Excellent] [Good] [Acceptable] [Poor] [Failed]
Chat response: <2s? [Y/N]
Screen share: [Worked] [Slow] [Failed]
Issues: [list]
Recommendation: [Approve] [Fix and retry] [Don't use]
```

**Autonomy:** Coaches decide to approve/reject Sala based on their own session.

---

### Phase 1C: Extended Testing (Week 3, if needed)

**If issues found:** Fix reported bugs, have 2-3 coach pairs re-test.  
**If no issues:** Celebrate, mark "APPROVED FOR PRODUCTION".

---

## PART 8: TEST RESULT TEMPLATE

Each tester completes this after their session:

```json
{
  "test_id": "SALA-TEST-20260827-001",
  "date": "2026-08-27",
  "coach": "coach-name",
  "client": "client-name",
  "duration_minutes": 30,
  "platform_coach": "Desktop / Chrome / Windows",
  "platform_client": "Mobile / Android Chrome / 4G",
  "network_coach": "Home WiFi (50ms, stable)",
  "network_client": "Mobile 4G (120ms, variable)",
  
  "entry_sequence_tested": "A (Coach first, wait 5 min)",
  "entry_sequence_result": "PASS",
  
  "audio_quality": "Good",
  "audio_latency_ms": 145,
  "audio_echo": false,
  "audio_issues": [],
  
  "video_quality": "Excellent",
  "video_fps": 28,
  "video_resolution": "640x480",
  "video_latency_ms": 120,
  "video_freezes": 0,
  "video_issues": [],
  
  "chat_delivery_s": 1.2,
  "chat_order_preserved": true,
  "chat_issues": [],
  
  "screen_share_tested": true,
  "screen_share_result": "PASS",
  "screen_share_latency_ms": 150,
  "screen_share_issues": [],
  
  "reconnect_tested": true,
  "reconnect_time_s": 6,
  "reconnect_result": "PASS",
  "reconnect_issues": [],
  
  "battery_drain_percent_per_min": 7,
  "memory_leak_detected": false,
  "cpu_peak_percent": 28,
  
  "crashes_or_errors": [],
  "subjective_feedback": "Sala felt very natural and reliable. Quality was comparable to Zoom.",
  "recommendation": "APPROVE",
  "blocker_issues": [],
  "high_priority_issues": [],
  "medium_priority_issues": [],
  "low_priority_issues": []
}
```

---

## PART 9: DECISION GATES

### Before Phase 1B → Production Approval

**Go** if:
- ✅ All Phase 1A tests (A-C, Tests 1-4) pass
- ✅ Zero BLOCKER issues
- ✅ No crashes

**No-Go / Retry** if:
- ❌ Any BLOCKER in Phase 1A
- ❌ 2+ HIGH issues in same category (e.g., both coaches report video lag)
- ❌ Crash during Phase 1A

**Conditional Go (Phase 1B with caution)** if:
- ⚠️ One HIGH issue, understood root cause, workaround documented
- ⚠️ Example: "iOS Safari video lower fps due to H.264, use desktop Chrome for high-motion content"

### Before Public Launch → Micaela Sign-Off

**Launch approved** if:
- ✅ Tier 1 tests (scenarios 1-4 from FASE-0-TEST-MATRIX.md): 100% pass, zero BLOCKER
- ✅ Tier 2 tests (scenarios 5-12): ≥80% pass or documented workarounds
- ✅ Coach feedback: ≥80% would recommend Sala to their clients
- ✅ Room isolation verified (Part 6): zero cross-talk

**Launch rejected** if:
- ❌ Room isolation fails (BLOCKER)
- ❌ ≥3 coaches report audio unusable
- ❌ Crash rate >5%

---

## PART 10: POST-LAUNCH MONITORING

After V2 goes live, monitor in production:

1. **Error tracking:** `client_errors` table should NOT spike for Sala sessions
2. **Coach feedback:** Alert if >2 coaches report Sala issues
3. **Session success rate:** Track % of citas with provider='pathway_room' that complete without disconnect
4. **Performance trends:** Weekly dashboard of Sala session metrics (avg RTT, audio quality, battery drain)

---

## SUMMARY

This validation plan operationalizes the SALA-PATHWAY-VIABILITY-REPORT.md code audit. It transforms the technical confidence ("code looks good") into operational confidence ("real coaches can use it reliably").

**Key principle:** Do not mark Sala "approved" until at least 10 real coach↔client pairs have run full sessions on diverse networks and devices.

**Next step:** After V2 implementation, execute Phase 1A (internal), review results with Micaela, decide on Phase 1B (pilot).
