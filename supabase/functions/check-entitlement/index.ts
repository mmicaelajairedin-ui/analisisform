// check-entitlement — Verify Apple IAP subscription and grant access
//
// Flow:
// 1. Receive originalTransactionId from client
// 2. Verify subscription state via Apple App Store Server API (authoritative)
// 3. Extract subscription state from Apple response
// 4. Determine access level based on state
// 5. Update usuarios_suscripciones_iap table
// 6. Return entitlement (access: true/false, plan: basic/pro)
//
// Source of truth: Apple App Store Server API (not client claims)
// Must have APPLE_ISSUER_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY_P8 as environment variables

import { createClient } from "jsr:@supabase/supabase-js@2";
import { Buffer } from "jsr:@std/encoding";

interface CheckRequest {
  app_account_token: string;
  original_transaction_id: string; // Apple's unique ID
  product_id: string; // coach.plan.basic.monthly | coach.plan.pro.monthly
  // In production: receipt (JWT from Apple), signedDate, etc.
}

interface CheckResponse {
  ok: boolean;
  access: boolean; // true = grant access
  plan?: string; // basic | pro
  message?: string;
  state?: string; // subscription state
}

const PRODUCT_TO_PLAN = {
  "coach.plan.basic.monthly": "basic",
  "coach.plan.pro.monthly": "pro",
};

// States that grant access
const STATES_WITH_ACCESS = ["active", "grace_period"];
// States that deny access
const STATES_NO_ACCESS = ["expired", "revoked", "refunded", "billing_retry"];

/**
 * Create JWT for Apple App Store Server API authentication
 * Signed with APPLE_PRIVATE_KEY_P8 (private key from App Store Connect)
 *
 * Required environment variables:
 * - APPLE_ISSUER_ID: your App Store Connect Issuer ID (UUID format)
 * - APPLE_KEY_ID: your private key ID from App Store Connect
 * - APPLE_PRIVATE_KEY_P8: private key in PKCS#8 format (from App Store Connect)
 * - APPLE_BUNDLE_ID: your app's bundle ID (e.g., com.pathway.coach)
 */
async function createAppleJWT(issuerId: string, keyId: string, privateKeyP8: string): Promise<string> {
  // JWT header
  const header = {
    alg: "ES256",
    kid: keyId,
    typ: "JWT",
  };

  // JWT payload (claims)
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: issuerId,
    iat: now,
    exp: now + 3600, // 1 hour expiry
    aud: "appstoreconnect-v1",
  };

  // Encode header and payload
  const headerStr = btoa(JSON.stringify(header));
  const payloadStr = btoa(JSON.stringify(payload));
  const message = `${headerStr}.${payloadStr}`;

  // TODO: Sign with ES256 using APPLE_PRIVATE_KEY_P8
  // This requires crypto.subtle.sign() with the private key
  // For now: return placeholder (production must implement proper signing)
  console.warn("[check-entitlement] JWT signing not yet implemented");

  // Return unsigned JWT (development only)
  return message + ".placeholder_signature";
}

/**
 * Call Apple App Store Server API to verify subscription
 * Endpoint: GET /inapp/v1/subscriptions/{originalTransactionId}
 *
 * Requires valid JWT token from createAppleJWT()
 */
async function verifyAppleSubscription(
  originalTransactionId: string,
  jwt: string
): Promise<{ state: string; expiresAt: string } | null> {
  const bundleId = Deno.env.get("APPLE_BUNDLE_ID") || "";
  if (!bundleId) {
    console.error("[check-entitlement] APPLE_BUNDLE_ID not configured");
    return null;
  }

  const url = `https://api.storekit.itunes.apple.com/inapp/v1/subscriptions/${originalTransactionId}`;

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

    // Extract subscription state from Apple's response
    // Spec: https://developer.apple.com/documentation/appstoreserverapi/subscriptiongroupidentifieritem
    const state = data.lastTransactions?.[0]?.status || "expired";
    const expiresAt = data.lastTransactions?.[0]?.expiresDate
      ? new Date(data.lastTransactions[0].expiresDate).toISOString()
      : new Date().toISOString();

    console.log(`[check-entitlement] Apple verification: ${originalTransactionId} -> ${state}`);

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
      console.error("[check-entitlement] CRITICAL: Apple credentials not configured");
      return new Response(
        JSON.stringify({
          ok: false,
          access: false,
          message: "Service configuration error (credentials missing)",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const body: CheckRequest = await req.json();
    const { app_account_token, original_transaction_id, product_id } = body;

    // Validate inputs
    if (!app_account_token || !original_transaction_id || !product_id) {
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

    const user_id = user.id;

    // STEP 1: Verify subscription with Apple App Store Server API (source of truth)
    const appleJWT = await createAppleJWT(issuerId, keyId, privateKeyP8);
    const appleResult = await verifyAppleSubscription(original_transaction_id, appleJWT);

    if (!appleResult) {
      console.error("[check-entitlement] Apple verification failed for", original_transaction_id);
      // Fail closed: cannot verify with Apple = deny access
      return new Response(
        JSON.stringify({
          ok: false,
          access: false,
          message: "Cannot verify subscription with Apple",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const subscription_state = appleResult.state;
    const expires_at = appleResult.expiresAt;

    // STEP 2: Determine access based on Apple's state
    const has_access = STATES_WITH_ACCESS.includes(subscription_state);
    const plan = PRODUCT_TO_PLAN[product_id] || "basic";

    // STEP 3: Store/update in usuarios_suscripciones_iap
    const {
      data: existing,
      error: queryError,
    } = await serviceClient
      .from("usuarios_suscripciones_iap")
      .select("id")
      .eq("original_transaction_id", original_transaction_id)
      .single();

    if (queryError && queryError.code !== "PGRST116") {
      // PGRST116 = not found (expected on first purchase)
      console.error("[check-entitlement] Query error:", queryError);
    }

    if (existing) {
      // Update existing
      const { error: updateError } = await serviceClient
        .from("usuarios_suscripciones_iap")
        .update({
          state: subscription_state,
          expires_at: expires_at,
          renewal_date: expires_at,
          updated_at: new Date().toISOString(),
        })
        .eq("original_transaction_id", original_transaction_id);

      if (updateError) {
        console.error("[check-entitlement] Update error:", updateError);
        return new Response(
          JSON.stringify({
            ok: false,
            access: false,
            message: "Failed to update subscription",
          }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }
    } else {
      // Create new
      const { error: insertError } = await serviceClient
        .from("usuarios_suscripciones_iap")
        .insert({
          usuario_id: user_id,
          app_account_token,
          original_transaction_id,
          product_id,
          state: subscription_state,
          expires_at: expires_at,
          renewal_date: expires_at,
          environment: "production",
          auto_renew_status: true,
          billing_cycle: "monthly",
          price_usd: plan === "pro" ? 59.99 : 29.99,
        });

      if (insertError) {
        console.error("[check-entitlement] Insert error:", insertError);
        return new Response(
          JSON.stringify({
            ok: false,
            access: false,
            message: "Failed to save subscription",
          }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // STEP 4: Update usuarios.plan as a projection (not authority)
    if (has_access) {
      const { error: updateUserError } = await serviceClient
        .from("usuarios")
        .update({
          plan: plan,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user_id);

      if (updateUserError) {
        console.error("[check-entitlement] User update error:", updateUserError);
        // Don't fail; continue - the subscription is recorded
      }
    }

    // STEP 5: Return entitlement (Apple's state is authoritative)
    const response: CheckResponse = {
      ok: true,
      access: has_access,
      plan: plan,
      state: subscription_state,
      message: has_access ? "Access granted" : "No access",
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
