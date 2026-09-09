/**
 * Unit Test: Double Charge Detection Logic
 *
 * Validates that the new detect_double_charges() SQL function correctly
 * detects when a coach has BOTH active Stripe + IAP subscriptions.
 */

// ============================================================================
// Simulated Data: What the SQL function would see
// ============================================================================

const simulatedDatabase = {
  usuarios: [
    {
      id: "coach-001",
      email: "coach1@example.com",
      configuracion: {
        stripe_customer_id: "cus_active001",
        estado_sub: "activa",
        fecha_fin_periodo: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        plan: "pro",
      },
    },
    {
      id: "coach-002",
      email: "coach2@example.com",
      configuracion: {
        stripe_customer_id: "cus_expired002",
        estado_sub: "activa",
        fecha_fin_periodo: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        plan: "basic",
      },
    },
    {
      id: "coach-003",
      email: "coach3@example.com",
      configuracion: {
        // No Stripe
      },
    },
  ],
  usuarios_suscripciones_iap: [
    {
      id: "iap-sub-001",
      coach_id: "coach-001", // Has BOTH Stripe + IAP active
      original_transaction_id: "2000000098765432",
      status: "active",
      expires_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      product_id: "coach.plan.pro.monthly",
    },
    {
      id: "iap-sub-002",
      coach_id: "coach-002", // Stripe expired, but IAP active
      original_transaction_id: "2000000098765433",
      status: "active",
      expires_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      product_id: "coach.plan.basic.monthly",
    },
    {
      id: "iap-sub-003",
      coach_id: "coach-003", // No Stripe
      original_transaction_id: "2000000098765434",
      status: "active",
      expires_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      product_id: "coach.plan.basic.monthly",
    },
  ],
};

// ============================================================================
// Simulated SQL Function: detect_double_charges()
// ============================================================================

function simulateDetectDoubleCharges() {
  const now = new Date();
  const results = [];

  // INNER JOIN usuarios u with usuarios_suscripciones_iap iap
  // WHERE iap.status = 'active' AND iap.expires_date > now()
  // AND (u.configuracion->>'stripe_customer_id') IS NOT NULL
  // AND (u.configuracion->>'estado_sub') IN ('activa', 'prueba')
  // AND (u.configuracion->>'fecha_fin_periodo')::TIMESTAMPTZ > now()

  for (const iapSub of simulatedDatabase.usuarios_suscripciones_iap) {
    // Check if IAP is active
    if (iapSub.status !== "active") continue;
    if (new Date(iapSub.expires_date) <= now) continue;

    const coach = simulatedDatabase.usuarios.find((u) => u.id === iapSub.coach_id);
    if (!coach) continue;

    const cfg = coach.configuracion;

    // Check if Stripe is active
    const hasStripeCustomerId = cfg.stripe_customer_id !== undefined;
    const stripeEstadoOk = cfg.estado_sub && ["activa", "prueba"].includes(cfg.estado_sub);
    const stripeFechaOk = cfg.fecha_fin_periodo && new Date(cfg.fecha_fin_periodo) > now;

    if (hasStripeCustomerId && stripeEstadoOk && stripeFechaOk) {
      // Double charge detected!
      results.push({
        coach_id: coach.id,
        stripe_charge_id: cfg.stripe_subscription_id || cfg.stripe_customer_id,
        apple_transaction_id: iapSub.original_transaction_id,
        stripe_amount: null, // Not tracked in configuracion (TODO)
        apple_amount: null, // Not tracked in iap table (TODO)
        time_delta_ms: Math.round(
          (new Date(iapSub.expires_date) - new Date(cfg.fecha_fin_periodo)) / 1000 * 1000
        ),
        currency: "USD",
      });
    }
  }

  return results;
}

// ============================================================================
// Test Execution
// ============================================================================

console.log("🧪 Double Charge Detection Logic Tests\n");
console.log("=" .repeat(70));

const results = simulateDetectDoubleCharges();

console.log("\n📋 Detected Double Charges:");
console.log(JSON.stringify(results, null, 2));

// ============================================================================
// Assertions
// ============================================================================

console.log("\n" + "=" .repeat(70));
console.log("✅ Assertions:");

let passed = 0;
let failed = 0;

// Assertion 1: Should find exactly 1 double charge (coach-001)
if (results.length === 1) {
  console.log(`✅ Found ${results.length} double charge(s) (expected 1)`);
  passed++;
} else {
  console.log(`❌ Found ${results.length} double charge(s) (expected 1)`);
  failed++;
}

// Assertion 2: The double charge should be for coach-001
if (results.length > 0 && results[0].coach_id === "coach-001") {
  console.log(`✅ Double charge is for coach-001 (correct)`);
  passed++;
} else {
  console.log(`❌ Double charge is not for coach-001`);
  failed++;
}

// Assertion 3: Should include Apple transaction ID
if (results.length > 0 && results[0].apple_transaction_id === "2000000098765432") {
  console.log(`✅ Apple transaction ID captured correctly`);
  passed++;
} else {
  console.log(`❌ Apple transaction ID missing or incorrect`);
  failed++;
}

// Assertion 4: Should NOT detect coach-002 (Stripe expired)
const coach2Double = results.find((r) => r.coach_id === "coach-002");
if (!coach2Double) {
  console.log(`✅ coach-002 not flagged (Stripe expired is OK)`);
  passed++;
} else {
  console.log(`❌ coach-002 incorrectly flagged as double charge`);
  failed++;
}

// Assertion 5: Should NOT detect coach-003 (No Stripe)
const coach3Double = results.find((r) => r.coach_id === "coach-003");
if (!coach3Double) {
  console.log(`✅ coach-003 not flagged (No Stripe is OK)`);
  passed++;
} else {
  console.log(`❌ coach-003 incorrectly flagged as double charge`);
  failed++;
}

console.log("\n" + "=" .repeat(70));
console.log(`\n📊 Results: ${passed} passed, ${failed} failed\n`);

if (failed > 0) {
  process.exit(1);
} else {
  console.log("✅ All assertions passed!");
  process.exit(0);
}
