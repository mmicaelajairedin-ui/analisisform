// apple-iap-webhook — Apple App Store Server Notifications V2 handler
//
// Receives webhook notifications from Apple when subscriptions change:
// - SUBSCRIBED: new subscription
// - RENEWED: subscription renewed
// - EXPIRED: subscription expired
// - REVOKED: user revoked
// - REFUND: refund issued (partial or full)
// - BILLING_RETRY: payment failed, retrying
// - GRACE_PERIOD: grace period started
// - DID_FAIL_TO_RENEW: failed to renew
// - DID_CHANGE_RENEWAL_STATUS: auto-renew changed
//
// Must be idempotent using notificationUUID
// Notification is a JWS (JSON Web Signature) signed by Apple with x5c certificate chain
//
// Spec: https://developer.apple.com/documentation/appstoreserverapi/jwsrenewalinfo

import { createClient } from "jsr:@supabase/supabase-js@2";
import { validateJWS, validateNestedJWS } from "./jws-validator.ts";

interface JWSPayload {
  notificationType: string;
  notificationUUID: string;
  data?: {
    signedTransactionInfo: string;
    signedRenewalInfo?: string;
  };
}

interface AppleNotification {
  notificationType: string;
  originalTransactionId: string;
  productId: string;
  appAccountToken?: string;
  autoRenewStatus?: boolean;
  autoRenewStatusChangeDate?: number; // milliseconds
  expirationDate?: number;
  gracePeriodExpiresDate?: number;
  isUpgrade?: boolean;
  bundleId?: string;
  signedDate?: number;
}

interface WebhookPayload {
  signedPayload?: string; // JWT from Apple
  notification?: AppleNotification; // For testing
}

// Notification type to subscription state mapping
const NOTIFICATION_TO_STATE = {
  SUBSCRIBED: "active",
  RENEWED: "active",
  EXPIRED: "expired",
  REVOKED: "revoked",
  BILLING_RETRY: "billing_retry",
  GRACE_PERIOD: "grace_period",
  DID_FAIL_TO_RENEW: "expired",
  DID_CHANGE_RENEWAL_STATUS: "active", // if auto_renew is true, else treat as cancelled
  DID_CHANGE_RENEWAL_PREF: "active", // same as above
  REFUND: "refunded",
  REFUND_DECLINED: "active", // refund was declined
};

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const body: WebhookPayload = await req.json();
    const signedPayload = body.signedPayload;

    // SECURITY: Require signedPayload (JWS signed by Apple) in production
    // Allow unsigned notifications ONLY in local test mode with multiple validation gates
    const allowUnsignedTest = Deno.env.get("IAP_ALLOW_UNSIGNED_TEST") === "true";

    // Test mode requires BOTH env var AND WHITELIST of localhost hosts
    // Only these hosts are safe for unsigned notifications: localhost, 127.0.0.1, host.docker.internal, kong
    // Any other host (including production Supabase) is rejected
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";

    let isLocalHost = false;
    try {
      const url = new URL(supabaseUrl);
      const hostname = url.hostname;
      const allowedLocalHosts = ["localhost", "127.0.0.1", "host.docker.internal", "kong"];
      isLocalHost = allowedLocalHosts.includes(hostname);
    } catch (e) {
      // Invalid URL format — reject test mode
      console.error("[webhook] Invalid SUPABASE_URL format:", e);
      isLocalHost = false;
    }
    const isLocalTestMode = allowUnsignedTest && isLocalHost;

    if (!signedPayload) {
      // Production: REQUIRE signed payload (reject by default)
      if (!isLocalTestMode) {
        console.warn("[webhook] Unsigned notification rejected (not in local test mode)");
        return new Response(
          JSON.stringify({
            ok: false,
            error: "Webhook requires signedPayload (JWS signed by Apple App Store)"
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      // Parse and validate JWS from Apple
    // App Store Server Notifications V2 are JWS (JSON Web Signature) with x5c certificate chain
    // Spec: https://developer.apple.com/documentation/appstoreserverapi/jwsrenewalinfo

    // SECURITY: Prevent bypass — notification must be extracted ONLY from validated signedPayload
    // If both are present, signedPayload takes precedence and notification is ignored
    let notification: AppleNotification | null = null;
    let notificationType = "";
    let transactionData: Record<string, unknown> | null = null;
    let renewalData: Record<string, unknown> | null = null;

    // Test mode: allow direct notification for local testing
    if (!signedPayload) {
      if (!body.notification) {
        return new Response(
          JSON.stringify({ ok: false, error: "No payload or notification" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      // POINT 1: Assign unsigned notification explicitly
      notification = body.notification;
      notificationType = notification.notificationType || "";

      console.log("[webhook] TEST MODE: Accepting unsigned notification (local testing only)");
    }

    if (signedPayload) {
      try {
        // Validate JWS signature (x5c chain + ES256 verification)
        const validation = await validateJWS(signedPayload);

        if (!validation.valid) {
          console.error("[webhook] JWS validation failed:", validation.error);
          return new Response(
            JSON.stringify({ ok: false, error: `JWS validation failed: ${validation.error}` }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }

        notification = validation.payload as AppleNotification;

        // SECURITY: Validate and extract data from nested JWS payloads
        // In Apple V2 notifications, transaction details are inside signedTransactionInfo
        // Some notification types (TEST, SUMMARY, unknown) don't include it — handle those without 400
        notificationType = notification.notificationType || "";

        if (notification.data?.signedTransactionInfo) {
          // Validate signedTransactionInfo as nested JWS and extract payload
          const txnValidation = await validateNestedJWS(notification.data.signedTransactionInfo);
          if (!txnValidation.valid) {
            console.error("[webhook] signedTransactionInfo validation failed:", txnValidation.error);
            return new Response(
              JSON.stringify({ ok: false, error: "Transaction info validation failed" }),
              { status: 400, headers: { "Content-Type": "application/json" } }
            );
          }
          transactionData = txnValidation.payload as Record<string, unknown>;
        } else {
          // signedTransactionInfo missing — only valid for certain notification types
          const typesWithoutTransaction = ["TEST", "SUMMARY"];
          const isSafeType = typesWithoutTransaction.includes(notificationType);

          if (!isSafeType && notificationType) {
            // Type SHOULD have signedTransactionInfo but doesn't — subscription-related types must have it
            // Only reject subscription-modifying types; unknown types are safe to skip
            const subscriptionModifyingTypes = [
              "SUBSCRIBED",
              "RENEWED",
              "EXPIRED",
              "REVOKED",
              "BILLING_RETRY",
              "GRACE_PERIOD",
              "DID_FAIL_TO_RENEW",
              "DID_CHANGE_RENEWAL_STATUS",
              "DID_CHANGE_RENEWAL_PREF",
              "REFUND",
              "REFUND_DECLINED"
            ];

            if (subscriptionModifyingTypes.includes(notificationType)) {
              console.error(`[webhook] Missing signedTransactionInfo for subscription-modifying type: ${notificationType}`);
              return new Response(
                JSON.stringify({ ok: false, error: "Missing transaction info for subscription notification" }),
                { status: 400, headers: { "Content-Type": "application/json" } }
              );
            }
          }
        }

        // If signedRenewalInfo exists, validate it as nested JWS and use its payload
        if (notification.data?.signedRenewalInfo) {
          const renewalValidation = await validateNestedJWS(notification.data.signedRenewalInfo);
          if (!renewalValidation.valid) {
            console.error("[webhook] signedRenewalInfo validation failed:", renewalValidation.error);
            return new Response(
              JSON.stringify({ ok: false, error: "Renewal info validation failed" }),
              { status: 400, headers: { "Content-Type": "application/json" } }
            );
          }
          renewalData = renewalValidation.payload as Record<string, unknown>;
        }
      } catch (e) {
        console.error("[webhook] JWS parse error:", e);
        return new Response(JSON.stringify({ ok: false, error: "Invalid JWS" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    if (!notification) {
      return new Response(JSON.stringify({ ok: false, error: "No notification" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Extract fields from VALIDATED nested JWS payload (if present)
    const notificationUUID = notification.notificationUUID || "";

    // If transactionData is null (TEST, SUMMARY, or other non-subscription types without signedTransactionInfo)
    if (!transactionData) {
      // These types are acknowledged but don't modify subscription state
      console.log(`[webhook] Received non-subscription notification: ${notificationType}`);
      return new Response(
        JSON.stringify({ ok: true, state: "acknowledged_no_transaction", type: notificationType }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // POINT 2: Extract Apple data from VALIDATED JWS payloads (not fallback to notification)
    // transactionData is present — extract subscription-modifying fields
    const originalTransactionId = (transactionData.originalTransactionId as string) || "";
    const productId = (transactionData.productId as string) || "";
    const bundleId = (transactionData.bundleId as string) || "";
    const signedDateMs = (transactionData.signedDate as number) || null; // milliseconds from Apple
    const expiresDateMs = (transactionData.expiresDate as number) || null; // milliseconds from Apple

    // appAccountToken comes from outer notification (Apple includes it at top level)
    const appAccountToken = notification.appAccountToken || "";

    // environment comes from outer notification
    const notificationEnvironment = (notification as any).environment || "Production";
    const expectedEnvironment = Deno.env.get("IAP_ENVIRONMENT") || "Production";

    if (!originalTransactionId || !notificationType || !notificationUUID) {
      return new Response(
        JSON.stringify({ ok: false, error: "Missing required fields (transaction validation)" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // POINT 7: Validate bundleId MUST be present and match expected value for subscription notifications
    // POINT 6: signedDate MUST be present in validated transactionData for subscription modifications
    const expectedBundleId = "com.pathway.coach";

    // bundleId is REQUIRED and must match (not optional/empty for subscription notifications)
    if (!bundleId) {
      console.error(`[webhook] Missing bundleId in transaction (required for subscription notifications)`);
      return new Response(
        JSON.stringify({ ok: false, error: "Missing bundleId in transaction data" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (bundleId !== expectedBundleId) {
      console.error(`[webhook] Invalid bundleId: ${bundleId} (expected: ${expectedBundleId})`);
      return new Response(
        JSON.stringify({ ok: false, error: "Invalid bundle ID" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // POINT 7: environment MUST match expected environment (Production vs Sandbox)
    // Do not accept missing environment as default Production
    if (notificationEnvironment !== expectedEnvironment) {
      console.error(`[webhook] Invalid environment: ${notificationEnvironment} (expected: ${expectedEnvironment})`);
      return new Response(
        JSON.stringify({ ok: false, error: "Invalid environment" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // POINT 6: signedDate MUST be present in validated transaction data (from JWS)
    // Subscription modifications cannot use current time as fallback
    if (!signedDateMs) {
      console.error("[webhook] Missing signedDate in transaction data (required for subscription modifications)");
      return new Response(
        JSON.stringify({ ok: false, error: "Missing signedDate in transaction data" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase (service role for webhook processing)
    const url = Deno.env.get("SUPABASE_URL") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    if (!url || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ ok: false, error: "Config error" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const client = createClient(url, serviceRoleKey);

    // IDEMPOTENCY: Check if we've already processed this specific notification UUID
    // Apple guarantees notificationUUID is unique per notification
    // POINT 5: Include notification_count in initial select for atomic increment
    const { data: existingNotif } = await client
      .from("usuarios_suscripciones_iap")
      .select("id, latest_notification_uuid, notification_count")
      .eq("original_transaction_id", originalTransactionId)
      .single();

    if (existingNotif && existingNotif.latest_notification_uuid === notificationUUID) {
      // This is a duplicate; silently return OK (idempotent)
      console.log(
        `[webhook] Duplicate notification: UUID ${notificationUUID} already processed`
      );
      return new Response(JSON.stringify({ ok: true, duplicate: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Map notification type to subscription state
    let newState = NOTIFICATION_TO_STATE[notificationType];

    // Handle special cases
    if (
      notificationType === "DID_CHANGE_RENEWAL_STATUS" ||
      notificationType === "DID_CHANGE_RENEWAL_PREF"
    ) {
      newState = notification.autoRenewStatus === true ? "active" : "expired";
    }

    if (!newState) {
      // Unknown notification types are safe to ignore and acknowledge
      // Apple may add new types and we should not update state for unknown types
      // Responding 200 OK tells Apple we received it; Apple will retry 4xx
      console.log(`[webhook] Unknown notification type (Apple may have added new type): ${notificationType}`);
      return new Response(JSON.stringify({ ok: true, state: "unknown_type" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Calculate expiration date from validated transaction data
    let expiresAt = null;
    if (expiresDateMs) {
      expiresAt = new Date(expiresDateMs).toISOString();
    } else if (notification.gracePeriodExpiresDate) {
      expiresAt = new Date(notification.gracePeriodExpiresDate).toISOString();
    } else if (newState === "active" || newState === "grace_period") {
      // Assume 30 days for active subscriptions
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      expiresAt = futureDate.toISOString();
    } else {
      // Already expired
      expiresAt = new Date().toISOString();
    }

    // POINT 6: Use signedDate from validated transaction data (already validated above)
    // This is guaranteed to exist from our prior check
    const notificationDate = new Date(signedDateMs!);

    // Update or insert subscription
    const { data: existing } = await client
      .from("usuarios_suscripciones_iap")
      .select("id, usuario_id, last_signed_date")
      .eq("original_transaction_id", originalTransactionId)
      .single();

    if (existing) {
      // SECURITY: Only update if this event is newer (or first event)
      // Prevents old/stale webhooks from reverting recent state changes
      const lastSignedDate = existing.last_signed_date
        ? new Date(existing.last_signed_date)
        : null;

      if (lastSignedDate && notificationDate < lastSignedDate) {
        // Event is older than what we already have
        console.log(
          `[webhook] Ignoring stale event: ${notificationType} ` +
          `(${notificationDate.toISOString()} is before ${lastSignedDate.toISOString()})`
        );

        return new Response(
          JSON.stringify({
            ok: true,
            state: "ignored_stale",
            reason: "Event timestamp is older than last processed event"
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      // ATOMIC UPDATE: Only update if this event is newer (or first event)
      // Use WHERE clause to prevent race condition: last_signed_date IS NULL OR last_signed_date < new_date
      // Must request count explicitly to know if update matched any rows
      const { data: updateResult, error: updateError, count } = await client
        .from("usuarios_suscripciones_iap")
        .update({
          state: newState,
          expires_at: expiresAt,
          latest_notification_uuid: notificationUUID,
          last_notification_type: notificationType,
          last_notification_at: notificationDate.toISOString(),
          last_signed_date: notificationDate.toISOString(),
          notification_count: (existingNotif?.notification_count || 0) + 1,
          auto_renew_status:
            notification.autoRenewStatus !== undefined
              ? notification.autoRenewStatus
              : true,
          updated_at: new Date().toISOString(),
        })
        .eq("original_transaction_id", originalTransactionId)
        // ATOMIC: Only match if no previous date OR previous date is older than this event
        .or(`last_signed_date.is.null,last_signed_date.lt.${notificationDate.toISOString()}`)
        .select("id", { count: "exact" });

      if (updateError) {
        console.error("[webhook] Update error:", updateError);
        return new Response(JSON.stringify({ ok: false, error: updateError.message }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }

      // If count is 0, this event was stale (already have newer event)
      if (!count || count === 0) {
        console.log(
          `[webhook] Ignoring stale event: ${notificationType} ` +
          `(${notificationDate.toISOString()} is before existing event)`
        );

        return new Response(
          JSON.stringify({
            ok: true,
            state: "ignored_stale",
            reason: "Event timestamp is older than last processed event (atomic check)"
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      // Update user's plan projection based on new state
      const accessStates = ["active", "grace_period"];
      if (accessStates.includes(newState)) {
        // Keep plan (basic or pro based on product_id)
        const plan = productId.includes("pro") ? "pro" : "basic";
        await client
          .from("usuarios")
          .update({ plan, updated_at: new Date().toISOString() })
          .eq("id", existing.usuario_id);
      } else if (newState === "expired" || newState === "revoked") {
        // Reset plan to basic (no access)
        await client
          .from("usuarios")
          .update({ plan: "basic", updated_at: new Date().toISOString() })
          .eq("id", existing.usuario_id);
      }
    } else {
      // Subscription not found in database
      // This is a legitimate edge case: check-entitlement may not have been called yet,
      // or the purchase was made but the webhook arrived before the entitlement check.
      // The transaction IS verified (JWS validation passed), but we have no record yet.
      // We cannot create a subscription record without the user_id from check-entitlement,
      // so we acknowledge to Apple (200 OK) and let check-entitlement create the record
      // when it runs next.
      console.log(
        `[webhook] Subscription record not yet created: ${originalTransactionId}. ` +
        `State not updated (will be created by check-entitlement). appAccountToken: ${appAccountToken || "none"}`
      );
      // Don't create or modify any records; let check-entitlement establish the user link first
      return new Response(JSON.stringify({ ok: true, state: "record_not_found" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    console.log(
      `[webhook] Processed ${notificationType}: ${originalTransactionId} -> ${newState}`
    );

    return new Response(JSON.stringify({ ok: true, state: newState }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[webhook] Error:", error);
    return new Response(JSON.stringify({ ok: false, error: String(error) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
