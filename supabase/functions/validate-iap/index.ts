// validate-iap — Generate/validate appAccountToken for StoreKit 2 IAP flow
//
// This function is called BEFORE purchase to generate the appAccountToken
// that ties the transaction to the user. Returns a UUID that becomes the
// appAccountToken passed to StoreKit.
//
// Flow:
// 1. Client calls validate-iap with JWT
// 2. Backend extracts user.id from JWT
// 3. Backend returns user.id as appAccountToken (already a UUID)
// 4. Client passes appAccountToken to StoreKit.Product.purchase()
// 5. StoreKit embeds appAccountToken in JWS transactionInfo
// 6. Client sends JWS to check-entitlement
// 7. check-entitlement verifies appAccountToken = user.id

import { createClient } from "jsr:@supabase/supabase-js@2";

interface ValidateRequest {
  // No body needed — JWT is the credential
}

interface ValidateResponse {
  ok: boolean;
  appAccountToken?: string;
  message?: string;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ ok: false, message: "Method not allowed" }),
      { status: 405, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const url = Deno.env.get("SUPABASE_URL") || "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";

    if (!url || !anonKey) {
      return new Response(
        JSON.stringify({ ok: false, message: "Config error" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Get auth header
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();

    if (!token) {
      return new Response(
        JSON.stringify({
          ok: false,
          message: "Unauthorized",
        }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    // Create client with auth header
    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();

    if (authError || !user || !user.id) {
      console.error("[validate-iap] Auth error:", authError);
      return new Response(
        JSON.stringify({
          ok: false,
          message: "Unauthorized",
        }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    const userId = user.id;

    // Validate that userId is a valid UUID (appAccountToken must be UUID)
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId)) {
      console.error("[validate-iap] userId is not a valid UUID:", userId);
      return new Response(
        JSON.stringify({
          ok: false,
          message: "Invalid user ID format",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log(`[validate-iap] ✓ Generated appAccountToken for user ${userId}`);

    const response: ValidateResponse = {
      ok: true,
      appAccountToken: userId,
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
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
