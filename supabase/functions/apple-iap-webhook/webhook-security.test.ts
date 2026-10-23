/**
 * apple-iap-webhook Security Tests
 *
 * Tests for:
 * 1. Unsigned notifications blocked (FIX 1)
 * 2. Timestamp comparison prevents stale events (FIX 2)
 * 3. Idempotency on duplicate notificationUUID
 */

// NOTE: These tests are designed to run against local Supabase
// To execute: supabase functions serve, then run separately with test runner

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  details?: Record<string, unknown>;
}

const results: TestResult[] = [];

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

// =============================================================================
// TEST 1: Unsigned notification rejected (FIX 1)
// =============================================================================

async function test_unsignedNotificationRejected() {
  const name = "TEST 1: Unsigned notification rejected";

  try {
    const response = await fetch("http://localhost:54321/functions/v1/apple-iap-webhook", {
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

    // Should reject with 400
    assert(response.status === 400, `Expected 400, got ${response.status}`);

    const body = await response.json();
    assert(
      body.error && body.error.includes("signedPayload"),
      `Expected 'signedPayload' in error, got: ${body.error}`
    );

    results.push({ name, passed: true });
  } catch (err) {
    results.push({ name, passed: false, error: String(err) });
  }
}

// =============================================================================
// TEST 2: Duplicate notifications (same UUID) produce idempotent results
// =============================================================================

async function test_duplicateNotificationIdempotent() {
  const name = "TEST 2: Duplicate notifications idempotent";

  try {
    // Scenario: Send same webhook 3× with IAP_ALLOW_UNSIGNED_TEST=true
    // Expected: 1 database row (idempotent via notificationUUID)

    const notificationUUID = "test-uuid-duplicate-" + Date.now();
    const txId = "test-tx-duplicate-" + Date.now();

    const payload = {
      notification: {
        notificationType: "SUBSCRIBED",
        notificationUUID,
        originalTransactionId: txId,
        productId: "coach.plan.basic.monthly",
        appAccountToken: "test-user-" + Date.now(),
        signedDate: Date.now() // Current timestamp
      }
    };

    // Send 3 times
    let firstResponse, secondResponse, thirdResponse;
    for (let i = 0; i < 3; i++) {
      const res = await fetch("http://localhost:54321/functions/v1/apple-iap-webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (i === 0) firstResponse = res;
      if (i === 1) secondResponse = res;
      if (i === 2) thirdResponse = res;
    }

    // All three should succeed (200 OK)
    const allOk = firstResponse?.status === 200 &&
                  secondResponse?.status === 200 &&
                  thirdResponse?.status === 200;

    // Second and third should indicate duplicate
    const secondBody = await secondResponse?.json();
    const isDuplicate = secondBody?.duplicate === true;

    results.push({
      name,
      passed: allOk && isDuplicate,
      details: {
        note: "Requires IAP_ALLOW_UNSIGNED_TEST=true",
        firstStatus: firstResponse?.status,
        secondIsDuplicate: isDuplicate
      }
    });
  } catch (err) {
    results.push({ name, passed: false, error: String(err) });
  }
}

// =============================================================================
// TEST 3: Stale events ignored (timestamp comparison, FIX 2)
// =============================================================================

async function test_staleEventIgnored() {
  const name = "TEST 3: Stale events ignored";

  try {
    // Scenario:
    // 1. Send RECENT event (notificationType=SUBSCRIBED, signedDate=now)
    // 2. Send OLD event (notificationType=EXPIRED, signedDate=10 seconds ago)
    // 3. Should ignore old event (state stays SUBSCRIBED, not EXPIRED)

    const recentDate = Date.now();
    const staleDate = recentDate - 10000; // 10 seconds older

    const txId = "test-tx-stale-" + Date.now();
    const appToken = "test-user-" + Date.now();

    // First: send RECENT SUBSCRIBED event
    const recentPayload = {
      notification: {
        notificationType: "SUBSCRIBED",
        notificationUUID: "test-uuid-recent-" + Date.now(),
        originalTransactionId: txId,
        productId: "coach.plan.basic.monthly",
        appAccountToken: appToken,
        signedDate: recentDate
      }
    };

    const recentRes = await fetch("http://localhost:54321/functions/v1/apple-iap-webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(recentPayload)
    });

    // Second: send STALE EXPIRED event (should be ignored)
    const stalePayload = {
      notification: {
        notificationType: "EXPIRED",
        notificationUUID: "test-uuid-stale-" + Date.now(),
        originalTransactionId: txId,
        productId: "coach.plan.basic.monthly",
        appAccountToken: appToken,
        signedDate: staleDate // Older timestamp
      }
    };

    const staleRes = await fetch("http://localhost:54321/functions/v1/apple-iap-webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(stalePayload)
    });

    const staleBody = await staleRes?.json();

    results.push({
      name,
      passed: recentRes?.status === 200 && staleRes?.status === 200 && staleBody?.state === "ignored_stale",
      details: {
        note: "Requires IAP_ALLOW_UNSIGNED_TEST=true",
        recentStatus: recentRes?.status,
        staleStatus: staleRes?.status,
        staleState: staleBody?.state
      }
    });
  } catch (err) {
    results.push({ name, passed: false, error: String(err) });
  }
}

// =============================================================================
// TEST 4: Unsigned allowed in TEST mode
// =============================================================================

async function test_unsignedAllowedInTestMode() {
  const name = "TEST 4: Unsigned allowed with IAP_ALLOW_UNSIGNED_TEST=true";

  try {
    // Precondition: export IAP_ALLOW_UNSIGNED_TEST=true before running

    const response = await fetch("http://localhost:54321/functions/v1/apple-iap-webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        notification: {
          notificationType: "SUBSCRIBED",
          notificationUUID: "test-uuid-unsigned-" + Date.now(),
          originalTransactionId: "test-tx-unsigned-" + Date.now(),
          productId: "coach.plan.basic.monthly",
          appAccountToken: "test-user-" + Date.now(),
          signedDate: Date.now()
        }
      })
    });

    // In test mode: should accept and insert/update
    // Expected: 200 OK

    results.push({
      name,
      passed: response.status === 200,
      details: {
        status: response.status,
        note: "Expected 200 if TEST_MODE enabled; expected 400 in production"
      }
    });
  } catch (err) {
    results.push({ name, passed: false, error: String(err) });
  }
}

// =============================================================================
// Run all tests
// =============================================================================

async function runAllTests() {
  console.log("Starting apple-iap-webhook security tests...\n");

  await test_unsignedNotificationRejected();
  await test_duplicateNotificationIdempotent();
  await test_staleEventIgnored();
  await test_unsignedAllowedInTestMode();

  // Print results
  console.log("\n" + "=".repeat(70));
  console.log("TEST RESULTS");
  console.log("=".repeat(70));

  let passed = 0;
  let failed = 0;

  for (const result of results) {
    const status = result.passed ? "✅ PASS" : "❌ FAIL";
    console.log(`\n${status}: ${result.name}`);

    if (result.error) {
      console.log(`  Error: ${result.error}`);
    }

    if (result.details) {
      for (const [key, value] of Object.entries(result.details)) {
        console.log(`  ${key}: ${JSON.stringify(value)}`);
      }
    }

    if (result.passed) passed++;
    else failed++;
  }

  console.log("\n" + "=".repeat(70));
  console.log(`Summary: ${passed} passed, ${failed} failed`);
  console.log("=".repeat(70));

  return failed === 0;
}

// Export for test runner
export { runAllTests, results };

// Run if called directly
if (import.meta.main) {
  await runAllTests();
}
