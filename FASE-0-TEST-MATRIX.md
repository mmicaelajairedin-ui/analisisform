# FASE 1 — TEST MATRIX FOR AGENDA V2

**Purpose:** Define all test scenarios for Sala Pathway viability + Agenda V2 integration  
**Status:** Definition ready; execution pending Phase 1 approval  
**Total Scenarios:** 12 core + 3 optional = 15

---

## TEST SCENARIOS

### TIER 1: BASIC FUNCTIONALITY (Must Pass)

#### Scenario 1: Basic Connection (Desktop, Chrome, Home WiFi)

| Attribute | Value |
|-----------|-------|
| **Participants** | 1 coach, 1 client |
| **Platform** | Desktop Chrome, home WiFi |
| **Duration** | 5 minutes |
| **Setup** | Coach clicks "Entrar a Sala" → Room loads |
| **Actions** | Coach speaks → Client hears; Client speaks → Coach hears |
| **Success Criteria** | ✓ Audio clear, bidirectional | ✓ Video smooth (15+ fps) | ✓ No connection drops |
| **Measurement** | Subjective (listen), browser DevTools (latency) |
| **Owner** | QA + 1 coach + 1 client |
| **Failure Handling** | If fails: check TURN server, browser console errors |

#### Scenario 2: Video Quality (Home WiFi)

| Attribute | Value |
|-----------|-------|
| **Participants** | 1 coach, 1 client |
| **Platform** | Desktop Chrome/Firefox, home WiFi |
| **Duration** | 5 minutes |
| **Actions** | Both enable cameras; observe video feed |
| **Success Criteria** | ✓ Video 30 fps (target) | ✓ No freezing >1 sec | ✓ Color accurate | ✓ Latency <150ms |
| **Measurement** | Chrome DevTools → Performance (fps), WebRTC stats (latency) |
| **Owner** | QA (technical measurement) |
| **Failure Handling** | If fps drops: check network bandwidth, CPU usage |

#### Scenario 3: Audio Quality (Mobile 4G)

| Attribute | Value |
|-----------|-------|
| **Participants** | 1 coach (desktop), 1 client (mobile on 4G) |
| **Platform** | Mobile Chrome (Android) or Safari (iOS) |
| **Duration** | 3 minutes |
| **Setup** | Client on 4G network (not WiFi) |
| **Actions** | Both speak; listen for clarity, echo, delays |
| **Success Criteria** | ✓ Audio clear (no echo) | ✓ Latency <300ms | ✓ No dropouts |
| **Measurement** | Subjective + WebRTC stats (RTT, packet loss) |
| **Owner** | Real user + QA |
| **Failure Handling** | If audio drops: test TURN fallback, check packet loss |

#### Scenario 4: Chat & Screen Share

| Attribute | Value |
|-----------|-------|
| **Participants** | 1 coach, 1 client |
| **Duration** | 5 minutes |
| **Actions** | Coach types message → Client sees | Coach shares screen → Client views document |
| **Success Criteria** | ✓ Chat messages deliver <2s | ✓ Order preserved | ✓ Screen share crisp | ✓ Synchronized with audio |
| **Measurement** | Timestamp comparison, visual inspection |
| **Owner** | QA |
| **Failure Handling** | If screen share lags: check resolution, CPU |

---

### TIER 2: REAL-WORLD CONDITIONS (Must Pass)

#### Scenario 5: Simultaneous Join (Both Click at Same Time)

| Attribute | Value |
|-----------|-------|
| **Participants** | 1 coach, 1 client |
| **Timing** | Both click "Enter Sala" within 2 seconds |
| **Duration** | 2 minutes |
| **Success Criteria** | ✓ Both see each other <5 seconds | ✓ No race conditions | ✓ Audio/video synchronized |
| **Measurement** | Observe connection sequence |
| **Owner** | QA |
| **Failure Handling** | If one joins but other doesn't: check token validation, server logs |

#### Scenario 6: Late Joiner — Client First (Wait 5 min)

| Attribute | Value |
|-----------|-------|
| **Participants** | 1 coach, 1 client |
| **Timing** | Client enters room; coach arrives 5 minutes later |
| **Duration** | 7 minutes |
| **Setup** | Client sees "Waiting for coach..." message |
| **Success Criteria** | ✓ Client can wait without disconnecting | ✓ Coach joins; both see each other | ✓ Call succeeds |
| **Measurement** | Test platform behavior with single participant |
| **Owner** | QA |
| **Failure Handling** | If client disconnects: check session timeout, browser behavior |

#### Scenario 7: Late Joiner — Coach First (Wait 5 min)

| Attribute | Value |
|-----------|-------|
| **Participants** | 1 coach, 1 client |
| **Timing** | Coach starts room; client joins 5 minutes later |
| **Duration** | 7 minutes |
| **Success Criteria** | ✓ Same as Scenario 6 |
| **Measurement** | Observe room state with multiple join patterns |
| **Owner** | QA |
| **Failure Handling** | If coach auto-disconnects: check idle timeout settings |

#### Scenario 8: Safari/iOS Compatibility

| Attribute | Value |
|-----------|-------|
| **Participants** | 1 coach (desktop), 1 client (iPhone) |
| **Platform** | Safari on iOS 14+ |
| **Duration** | 5 minutes |
| **Actions** | Client taps "Entrar" → Joins room | Both enable audio/video |
| **Success Criteria** | ✓ Connects (or known iOS limitation documented) | ✓ Audio works | ✓ Video works (or has workaround) |
| **Measurement** | Functional test + known issues log |
| **Owner** | QA + iOS user |
| **Failure Handling** | Document iOS 14+ requirement; provide troubleshooting guide |

#### Scenario 9: Intentional Disconnect & Reconnect

| Attribute | Value |
|-----------|-------|
| **Participants** | 1 coach, 1 client (in call) |
| **Duration** | 5 minutes |
| **Action** | Coach leaves room; rejoins after 10 seconds |
| **Success Criteria** | ✓ Automatic reconnect <10 seconds | ✓ Call resumes seamlessly | ✓ No duplicate participants |
| **Measurement** | Observe participant list, connection state |
| **Owner** | QA |
| **Failure Handling** | If reconnect fails: check WebRTC state, browser logs |

#### Scenario 10: Network Interruption (WiFi Toggle)

| Attribute | Value |
|-----------|-------|
| **Participants** | 1 coach, 1 client (mobile) |
| **Duration** | 3 minutes |
| **Action** | During call, toggle WiFi off/on (simulate network switch) |
| **Success Criteria** | ✓ Handles gracefully (not crash) | ✓ Reconnects automatically | ✓ User notified of reconnection |
| **Measurement** | Observe error handling, reconnection sequence |
| **Owner** | QA + mobile tester |
| **Failure Handling** | If crashes: file browser error, fix WebRTC state machine |

---

### TIER 3: ISOLATION & SCALE (Must Pass)

#### Scenario 11: Two Simultaneous Rooms (Isolation Test)

| Attribute | Value |
|-----------|-------|
| **Participants** | 2 coaches, 2 clients (in separate rooms) |
| **Setup** | Coach A + Client A in Room 1; Coach B + Client B in Room 2 |
| **Duration** | 5 minutes |
| **Action** | Both rooms active simultaneously |
| **Success Criteria** | ✓ No audio cross-talk (A doesn't hear B) | ✓ Video isolated | ✓ Participant lists correct |
| **Measurement** | Audio inspection (can B hear A's conversation?) |
| **Owner** | QA + 2 coaches + 2 clients |
| **Failure Handling** | If isolation fails: critical bug, investigate room routing |

#### Scenario 12: 30-Minute Endurance Session

| Attribute | Value |
|-----------|-------|
| **Participants** | 1 coach, 1 client |
| **Duration** | 30 minutes (full session) |
| **Setup** | Real coaching session (not just idle) |
| **Success Criteria** | ✓ Audio/video stable throughout | ✓ No memory leaks | ✓ CPU <30% | ✓ Battery drain <10%/min (mobile) | ✓ Chat/screen share work |
| **Measurement** | DevTools profiler (memory, CPU), battery stats, subjective quality |
| **Owner** | Real coach + client |
| **Failure Handling** | If performance degrades: profile for memory leaks, optimize |

---

## OPTIONAL SCENARIOS (Phase 1 Extended)

#### Scenario 13: Multiple Participants (3+ people in one room)

| Attribute | Value |
|-----------|-------|
| **Participants** | 1 coach + 2 clients (or group coaching) |
| **Duration** | 10 minutes |
| **Success Criteria** | ✓ All participants see each other | ✓ Audio clearly identifies speaker | ✓ Screen share visible to all |
| **Measurement** | Subjective + participant count verification |
| **Owner** | QA |
| **Prerequisite** | Only if V2 supports multi-participant sessions |

#### Scenario 14: Mobile-to-Mobile (Both on 4G)

| Attribute | Value |
|-----------|-------|
| **Participants** | 1 coach (mobile), 1 client (mobile), both on 4G |
| **Duration** | 3 minutes |
| **Success Criteria** | ✓ Connects | ✓ Audio/video works | ✓ CPU/battery manageable |
| **Measurement** | Performance metrics for mobile-heavy workload |
| **Owner** | QA |
| **Failure Handling** | Document mobile performance characteristics |

#### Scenario 15: Browser Memory Leak Detection

| Attribute | Value |
|-----------|-------|
| **Participants** | 1 coach |
| **Duration** | Join + leave 10 times sequentially (10 min total) |
| **Success Criteria** | ✓ Memory returned after disconnect | ✓ No growth in baseline memory |
| **Measurement** | Chrome DevTools → Memory profiler, heap snapshots |
| **Owner** | QA (technical) |
| **Failure Handling** | If memory grows: leak investigation, WebRTC cleanup |

---

## EXECUTION PLAN

### Phase 1A: Internal Testing (Week 1)
- Scenarios 1-4 (basic functionality)
- Participants: QA team + internal coach + internal client
- Goal: Validate core features before real users

### Phase 1B: Pilot Testing (Week 2)
- Scenarios 5-12 (real-world conditions)
- Participants: 5-10 volunteer coaches + real clients
- Goal: Identify issues with diverse networks + devices

### Phase 1C: Extended Testing (Week 3)
- Scenarios 13-15 (optional, if needed)
- Participants: Same as Phase 1B + additional edge cases
- Goal: Confirm stability before public launch

### Launch Criteria
✅ All Tier 1 (1-4) pass without critical issues  
✅ All Tier 2 (5-12) pass or have documented workarounds  
✅ No crashes or data loss  
✅ Coach + client feedback positive (adoption risk acceptable)

**If any Tier 1 fails:** Escalate immediately; do not proceed to public launch

---

## TEST ENVIRONMENT SETUP

### Hardware Required
- Desktop computer #1 (Chrome + Firefox) — Coach
- Desktop computer #2 (Chrome) — Client
- Mobile device (Android) — Client (4G + WiFi)
- iPhone (Safari, iOS 14+) — Client (4G + WiFi)

### Network Simulation
- Home WiFi: ~50ms latency, stable
- 4G: Simulate 100-200ms latency, variable jitter
- Corporate: TURN-only (no P2P)
- Network toggle tool: WiFi manager or airplane mode

### Monitoring Tools
- Chrome DevTools → Network, Performance, WebRTC stats
- Browser console → Error logging
- Xcode/Android Studio → Mobile profiling

---

## PASS/FAIL CRITERIA BY SCENARIO

| Scenario # | Pass | Fail | Contingency |
|-----------|------|------|------------|
| 1 (Basic) | Audio + video <5s | No connection | Fix server/TURN config |
| 2 (Video quality) | 30 fps, <150ms | Freezing, color distortion | Check bandwidth, optimize codec |
| 3 (Mobile audio) | Clear, <300ms | Echo, dropouts | Test TURN fallback |
| 4 (Chat/screen) | <2s delivery, crisp share | Lag, pixelation | Optimize bitrate |
| 5 (Simultaneous) | Both join <5s | Race condition | Debug participant join order |
| 6-7 (Late joiner) | Wait + join succeeds | Idle disconnect | Extend session timeout |
| 8 (iOS) | Connects (or documented) | iOS-only bug | Provide workaround |
| 9 (Reconnect) | Auto-reconnect <10s | Manual reconnect needed | Improve WebRTC state handling |
| 10 (Network interrupt) | Handles gracefully | Crash | Add error boundaries |
| 11 (Isolation) | No cross-talk | Audio cross-talk | Critical: investigate room routing |
| 12 (30 min) | Stable performance | Memory leak, degradation | Profile + optimize |

---

## METRICS TO COLLECT

For each test session, capture:

```json
{
  "scenario": 1,
  "date": "2026-08-20",
  "coach": "test-coach-1",
  "client": "test-client-1",
  "duration_seconds": 300,
  "platform_coach": "Chrome / Desktop / Linux",
  "platform_client": "Chrome / Desktop / Linux",
  "network_coach": "home WiFi",
  "network_client": "home WiFi",
  "audio_quality": "excellent" | "good" | "acceptable" | "poor" | "failed",
  "video_quality": "excellent" | "good" | "acceptable" | "poor" | "failed",
  "connection_drops": 0,
  "avg_latency_ms": 45,
  "cpu_coach": 28,
  "cpu_client": 25,
  "issues": [],
  "notes": "..."
}
```

---

## SIGN-OFF

When all scenarios pass → **Sala Pathway APPROVED for production in Agenda V2**

Assigned to:
- **QA Lead:** Verify test execution
- **Coach Volunteer:** Real-world feedback  
- **Client Volunteer:** UX feedback
- **Tech Lead:** Investigation of failures

**Target Completion:** End of Week 3 (Week of August 27, 2026)

---

## NEXT STEP

Complete all Phase 1 testing → Summarize results → Decision: Launch V2 or fallback
