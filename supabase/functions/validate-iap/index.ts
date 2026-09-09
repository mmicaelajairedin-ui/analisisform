/**
 * IAP Purchase Validation Endpoint
 *
 * Llamado por el cliente iOS DESPUÉS de comprar en App Store Connect.
 * Valida que el servidor acepta la suscripción e inserta en BD.
 *
 * Request (POST):
 * {
 *   "originalTransactionId": "...",
 *   "appAccountToken": "...",
 *   "productId": "coach.plan.basic.monthly" | "coach.plan.pro.monthly",
 *   "bundleId": "com.pathwaycareercoach.ios",
 *   "expiresDate": 1693958400000 (ms epoch),
 *   "purchaseDate": 1693353600000 (ms epoch),
 *   "environment": "sandbox" | "production",
 *   "transactionJWT": "..." (optional, para validación adicional)
 * }
 *
 * Response (200 OK):
 * {
 *   "valid": true,
 *   "coach_id": "...",
 *   "subscription_id": "...",
 *   "status": "active",
 *   "expires_at": "2026-09-15T..."
 * }
 *
 * Response (4xx/5xx):
 * {
 *   "valid": false,
 *   "error": "...",
 *   "statusCode": 400
 * }
 *
 * Seguridad:
 * - Requiere Supabase Auth JWT (user está autenticado)
 * - Valida que appAccountToken coincida con el token en BD
 * - Verifica elegibilidad: no puede tener Stripe activo
 * - Usa service role para insertar (RLS bypassed but audited)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { PRODUCT_IDS, APPLE_BUNDLE_ID, SubscriptionStatus, validateEnvironment } from "../_shared/iap-types.ts";

// ============================================================================
// Request Handler
// ============================================================================

Deno.serve(async (req: Request) => {
  try {
    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    // 1. Parse request
    const body = await req.json();
    const {
      originalTransactionId,
      appAccountToken,
      productId,
      bundleId,
      expiresDate,
      purchaseDate,
      environment,
      transactionJWT,
    } = body;

    console.log(`[validate-iap] Purchase validation for product ${productId}`);

    // Validar campos requeridos
    if (
      !originalTransactionId ||
      !appAccountToken ||
      !productId ||
      !expiresDate ||
      !purchaseDate
    ) {
      return errorResponse("Missing required fields", 400);
    }

    // Validar bundle ID
    if (bundleId && bundleId !== APPLE_BUNDLE_ID) {
      return errorResponse("Invalid bundle ID", 400);
    }

    // Validar product ID
    if (!Object.values(PRODUCT_IDS).includes(productId)) {
      return errorResponse("Invalid product ID", 400);
    }

    // Validar dates
    const expiresAt = new Date(expiresDate);
    const purchasedAt = new Date(purchaseDate);

    if (isNaN(expiresAt.getTime()) || isNaN(purchasedAt.getTime())) {
      return errorResponse("Invalid date format", 400);
    }

    if (expiresAt <= new Date()) {
      return errorResponse("Subscription already expired", 400);
    }

    // 2. Conectar a Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.error("[validate-iap] Missing Supabase env vars");
      return errorResponse("Server configuration error", 500);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // 3. Obtener auth info del header Authorization
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return errorResponse("Missing or invalid Authorization header", 401);
    }

    const token = authHeader.slice(7);
    let authUser;

    try {
      // Verificar el JWT usando Supabase
      const { data: userData, error: userError } = await supabase.auth.getUser(token);
      if (userError || !userData.user) {
        return errorResponse("Invalid auth token", 401);
      }
      authUser = userData.user;
    } catch (e) {
      return errorResponse("Auth verification failed", 401);
    }

    // 4. Resolver coach_id desde appAccountToken
    const { data: userRow, error: userError } = await supabase
      .from("usuarios")
      .select("id, app_account_token, payment_source")
      .eq("app_account_token", appAccountToken)
      .single();

    if (userError || !userRow) {
      console.error("[validate-iap] Coach not found with appAccountToken:", appAccountToken);
      return errorResponse(
        "Coach not found or app_account_token mismatch",
        403
      );
    }

    const coachId = userRow.id;

    // 5. Verificar que el usuario autenticado es el mismo que el coach
    // (si auth_id está seteado)
    const { data: authCoach, error: authError } = await supabase
      .from("usuarios")
      .select("id")
      .eq("id", coachId)
      .eq("auth_id", authUser.id)
      .single();

    if (authError && authError.code !== "PGRST116") {
      // PGRST116 = not found (ok if no auth_id yet), other errors = problem
      return errorResponse("Auth verification error", 500);
    }

    if (!authCoach && userRow.app_account_token) {
      // Auth mismatch: appAccountToken pertenece a otro usuario
      console.error(
        `[validate-iap] Auth mismatch: token belongs to coach ${coachId}, but auth.uid is ${authUser.id}`
      );
      return errorResponse("Unauthorized", 403);
    }

    // 6. Verificar elegibilidad: ¿Tiene Stripe activo?
    // Consultar usuarios.configuracion JSONB para ver si tiene Stripe activo
    const { data: userStripeData, error: stripeError } = await supabase
      .from("usuarios")
      .select("configuracion")
      .eq("id", coachId)
      .single();

    // Determinar si Stripe está activo basándose en JSONB
    if (!stripeError && userStripeData?.configuracion) {
      const cfg = userStripeData.configuracion;
      const stripeActive =
        cfg.stripe_customer_id &&
        cfg.estado_sub &&
        ["activa", "prueba"].includes(cfg.estado_sub) &&
        cfg.fecha_fin_periodo &&
        new Date(cfg.fecha_fin_periodo) > new Date();

      if (stripeActive) {
        return errorResponse(
          "Cannot purchase IAP while active Stripe subscription exists",
          409
        );
      }
    }

    // 7. Verificar si ya tiene IAP activo (upgrade/downgrade case)
    const { data: existingIAP, error: existingError } = await supabase
      .from("usuarios_suscripciones_iap")
      .select("id, status, product_id, original_transaction_id")
      .eq("coach_id", coachId)
      .eq("status", "active")
      .single();

    // Si existe subscription con diferente transactionId → posible upgrade/downgrade
    // Por ahora, rechazamos (TODO: implementar upgrade logic)
    if (existingIAP && !existingError) {
      if (existingIAP.original_transaction_id !== originalTransactionId) {
        console.log(
          `[validate-iap] Upgrade detected: ${existingIAP.product_id} → ${productId}`
        );
        // TODO: Marcar antigua como "upgraded", crear nueva
        return errorResponse("Upgrade not yet supported, please cancel old subscription first", 409);
      }

      // Misma transactionId → probablemente reintento de validación
      console.log(`[validate-iap] Revalidation of same transaction ${originalTransactionId}`);
      return successResponse(coachId, existingIAP.id, existingIAP.status, expiresAt);
    }

    // 8. Insertar nueva suscripción
    const { data: newSubscription, error: insertError } = await supabase
      .from("usuarios_suscripciones_iap")
      .insert({
        coach_id: coachId,
        original_transaction_id: originalTransactionId,
        app_account_token: appAccountToken,
        product_id: productId,
        bundle_id: APPLE_BUNDLE_ID,
        status: SubscriptionStatus.ACTIVE,
        purchase_date: purchasedAt.toISOString(),
        expires_date: expiresAt.toISOString(),
        environment: environment || "sandbox",
        payment_source: "apple_iap",
      });

    if (insertError) {
      // Verificar si es UNIQUE violation en original_transaction_id
      if (insertError.code === "23505") {
        console.log(
          `[validate-iap] Duplicate transaction ID ${originalTransactionId}, fetching existing`
        );
        const { data: existing } = await supabase
          .from("usuarios_suscripciones_iap")
          .select("id, status")
          .eq("original_transaction_id", originalTransactionId)
          .single();

        if (existing) {
          return successResponse(coachId, existing.id, existing.status, expiresAt);
        }
      }

      console.error("[validate-iap] Insert error:", insertError);
      return errorResponse("Failed to create subscription", 500);
    }

    if (!newSubscription || newSubscription.length === 0) {
      return errorResponse("Subscription creation returned no data", 500);
    }

    const subscriptionId = newSubscription[0].id;

    console.log(
      `[validate-iap] Successfully validated purchase: coach=${coachId}, subscription=${subscriptionId}`
    );

    return successResponse(coachId, subscriptionId, SubscriptionStatus.ACTIVE, expiresAt);

  } catch (error) {
    console.error("[validate-iap] Unhandled error:", error);
    return errorResponse(
      "Internal server error: " + (error instanceof Error ? error.message : "Unknown"),
      500
    );
  }
});

// ============================================================================
// Response Helpers
// ============================================================================

function successResponse(
  coachId: string,
  subscriptionId: string,
  status: SubscriptionStatus,
  expiresAt: Date
) {
  return new Response(
    JSON.stringify({
      valid: true,
      coach_id: coachId,
      subscription_id: subscriptionId,
      status: status,
      expires_at: expiresAt.toISOString(),
      message: "Purchase validated successfully",
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  );
}

function errorResponse(error: string, statusCode: number) {
  return new Response(
    JSON.stringify({
      valid: false,
      error: error,
      statusCode: statusCode,
    }),
    {
      status: statusCode,
      headers: { "Content-Type": "application/json" },
    }
  );
}

// ============================================================================
// Notes
// ============================================================================
//
// 1. Flujo esperado:
//    a) User compra en App Store (SKPaymentTransactionPurchased)
//    b) iOS extrae originalTransactionId, appAccountToken, etc.
//    c) iOS llama a validate-iap con los datos
//    d) Si 200 OK → marcar como consumida, limpiar en App Store
//    e) Si 4xx/5xx → reintentar (iOS maneja reintentos)
//
// 2. Seguridad de identidad:
//    - appAccountToken es UUID que el servidor genera (único por coach)
//    - iOS lo obtiene de localStorage o keychain
//    - validate-iap verifica que coincide con BD
//    - originalTransactionId es único en Apple, no generado por cliente
//
// 3. Cambios de plan (upgrade/downgrade):
//    - Hoy rechazamos (409)
//    - TODO: Implementar: marcar antigua como refunded/upgraded, crear nueva
//    - Apple manda evento DID_CHANGE_RENEWAL_PREF cuando coach actualiza plan
//
// 4. Errores a reintentar (cliente iOS):
//    - 500+ : error temporal, reintentar
//    - 401 : auth error (token expirado), refrescar y reintentar
//    - 409 : conflict (Stripe activo, upgrade no soportado), NO reintentar
//    - 400 : bad request (datos inválidos), NO reintentar
//
// 5. Timestamp:
//    - expiresDate en ms epoch (Apple SDK proporciona)
//    - purchaseDate en ms epoch
//    - Convertir a Date JS, luego a ISO string para BD
