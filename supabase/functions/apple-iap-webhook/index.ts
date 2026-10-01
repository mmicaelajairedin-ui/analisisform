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

    if (!signedPayload) {
      // If no signed payload, check if we're in test mode (notification directly provided)
      if (!body.notification) {
        return new Response(JSON.stringify({ ok: false, error: "No payload" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // Parse and validate JWS from Apple
    // App Store Server Notifications V2 are JWS (JSON Web Signature) with x5c certificate chain
    // Spec: https://developer.apple.com/documentation/appstoreserverapi/jwsrenewalinfo

    let notification = body.notification;

    if (!notification && signedPayload) {
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

        // If signedTransactionInfo exists, validate it as nested JWS
        if (notification.data?.signedTransactionInfo) {
          const txnValidation = await validateNestedJWS(notification.data.signedTransactionInfo);
          if (!txnValidation.valid) {
            console.error("[webhook] signedTransactionInfo validation failed:", txnValidation.error);
            return new Response(
              JSON.stringify({ ok: false, error: "Transaction info validation failed" }),
              { status: 400, headers: { "Content-Type": "application/json" } }
            );
          }
        }

        // If signedRenewalInfo exists, validate it as nested JWS
        if (notification.data?.signedRenewalInfo) {
          const renewalValidation = await validateNestedJWS(notification.data.signedRenewalInfo);
          if (!renewalValidation.valid) {
            console.error("[webhook] signedRenewalInfo validation failed:", renewalValidation.error);
            return new Response(
              JSON.stringify({ ok: false, error: "Renewal info validation failed" }),
              { status: 400, headers: { "Content-Type": "application/json" } }
            );
          }
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

    // Extract fields
    const notificationType = notification.notificationType || "";
    const originalTransactionId = notification.originalTransactionId || "";
    const notificationUUID = notification.notificationUUID || "";
    const productId = notification.productId || "";
    const appAccountToken = notification.appAccountToken || "";

    if (!originalTransactionId || !notificationType || !notificationUUID) {
      return new Response(
        JSON.stringify({ ok: false, error: "Missing required fields" }),
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
    const { data: existingNotif } = await client
      .from("usuarios_suscripciones_iap")
      .select("id, latest_notification_uuid")
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

    // Calculate expiration date
    let expiresAt = null;
    if (notification.expirationDate) {
      expiresAt = new Date(notification.expirationDate).toISOString();
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

    // Update or insert subscription
    const { data: existing } = await client
      .from("usuarios_suscripciones_iap")
      .select("id, usuario_id")
      .eq("original_transaction_id", originalTransactionId)
      .single();

    if (existing) {
      // Update
      const { error: updateError } = await client
        .from("usuarios_suscripciones_iap")
        .update({
          state: newState,
          expires_at: expiresAt,
          latest_notification_uuid: notificationUUID,
          last_notification_type: notificationType,
          last_notification_at: new Date().toISOString(),
          notification_count: (existingNotif?.notification_count || 0) + 1,
          auto_renew_status:
            notification.autoRenewStatus !== undefined
              ? notification.autoRenewStatus
              : true,
          updated_at: new Date().toISOString(),
        })
        .eq("original_transaction_id", originalTransactionId);

      if (updateError) {
        console.error("[webhook] Update error:", updateError);
        return new Response(JSON.stringify({ ok: false, error: updateError.message }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
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
