/**
 * Apple IAP Webhook Handler
 *
 * Recibe notificaciones de Apple Server Notifications V2.
 * Valida JWT, extrae datos, actualiza estado de suscripción.
 *
 * Endpoint: POST https://api.pathwaycareercoach.com/functions/v1/apple-iap-webhook
 *
 * Flujo:
 * 1. Recibe POST body (JSON with signedPayload field containing JWT)
 * 2. Valida firma del JWT contra certificado público de Apple
 * 3. Extrae notificationType, originalTransactionId, appAccountToken
 * 4. Inserta en app_store_server_notifications (dedup vía UNIQUE notification_id)
 * 5. Actualiza usuarios_suscripciones_iap con nuevo estado
 * 6. Retorna 200 OK a Apple (importante: no reintentar después)
 *
 * Seguridad:
 * - JWT validation: firma verificada contra Apple public key
 * - Idempotencia: notification_id UNIQUE → duplicates rechazados automáticamente
 * - appAccountToken validation: debe existir en usuarios.app_account_token
 * - RLS: service role bypasses, pero writes son auditadas
 * - Replay protection: timestamp + notification_id + env
 *
 * Errores manejados:
 * - Invalid JWT: 401 (Apple retry)
 * - Duplicate notification: 409 (Apple stops retrying, we ignore)
 * - Database error: 500 (Apple retry)
 * - Unknown coach: 202 Accepted (don't retry, audit for manual review)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { validateAppleJWT, extractAppAccountToken, extractOriginalTransactionId, extractExpiresDate, validateEnvironment } from "../_shared/apple-jwt-validator.ts";
import { AppleNotificationType, SubscriptionStatus, AppStoreServerNotification, UsuariosSuscripcionesIAP, notificationTypeToStatus, PRODUCT_IDS } from "../_shared/iap-types.ts";

// ============================================================================
// Request Handler
// ============================================================================

Deno.serve(async (req: Request) => {
  try {
    // Solo POST
    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    // 1. Parsear request
    const body = await req.json();
    const signedPayload = body.signedPayload;

    if (!signedPayload) {
      return new Response(
        JSON.stringify({ error: "Missing signedPayload" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log(`[apple-iap-webhook] Received notification`);

    // 2. Validar JWT (firma + claims)
    let payload;
    try {
      payload = await validateAppleJWT(signedPayload, {
        expectedBundleId: Deno.env.get("APPLE_BUNDLE_ID") || "com.pathwaycareercoach.ios",
        validateExpiration: true,
      });
    } catch (e) {
      console.error("[apple-iap-webhook] JWT validation failed:", e);
      return new Response(
        JSON.stringify({ error: "Invalid JWT signature", details: e.message }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    // 3. Extraer datos del payload
    const notificationType = payload.notificationType as AppleNotificationType;
    const notificationUUID = payload.notificationUUID || payload.data?.notificationUUID;
    const data = payload.data as any || {};
    const appAccountToken = extractAppAccountToken(payload);
    const originalTransactionId = extractOriginalTransactionId(payload);
    const expiresDate = extractExpiresDate(payload);
    const environment = data.environment === "Sandbox" ? "sandbox" : "production";

    if (!notificationType || !notificationUUID) {
      return new Response(
        JSON.stringify({ error: "Missing notificationType or notificationUUID" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log(`[apple-iap-webhook] Notification: ${notificationType} (${notificationUUID})`);

    // 4. Conectar a Supabase (service role para bypassear RLS)
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.error("[apple-iap-webhook] Missing Supabase env vars");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // 5. Resolver identidad: appAccountToken → usuarios.app_account_token → coach_id
    let coachId: string | null = null;
    if (appAccountToken) {
      const { data: userRow, error: userError } = await supabase
        .from("usuarios")
        .select("id")
        .eq("app_account_token", appAccountToken)
        .single();

      if (userError) {
        console.error("[apple-iap-webhook] Coach lookup failed:", userError);
        // Coach doesn't exist yet (maybe first purchase) → accept but don't process
        // Audit for manual review
      } else if (userRow) {
        coachId = userRow.id;
      }
    }

    // 6. Insertar en app_store_server_notifications (audit log)
    const { data: notifRow, error: notifError } = await supabase
      .from("app_store_server_notifications")
      .insert({
        notification_id: notificationUUID,
        coach_id: coachId,
        original_transaction_id: originalTransactionId,
        bundle_id: data.bundleId || "com.pathwaycareercoach.ios",
        notification_type: notificationType,
        sub_type: payload.subtype || null,
        raw_payload: payload,
        data: data,
        processed: false,
        environment: environment,
      });

    if (notifError) {
      if (notifError.code === "23505") {
        // UNIQUE constraint violation → notification_id duplicate
        console.log(
          `[apple-iap-webhook] Duplicate notification (${notificationUUID}), ignoring`
        );
        // Return 200 OK (Apple stops retrying)
        return new Response(
          JSON.stringify({ status: "duplicate", notificationId: notificationUUID }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      console.error("[apple-iap-webhook] Failed to insert notification:", notifError);
      return new Response(
        JSON.stringify({ error: "Database error", details: notifError.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // 7. Procesar notificación (actualizar usuarios_suscripciones_iap)
    if (!coachId) {
      console.warn(
        `[apple-iap-webhook] No coach found for token ${appAccountToken}. Marking as unprocessed.`
      );
      // Actualizamos el registro como no procesado (requiere revisión manual)
      await supabase
        .from("app_store_server_notifications")
        .update({ processing_error: "Coach not found" })
        .eq("notification_id", notificationUUID);

      // Retornar 202 Accepted (no reintentar)
      return new Response(
        JSON.stringify({
          status: "accepted_unprocessed",
          reason: "Coach not found",
          notificationId: notificationUUID,
        }),
        { status: 202, headers: { "Content-Type": "application/json" } }
      );
    }

    // Procesar según tipo de evento
    const newStatus = notificationTypeToStatus(notificationType);
    const updateData: Record<string, any> = {
      status: newStatus,
      last_notification_type: notificationType,
      last_webhook_at: new Date().toISOString(),
      error_message: null, // Clear previous errors
    };

    // Casos especiales
    switch (notificationType) {
      case AppleNotificationType.SUBSCRIBED:
      case AppleNotificationType.DID_RENEW:
      case AppleNotificationType.DID_RECOVER:
        // Suscripción activa
        if (expiresDate) {
          updateData.expires_date = new Date(expiresDate).toISOString();
        }
        updateData.grace_period_expires_at = null;
        break;

      case AppleNotificationType.DID_FAIL_TO_RENEW:
        // Falla de billing, pero no actualizar expires_date (Apple entra en grace period)
        // El cliente sigue teniendo acceso durante 3 días
        updateData.status = SubscriptionStatus.GRACE_PERIOD;
        break;

      case AppleNotificationType.GRACE_PERIOD_EXPIRED:
        // Grace period terminó, expiró
        updateData.status = SubscriptionStatus.EXPIRED;
        break;

      case AppleNotificationType.EXPIRED:
        // Expiración normal
        updateData.status = SubscriptionStatus.EXPIRED;
        break;

      case AppleNotificationType.DID_CHANGE_RENEWAL_STATUS:
        // Coach deshabilitó renovación, pero sigue activo hasta expires_date
        if (data.autoRenewStatus === false) {
          updateData.renewal_cancelled_at = new Date().toISOString();
        }
        break;

      case AppleNotificationType.REVOKE:
        // Coach/Apple revocó
        updateData.status = SubscriptionStatus.REVOKED;
        break;

      case AppleNotificationType.REFUND:
        // Reembolsado
        updateData.status = SubscriptionStatus.REFUNDED;
        updateData.refunded_at = new Date().toISOString();
        break;
    }

    // Actualizar suscripción
    const { error: updateError } = await supabase
      .from("usuarios_suscripciones_iap")
      .update(updateData)
      .eq("coach_id", coachId);

    if (updateError) {
      console.error("[apple-iap-webhook] Failed to update subscription:", updateError);

      // Marcar notificación como procesada con error
      await supabase
        .from("app_store_server_notifications")
        .update({
          processing_error: updateError.message,
        })
        .eq("notification_id", notificationUUID);

      return new Response(
        JSON.stringify({ error: "Failed to update subscription", details: updateError.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // 8. Marcar notificación como procesada
    await supabase
      .from("app_store_server_notifications")
      .update({
        processed: true,
        processed_at: new Date().toISOString(),
      })
      .eq("notification_id", notificationUUID);

    console.log(
      `[apple-iap-webhook] Successfully processed notification (${notificationUUID}), status=${newStatus}`
    );

    // 9. Retornar 200 OK
    return new Response(
      JSON.stringify({
        status: "processed",
        notificationId: notificationUUID,
        coachId: coachId,
        newStatus: newStatus,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[apple-iap-webhook] Unhandled error:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});

// ============================================================================
// Notes
// ============================================================================
//
// 1. HTTP Status Codes:
//    - 200 OK: Successfully processed, Apple stops retrying
//    - 202 Accepted: Accepted but not fully processed (e.g., coach not found yet)
//                    Apple may retry
//    - 400 Bad Request: Malformed request, Apple may retry
//    - 401 Unauthorized: Invalid JWT, Apple retries a few times then gives up
//    - 409 Conflict: Duplicate notification, Apple stops retrying
//    - 500 Server Error: Temporary issue, Apple retries
//
// 2. Idempotency:
//    - notification_id is UNIQUE in database
//    - Duplicate = UNIQUE constraint violation = 409
//    - Safe to call multiple times (Apple will retry, we ignore duplicates)
//
// 3. appAccountToken:
//    - Apple includes automatically if app set it during purchase
//    - Used to link transaction to coach account
//    - Must match usuarios.app_account_token
//
// 4. Webhook Retries:
//    - Apple retries for 6 days if we don't return 2xx
//    - Exponential backoff
//    - Eventually gives up
//
// 5. Security:
//    - Always validate JWT signature (done via validateAppleJWT)
//    - Never trust raw payload without signature
//    - Verify issuer is Apple
//    - Check bundle ID matches
//    - Verify expiration timestamp
