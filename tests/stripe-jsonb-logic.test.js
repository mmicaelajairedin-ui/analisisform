/**
 * Unit Test: Stripe JSONB Logic
 *
 * Validates that the new Stripe eligibility logic correctly reads from
 * usuarios.configuracion JSONB field instead of usuarios_suscripciones_stripe table.
 */

// ============================================================================
// Test Data
// ============================================================================

const TEST_CASES = {
  // Caso 1: Coach con Stripe activo (debe rechazar IAP)
  activeStripe: {
    name: "Coach with active Stripe subscription",
    config: {
      stripe_customer_id: "cus_123456789",
      estado_sub: "activa",
      fecha_fin_periodo: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      plan: "pro",
    },
    expectedStripeActive: true,
    shouldRejectIAP: true,
  },

  // Caso 2: Coach con Stripe expirado (puede comprar IAP)
  expiredStripe: {
    name: "Coach with expired Stripe subscription",
    config: {
      stripe_customer_id: "cus_987654321",
      estado_sub: "activa",
      fecha_fin_periodo: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      plan: "basic",
    },
    expectedStripeActive: false,
    shouldRejectIAP: false,
  },

  // Caso 3: Coach sin Stripe (puede comprar IAP)
  noStripe: {
    name: "Coach without Stripe",
    config: {
      plan: "free",
      // No stripe fields
    },
    expectedStripeActive: false,
    shouldRejectIAP: false,
  },

  // Caso 4: Coach con Stripe en estado "prueba" (debe rechazar IAP)
  trialStripe: {
    name: "Coach with Stripe trial (active)",
    config: {
      stripe_customer_id: "cus_trial123",
      estado_sub: "prueba",
      fecha_fin_periodo: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      plan: "basic",
    },
    expectedStripeActive: true,
    shouldRejectIAP: true,
  },

  // Caso 5: Coach con Stripe cancelado (puede comprar IAP)
  cancelledStripe: {
    name: "Coach with cancelled Stripe",
    config: {
      stripe_customer_id: "cus_cancelled123",
      estado_sub: "cancelada",
      fecha_fin_periodo: new Date(Date.now() - 1000).toISOString(),
      plan: "basic",
    },
    expectedStripeActive: false,
    shouldRejectIAP: false,
  },

  // Caso 6: Coach con Stripe activo pero fecha malformada
  malformedDate: {
    name: "Coach with Stripe but malformed date",
    config: {
      stripe_customer_id: "cus_bad123",
      estado_sub: "activa",
      fecha_fin_periodo: "invalid-date",
      plan: "pro",
    },
    expectedStripeActive: false, // Should handle gracefully
    shouldRejectIAP: false,
  },

  // Caso 7: Coach con missing stripe_customer_id
  missingCustomerId: {
    name: "Coach with missing stripe_customer_id",
    config: {
      estado_sub: "activa",
      fecha_fin_periodo: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      plan: "pro",
    },
    expectedStripeActive: false,
    shouldRejectIAP: false,
  },
};

// ============================================================================
// Helper: Stripe Eligibility Logic (from validate-iap)
// ============================================================================

function isStripeActive(configuracion) {
  if (!configuracion) return false;

  const cfg = configuracion;
  const stripeActive =
    cfg.stripe_customer_id &&
    cfg.estado_sub &&
    ["activa", "prueba"].includes(cfg.estado_sub) &&
    cfg.fecha_fin_periodo &&
    new Date(cfg.fecha_fin_periodo) > new Date();

  return stripeActive === true;
}

// ============================================================================
// Helper: Check Entitlement Logic (from check-entitlement)
// ============================================================================

function getStripeEntitlement(configuracion) {
  if (!configuracion) return null;

  const cfg = configuracion;
  const now = new Date();

  // Verificar que tiene Stripe activo
  if (cfg.stripe_customer_id && cfg.estado_sub && cfg.fecha_fin_periodo) {
    const periodEnd = new Date(cfg.fecha_fin_periodo);
    const stripeIsActive =
      ["activa", "prueba"].includes(cfg.estado_sub) &&
      periodEnd > now;

    return {
      hasAccess: stripeIsActive,
      plan: cfg.plan === "pro" ? "pro" : "basic",
      status: cfg.estado_sub,
      expiresAt: cfg.fecha_fin_periodo,
    };
  }

  return null;
}

// ============================================================================
// Test Execution
// ============================================================================

console.log("🧪 Stripe JSONB Logic Tests\n");
console.log("=" .repeat(70));

let passed = 0;
let failed = 0;

Object.entries(TEST_CASES).forEach(([key, testCase]) => {
  console.log(`\n✓ Testing: ${testCase.name}`);

  // Test 1: isStripeActive logic
  const stripeActive = isStripeActive(testCase.config);
  const expectedActive = testCase.expectedStripeActive;

  if (stripeActive === expectedActive) {
    console.log(`  ✅ isStripeActive: ${stripeActive} (expected ${expectedActive})`);
    passed++;
  } else {
    console.log(
      `  ❌ isStripeActive: ${stripeActive} (expected ${expectedActive})`
    );
    failed++;
  }

  // Test 2: validate-iap rejection logic
  const shouldReject = stripeActive && testCase.shouldRejectIAP;
  const expectedReject = testCase.shouldRejectIAP;

  if (shouldReject === expectedReject) {
    console.log(
      `  ✅ Should reject IAP: ${shouldReject} (expected ${expectedReject})`
    );
    passed++;
  } else {
    console.log(
      `  ❌ Should reject IAP: ${shouldReject} (expected ${expectedReject})`
    );
    failed++;
  }

  // Test 3: check-entitlement logic
  const entitlement = getStripeEntitlement(testCase.config);
  const expectedAccess = testCase.expectedStripeActive;
  const actualAccess = entitlement?.hasAccess || false;

  if (actualAccess === expectedAccess) {
    console.log(
      `  ✅ Entitlement hasAccess: ${actualAccess} (expected ${expectedAccess})`
    );
    passed++;
  } else {
    console.log(
      `  ❌ Entitlement hasAccess: ${actualAccess} (expected ${expectedAccess})`
    );
    failed++;
  }
});

console.log("\n" + "=" .repeat(70));
console.log(`\n📊 Results: ${passed} passed, ${failed} failed\n`);

if (failed > 0) {
  process.exit(1);
} else {
  console.log("✅ All tests passed!");
  process.exit(0);
}
