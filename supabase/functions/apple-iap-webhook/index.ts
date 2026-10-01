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
// Must be idempotent (same notification can arrive multiple times)
// Notification is a JWT signed by Apple

import { createClient } from "jsr:@supabase/supabase-js@2";

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

    // TODO: In production, verify JWT signature with Apple's public certificates
    // For MVP, assume payload is valid if it contains required fields
    // Apple's cert endpoint: https://appleid.apple.com/auth/oauth2/keys

    let notification = body.notification;

    if (!notification && signedPayload) {
      // Decode JWT (without verification for MVP)
      // In production: verify signature first
      try {
        const parts = signedPayload.split(".");
        if (parts.length !== 3) throw new Error("Invalid JWT");
        const payload = atob(parts[1]);
        notification = JSON.parse(payload);
      } catch (e) {
        console.error("[webhook] JWT decode error:", e);
        return new Response(JSON.stringify({ ok: false, error: "Invalid JWT" }), {
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
    const productId = notification.productId || "";
    const appAccountToken = notification.appAccountToken || "";

    if (!originalTransactionId || !notificationType) {
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

    // IDEMPOTENCY: Check if we've already processed this notification
    // Use original_transaction_id + notification_type as key
    const { data: existingNotif } = await client
      .from("usuarios_suscripciones_iap")
      .select("id, last_notification_type, notification_count")
      .eq("original_transaction_id", originalTransactionId)
      .single();

    if (
      existingNotif &&
      existingNotif.last_notification_type === notificationType &&
      existingNotif.notification_count > 0
    ) {
      // This is a duplicate; silently return OK (idempotent)
      console.log(
        `[webhook] Duplicate notification: ${notificationType} for ${originalTransactionId}`
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
      console.warn(`[webhook] Unknown notification type: ${notificationType}`);
      newState = "active"; // Default to active if unknown
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
      console.warn(
        `[webhook] Subscription not found: ${originalTransactionId} (new subscription?)`
      );
      // This can happen if check-entitlement hasn't been called yet
      // Create a new record (if appAccountToken is provided, we can link to user)
      if (appAccountToken) {
        // Find user by matching records (this is a fallback; ideally we'd have the user_id from receipt)
        console.warn(
          `[webhook] Cannot create record without user_id. appAccountToken: ${appAccountToken}`
        );
        // In production, extract user_id from the appAccountToken or receipt
        // For now, skip insertion
      }
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
