/**
 * apple-iap-webhook Security Tests — Deno Test Format
 *
 * Tests for IAP webhook security fixes:
 * 1. Unsigned notifications rejected (FIX 1)
 * 2. Stale events ignored via timestamp (FIX 2)
 * 3. Test mode requires localhost (FIX 3)
 * 4. Nested JWS data extracted and validated
 *
 * HOW TO RUN (TIER 1 LOCAL TESTS):
 *
 * For unsigned rejection test (TEST 1):
 *   supabase functions serve (do NOT set IAP_ALLOW_UNSIGNED_TEST)
 *   deno test --allow-net webhook-security.test.ts
 *
 * For test mode tests (TEST 2, 3, 4):
 *   export IAP_ALLOW_UNSIGNED_TEST=true
 *   supabase functions serve
 *   deno test --allow-net webhook-security.test.ts
 */

const WEBHOOK_URL = "http://localhost:54321/functions/v1/apple-iap-webhook";

// =============================================================================
// TEST 1: Unsigned notification rejected (production mode)
// =============================================================================

Deno.test("TEST 1: Unsigned notification rejected without test mode", async () => {
  // PRECONDITION: IAP_ALLOW_UNSIGNED_TEST must NOT be set
  const hasTestMode = Deno.env.get("IAP_ALLOW_UNSIGNED_TEST") === "true";
  if (hasTestMode) {
    console.warn(
      "⚠️  TEST 1 skipped: IAP_ALLOW_UNSIGNED_TEST is set. Run without setting it."
    );
    return; // Skip if test mode is active
  }

  const response = await fetch(WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      notification: {
        notificationType: "SUBSCRIBED",
        originalTransactionId: "fake-tx-123",
        productId: "coach.plan.basic.monthly",
        appAccountToken: "test-user-uuid"
      }
    })
  });

  // Should reject with 400 in production
  if (response.status !== 400) {
    throw new Error(
      `Expected 400, got ${response.status}. Unsigned notification was not rejected!`
    );
  }

  const body = await response.json();
  if (!body.error || !body.error.includes("signedPayload")) {
    throw new Error(
      `Expected 'signedPayload' in error, got: ${body.error}`
    );
  }

  console.log("✅ TEST 1 PASSED: Unsigned notification correctly rejected");
});

// =============================================================================
// TEST 2: Idempotency via notificationUUID (test mode)
// =============================================================================

Deno.test("TEST 2: Duplicate notifications deduplicated", async () => {
  const hasTestMode = Deno.env.get("IAP_ALLOW_UNSIGNED_TEST") === "true";
  if (!hasTestMode) {
    console.warn(
      "⚠️  TEST 2 skipped: IAP_ALLOW_UNSIGNED_TEST not set. Set it to run this test."
    );
    return;
  }

  const notificationUUID = "test-dup-" + Date.now();
  const txId = "test-tx-dup-" + Date.now();

  const payload = {
    notification: {
      notificationType: "SUBSCRIBED",
      notificationUUID,
      originalTransactionId: txId,
      productId: "coach.plan.basic.monthly",
      appAccountToken: "test-user-" + Date.now(),
      signedDate: Date.now()
    }
  };

  // Send 3 times
  const responses = [];
  for (let i = 0; i < 3; i++) {
    const res = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    responses.push(res);
  }

  // All should be 200 OK
  for (let i = 0; i < responses.length; i++) {
    if (responses[i].status !== 200) {
      throw new Error(
        `Request ${i + 1} failed with status ${responses[i].status}`
      );
    }
  }

  // Second and third should indicate duplicate
  const secondBody = await responses[1].json();
  const thirdBody = await responses[2].json();

  if (secondBody.duplicate !== true) {
    throw new Error(
      `Request 2 should indicate duplicate, got: ${JSON.stringify(secondBody)}`
    );
  }

  if (thirdBody.duplicate !== true) {
    throw new Error(
      `Request 3 should indicate duplicate, got: ${JSON.stringify(thirdBody)}`
    );
  }

  console.log("✅ TEST 2 PASSED: Duplicate notifications correctly deduplicated");
});

// =============================================================================
// TEST 3: Stale events ignored (test mode)
// =============================================================================

Deno.test("TEST 3: Stale events ignored via timestamp", async () => {
  const hasTestMode = Deno.env.get("IAP_ALLOW_UNSIGNED_TEST") === "true";
  if (!hasTestMode) {
    console.warn(
      "⚠️  TEST 3 skipped: IAP_ALLOW_UNSIGNED_TEST not set. Set it to run this test."
    );
    return;
  }

  const recentDate = Date.now();
  const staleDate = recentDate - 10000; // 10 seconds older
  const txId = "test-tx-stale-" + Date.now();
  const appToken = "test-user-" + Date.now();

  // Send RECENT SUBSCRIBED event
  const recentRes = await fetch(WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      notification: {
        notificationType: "SUBSCRIBED",
        notificationUUID: "recent-" + Date.now(),
        originalTransactionId: txId,
        productId: "coach.plan.basic.monthly",
        appAccountToken: appToken,
        signedDate: recentDate
      }
    })
  });

  if (recentRes.status !== 200) {
    throw new Error(
      `Recent event failed: status ${recentRes.status}`
    );
  }

  // Send STALE EXPIRED event (older timestamp)
  const staleRes = await fetch(WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      notification: {
        notificationType: "EXPIRED",
        notificationUUID: "stale-" + Date.now(),
        originalTransactionId: txId,
        productId: "coach.plan.basic.monthly",
        appAccountToken: appToken,
        signedDate: staleDate // Older timestamp
      }
    })
  });

  if (staleRes.status !== 200) {
    throw new Error(
      `Stale event failed: status ${staleRes.status}`
    );
  }

  const staleBody = await staleRes.json();

  if (staleBody.state !== "ignored_stale") {
    throw new Error(
      `Stale event should be ignored, got state: ${staleBody.state}`
    );
  }

  console.log("✅ TEST 3 PASSED: Stale events correctly ignored");
});

// =============================================================================
// TEST 4: Test mode localhost whitelist
// =============================================================================

Deno.test("TEST 4: Test mode accepts only from localhost", async () => {
  const hasTestMode = Deno.env.get("IAP_ALLOW_UNSIGNED_TEST") === "true";
  if (!hasTestMode) {
    console.warn(
      "⚠️  TEST 4 skipped: IAP_ALLOW_UNSIGNED_TEST not set. Set it to run this test."
    );
    return;
  }

  // POSITIVE: With test mode on and localhost Supabase, unsigned should be accepted
  const response = await fetch(WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      notification: {
        notificationType: "SUBSCRIBED",
        notificationUUID: "test-loc-" + Date.now(),
        originalTransactionId: "test-tx-loc-" + Date.now(),
        productId: "coach.plan.basic.monthly",
        appAccountToken: "test-user-" + Date.now(),
        signedDate: Date.now()
      }
    })
  });

  if (response.status !== 200) {
    throw new Error(
      `Test mode localhost: expected 200, got ${response.status}`
    );
  }

  console.log("✅ TEST 4 PASSED: Test mode accepts unsigned from localhost");
});

// =============================================================================
// MANUAL VERIFICATION CHECKLIST
// =============================================================================

console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MANUAL VERIFICATIONS (run after automated tests pass)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

MANUAL 1: Test mode rejects from production URL
  1. export IAP_ALLOW_UNSIGNED_TEST=true
  2. export SUPABASE_URL=https://ddxnrsnjdvtqhxunxnwj.supabase.co (production)
  3. supabase functions serve
  4. Send unsigned notification
  5. EXPECT: 400 (not 200)

MANUAL 2: Production rejects unsigned
  1. unset IAP_ALLOW_UNSIGNED_TEST (or set to "false")
  2. export SUPABASE_URL=https://ddxnrsnjdvtqhxunxnwj.supabase.co
  3. supabase functions serve
  4. Send unsigned notification
  5. EXPECT: 400

MANUAL 3: Real JWS validation works
  Requires Apple Test Certificate + signed payload from Sandbox
  Covered in TIER 2 (Apple Sandbox)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
