// check-entitlement — Verify Apple IAP receipt and grant access
//
// Flow:
// 1. Receive Apple receipt + appAccountToken
// 2. Verify receipt with Apple (or our backend receipt validation)
// 3. Extract subscription state from Apple response
// 4. Determine access level based on state
// 5. Update usuarios_suscripciones_iap table
// 6. Return entitlement (access: true/false, plan: basic/pro)
//
// Receipt verification: done via Apple App Store Server API (JWT validation)
// For now, we do minimal validation; full Apple verification can be added later

import { createClient } from "jsr:@supabase/supabase-js@2";

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

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ ok: false, message: "Method not allowed" }),
      { status: 405, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
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

    // STEP 1: In production, verify receipt with Apple
    // For MVP: we trust the appAccountToken + originalTransactionId match
    // TODO: Call Apple App Store Server API to verify JWT receipt

    // For now, assume receipt is valid and extract data
    // In production, this comes from Apple's JWT payload
    const subscription_state = "active"; // TODO: extract from Apple receipt
    const expires_at = new Date();
    expires_at.setDate(expires_at.getDate() + 30); // Assume monthly subscription

    // STEP 2: Determine access based on state
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
          expires_at: expires_at.toISOString(),
          renewal_date: expires_at.toISOString(),
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
          expires_at: expires_at.toISOString(),
          renewal_date: expires_at.toISOString(),
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

    // STEP 5: Return entitlement
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
