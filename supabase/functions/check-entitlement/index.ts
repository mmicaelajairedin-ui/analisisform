// check-entitlement — Verify Apple IAP subscription with App Store Server API
//
// Flow:
// 1. Validate environment (fail closed if credentials missing)
// 2. Get authenticated user from JWT
// 3. Call Apple App Store Server API to verify subscription state
// 4. Update database with Apple's authoritative state
// 5. Return entitlement (access: true/false)

import { createClient } from "jsr:@supabase/supabase-js@2";
import { Buffer } from "jsr:@std/encoding";

interface CheckRequest {
  originalTransactionId: string;
  productId: string;
}

interface CheckResponse {
  ok: boolean;
  access: boolean;
  plan?: string;
  state?: string;
  message?: string;
}

const PRODUCT_TO_PLAN = {
  "coach.plan.basic.monthly": "basic",
  "coach.plan.pro.monthly": "pro",
};

const STATES_WITH_ACCESS = ["active", "grace_period"];

/**
 * Base64url encode for JWT
 */
function base64urlEncode(data: Uint8Array): string {
  return btoa(String.fromCharCode(...data))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

/**
 * Create JWT for Apple App Store Server API authentication
 * Uses ES256 with APPLE_PRIVATE_KEY_P8
 */
async function createAppleJWT(
  issuerId: string,
  keyId: string,
  privateKeyP8: string,
  bundleId: string
): Promise<string | null> {
  try {
    // JWT header
    const header = {
      alg: "ES256",
      kid: keyId,
      typ: "JWT",
    };

    // JWT payload
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: issuerId,
      iat: now,
      exp: now + 3600, // 1 hour expiry
      aud: "appstoreconnect-v1",
    };

    // Encode header and payload
    const headerEncoded = base64urlEncode(
      new TextEncoder().encode(JSON.stringify(header))
    );
    const payloadEncoded = base64urlEncode(
      new TextEncoder().encode(JSON.stringify(payload))
    );
    const message = `${headerEncoded}.${payloadEncoded}`;

    // Import private key from PKCS#8 format
    const keyLines = privateKeyP8
      .replace(/-----BEGIN PRIVATE KEY-----/, "")
      .replace(/-----END PRIVATE KEY-----/, "")
      .replace(/\s/g, "");

    const keyData = new Uint8Array(Buffer.from(keyLines, "base64"));

    const privateKey = await crypto.subtle.importKey(
      "pkcs8",
      keyData,
      {
        name: "ECDSA",
        namedCurve: "P-256",
      },
      false,
      ["sign"]
    );

    // Sign the JWT
    const signatureBuffer = await crypto.subtle.sign(
      "ECDSA",
      privateKey,
      new TextEncoder().encode(message)
    );

    const signatureEncoded = base64urlEncode(new Uint8Array(signatureBuffer));

    return `${message}.${signatureEncoded}`;
  } catch (e) {
    console.error("[check-entitlement] JWT signing failed:", e);
    return null;
  }
}

/**
 * Call Apple App Store Server API to verify subscription
 */
async function verifyAppleSubscription(
  originalTransactionId: string,
  jwt: string,
  isProduction: boolean
): Promise<{ state: string; expiresAt: string } | null> {
  const baseUrl = isProduction
    ? "https://api.storekit.itunes.apple.com"
    : "https://api.storekit-sandbox.itunes.apple.com";

  const url = `${baseUrl}/inapp/v1/subscriptions/${originalTransactionId}`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      console.error(
        `[check-entitlement] Apple API error: ${response.status} ${response.statusText}`
      );
      return null;
    }

    const data = await response.json();

    // Extract state from Apple's response
    // Spec: https://developer.apple.com/documentation/appstoreserverapi/subscriptiongroupidentifieritem
    const lastTxn = data.data?.[0];
    if (!lastTxn) {
      console.error("[check-entitlement] No transaction data from Apple");
      return null;
    }

    // Apple states: active, grace_period, billing_retry, expired, revoked, refunded
    const state = lastTxn.lastTransactions?.[0]?.status || "expired";

    // Expiration date (milliseconds from Apple)
    const expiresAtMs = lastTxn.lastTransactions?.[0]?.expiresDate;
    const expiresAt = expiresAtMs
      ? new Date(expiresAtMs).toISOString()
      : new Date().toISOString();

    console.log(
      `[check-entitlement] Apple verification: ${originalTransactionId} -> ${state}`
    );

    return { state, expiresAt };
  } catch (error) {
    console.error("[check-entitlement] Apple API call failed:", error);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ ok: false, message: "Method not allowed" }),
      { status: 405, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    // SECURITY: Fail closed if credentials missing
    const issuerId = Deno.env.get("APPLE_ISSUER_ID");
    const keyId = Deno.env.get("APPLE_KEY_ID");
    const privateKeyP8 = Deno.env.get("APPLE_PRIVATE_KEY_P8");
    const bundleId = Deno.env.get("APPLE_BUNDLE_ID");

    if (!issuerId || !keyId || !privateKeyP8 || !bundleId) {
      console.error(
        "[check-entitlement] CRITICAL: Apple credentials not configured"
      );
      return new Response(
        JSON.stringify({
          ok: false,
          access: false,
          message: "Service configuration error",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const body: CheckRequest = await req.json();
    const { originalTransactionId, productId } = body;

    if (!originalTransactionId || !productId) {
      return new Response(
        JSON.stringify({
          ok: false,
          access: false,
          message: "Missing required fields",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Get auth
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();

    if (!token) {
      return new Response(
        JSON.stringify({
          ok: false,
          access: false,
          message: "Unauthorized",
        }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    const url = Deno.env.get("SUPABASE_URL") || "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    if (!url || !anonKey || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ ok: false, access: false, message: "Config error" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const serviceClient = createClient(url, serviceRoleKey);

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();

    if (authError || !user || !user.id) {
      return new Response(
        JSON.stringify({
          ok: false,
          access: false,
          message: "Unauthorized",
        }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    const userId = user.id;

    // STEP 1: Create Apple JWT for API authentication
    const appleJWT = await createAppleJWT(
      issuerId,
      keyId,
      privateKeyP8,
      bundleId
    );

    if (!appleJWT) {
      console.error("[check-entitlement] Failed to create Apple JWT");
      return new Response(
        JSON.stringify({
          ok: false,
          access: false,
          message: "Cannot authenticate with Apple",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // STEP 2: Verify subscription with Apple (production by default, sandbox for testing)
    const isProduction = Deno.env.get("APPLE_ENVIRONMENT") !== "sandbox";
    const appleResult = await verifyAppleSubscription(
      originalTransactionId,
      appleJWT,
      isProduction
    );

    if (!appleResult) {
      console.error(
        "[check-entitlement] Apple verification failed for",
        originalTransactionId
      );
      return new Response(
        JSON.stringify({
          ok: false,
          access: false,
          message: "Cannot verify subscription with Apple",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const subscriptionState = appleResult.state;
    const expiresAt = appleResult.expiresAt;
    const hasAccess = STATES_WITH_ACCESS.includes(subscriptionState);
    const plan = PRODUCT_TO_PLAN[productId] || "basic";

    // STEP 3: Store/update in usuarios_suscripciones_iap
    const { data: existing } = await serviceClient
      .from("usuarios_suscripciones_iap")
      .select("id")
      .eq("original_transaction_id", originalTransactionId)
      .single();

    if (existing) {
      await serviceClient
        .from("usuarios_suscripciones_iap")
        .update({
          state: subscriptionState,
          expires_at: expiresAt,
          renewal_date: expiresAt,
          updated_at: new Date().toISOString(),
        })
        .eq("original_transaction_id", originalTransactionId);
    } else {
      await serviceClient
        .from("usuarios_suscripciones_iap")
        .insert({
          usuario_id: userId,
          original_transaction_id: originalTransactionId,
          product_id: productId,
          state: subscriptionState,
          expires_at: expiresAt,
          renewal_date: expiresAt,
          environment: isProduction ? "production" : "sandbox",
          auto_renew_status: true,
          billing_cycle: "monthly",
          price_usd: plan === "pro" ? 59.99 : 29.99,
        });
    }

    // STEP 4: Update usuarios.plan projection
    if (hasAccess) {
      await serviceClient
        .from("usuarios")
        .update({
          plan: plan,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);
    }

    // STEP 5: Return entitlement
    const response: CheckResponse = {
      ok: true,
      access: hasAccess,
      plan: plan,
      state: subscriptionState,
      message: hasAccess ? "Access granted" : "No access",
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[check-entitlement] Error:", error);
    return new Response(
      JSON.stringify({
        ok: false,
        access: false,
        message: "Internal error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
