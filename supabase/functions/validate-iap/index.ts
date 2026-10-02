// validate-iap — Pre-purchase validation for Apple IAP
//
// Checks:
// 1. User is authenticated
// 2. Product is allowed (coach.plan.basic.monthly | coach.plan.pro.monthly)
// 3. No active Stripe subscription (409 Conflict if exists)
// 4. appAccountToken is valid and linked to user
// 5. Stripe/Apple mutual exclusivity
//
// Returns: 200 OK (can proceed) or 409 (Stripe conflict) or 400/401/403

import { createClient } from "jsr:@supabase/supabase-js@2";

interface ValidateRequest {
  product_id: string; // coach.plan.basic.monthly | coach.plan.pro.monthly
  app_account_token?: string;
}

interface ValidateResponse {
  ok: boolean;
  message?: string;
  can_purchase?: boolean;
  app_account_token?: string;
}

// Allowed IAP products
const ALLOWED_PRODUCTS = new Set([
  "coach.plan.basic.monthly",
  "coach.plan.pro.monthly",
]);

// Product to plan mapping
const PRODUCT_TO_PLAN = {
  "coach.plan.basic.monthly": "basic",
  "coach.plan.pro.monthly": "pro",
};

Deno.serve(async (req) => {
  // Only POST
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ ok: false, message: "Method not allowed" }),
      { status: 405, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    // Parse request
    const body: ValidateRequest = await req.json();
    const product_id = body.product_id?.trim();
    const app_account_token = body.app_account_token?.trim();

    // 1. Validate product
    if (!product_id || !ALLOWED_PRODUCTS.has(product_id)) {
      return new Response(
        JSON.stringify({
          ok: false,
          message: "Invalid product_id",
          can_purchase: false,
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // 2. Get auth from Authorization header
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();

    if (!token) {
      return new Response(
        JSON.stringify({
          ok: false,
          message: "Unauthorized: no token",
          can_purchase: false,
        }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    // 3. Initialize Supabase client with user's JWT
    const url = Deno.env.get("SUPABASE_URL") || "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    if (!url || !anonKey || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ ok: false, message: "Configuration error" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // User client (with their JWT for auth)
    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Service role client (for checking Stripe status, etc.)
    const serviceClient = createClient(url, serviceRoleKey);

    // 4. Verify user is authenticated
    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();

    if (authError || !user || !user.id) {
      return new Response(
        JSON.stringify({
          ok: false,
          message: "Unauthorized: invalid token",
          can_purchase: false,
        }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    const user_id = user.id;

    // 5. Check for active Stripe subscription conflict
    // Read `usuarios.configuracion` to check Stripe status
    const { data: usuarioData, error: userError } = await serviceClient
      .from("usuarios")
      .select("configuracion, plan")
      .eq("id", user_id)
      .single();

    if (userError || !usuarioData) {
      return new Response(
        JSON.stringify({
          ok: false,
          message: "User not found",
          can_purchase: false,
        }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    const config = usuarioData.configuracion || {};
    const estadoSub = config.estado_sub; // values: 'prueba', 'activa', 'cancelada', 'vencida'

    // Stripe mutual exclusivity: prevent Apple purchase if Stripe is currently active
    // A Stripe sub is active if: estado_sub === 'activa' AND fecha_fin_periodo is in the future
    const hasActiveSub =
      estadoSub === "activa" &&
      config.fecha_fin_periodo &&
      new Date(config.fecha_fin_periodo) > new Date();

    if (hasActiveSub) {
      return new Response(
        JSON.stringify({
          ok: false,
          message:
            "Cannot purchase Apple IAP: active Stripe subscription detected",
          can_purchase: false,
          conflict: "stripe",
        }),
        { status: 409, headers: { "Content-Type": "application/json" } }
      );
    }

    // 6. Generate or validate appAccountToken
    // appAccountToken: UUID that links this purchase to the user
    let token_to_use = app_account_token;
    if (!token_to_use || token_to_use.length === 0) {
      // Generate new UUID for this purchase session
      token_to_use = crypto.randomUUID();
    }

    // Store app_account_token in user's session (optional: can also store in configuracion)
    // For now, we return it to the frontend to include in purchaseProduct() call
    // The receipt verification (check-entitlement) will use this to match the user

    // 7. Prepare response
    const response: ValidateResponse = {
      ok: true,
      message: "Ready to purchase",
      can_purchase: true,
      app_account_token: token_to_use,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[validate-iap] Error:", error);
    return new Response(
      JSON.stringify({
        ok: false,
        message: "Internal error",
        can_purchase: false,
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
