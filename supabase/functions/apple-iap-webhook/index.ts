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

// Apple Root CA G3 certificate (DER format, base64 encoded)
// Used to validate x5c certificate chains in JWS
const APPLE_ROOT_CA_G3 = `
-----BEGIN CERTIFICATE-----
MIICQzCCAcigAwIBAgIUWNEDANu/DrK3bCGEDV5AEiZABKIwCgYIKoZIzj0EAwMw
ZzELMAkGA1UEBhMCVVMxEzARBgNVBAgMQ0NhbGlmb3JuaWExEjAQBgNVBAcMCUN1
cGVydGluZzEVMBMGA1UECgwMQXBwbGUsIEluYy4xIDAeBgNVBAsMF0NlcnRpZmlj
YXRpb24gQXV0aG9yaXR5MB4XDI0MDUwODE2NDMzMFoXDTI5MDUwODE2NDMzMFow
ZzELMAkGA1UEBhMCVVMxEzARBgNVBAgMQ0NhbGlmb3JuaWExEjAQBgNVBAcMCUN1
cGVydGluZzEVMBMGA1UECgwMQXBwbGUsIEluYy4xIDAeBgNVBAsMF0NlcnRpZmlj
YXRpb24gQXV0aG9yaXR5MHYwEAYHKoZIzj0CAQYFK4EEACIDYgAE3rSXRcaULLXw
X3S8c11jL7N/9x7jDQ5eNbFfNFNYmD9R8X/CUpsBjUHSQCnNELMq1e6LfO6m1wR3
F2S1lNFLvkKKpjKC46YjR/J6qKlLB9yWCbqSFe4QAYjSVGmIkD6jo0IwQDAPBgNV
HRMECDAGAQECAgAwHQYDVR0OBBYEFCqGRJf7yxBU22NfKQ/LQmVqcj4vMA4GA1Ud
DwEB/wQEAwIBBjAKBggqhkjOPQQDAwNoADBlAjEA1y0CEW5OP8JVFDf1r1xxqXwI
V6WKgIBNu7lHEX32VJLrqzPJP5Uk4gvuqVGNZ9nLAjBhWNarGVwGcg0gRa0lLhPp
R2+VFe7x1eHnNwl3VmKvN8VJxQpCDhqSTTAhPUc=
-----END CERTIFICATE-----
`;

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
        const parts = signedPayload.split(".");
        if (parts.length !== 3) throw new Error("Invalid JWS format (must have 3 parts)");

        // Parse header and payload
        const header = JSON.parse(atob(parts[0]));
        const payload = JSON.parse(atob(parts[1]));

        if (!payload || !header) {
          throw new Error("Invalid JWS payload or header");
        }

        // TODO: Verify JWS signature
        // CRITICAL: This prevents unauthorized notifications. Required:
        // 1. Extract x5c certificate chain from header
        // 2. Validate chain against Apple Root CA G3 (already have cert above)
        // 3. Verify ES256 signature using leaf certificate public key
        // 4. Validate iss, aud, exp claims
        // Also: parse signedTransactionInfo and signedRenewalInfo as nested JWS
        // and verify their signatures before trusting transaction data.

        console.warn(
          `[webhook] SECURITY: JWS signature verification not yet implemented. ` +
          `Accepting notification ${payload.notificationUUID} without cert validation. ` +
          `This is temporary for integration testing only.`
        );

        notification = payload;
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
