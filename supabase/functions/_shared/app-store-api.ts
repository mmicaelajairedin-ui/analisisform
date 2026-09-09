/**
 * App Store Server API Client
 *
 * Utility module for fetching subscription status directly from Apple's
 * App Store Server API (fallback if webhook is missed).
 *
 * Requires:
 * - APPLE_PRIVATE_KEY (.p8 file content)
 * - APPLE_KEY_ID
 * - APPLE_ISSUER_ID
 * - APPLE_BUNDLE_ID
 *
 * Docs: https://developer.apple.com/documentation/appstoreserverapi
 */

interface AppStoreSubscription {
  originalTransactionId: string;
  bundleId: string;
  productId: string;
  expiresDate: number; // ms epoch
  status: string;
  environment: "Sandbox" | "Production";
}

interface AppStoreAPIError {
  code: string;
  message: string;
}

/**
 * Create JWT for App Store Server API authentication
 * (uses ECDSA P8 signing key)
 */
export async function createAppStoreAPIJWT(): Promise<string> {
  const privateKeyPEM = Deno.env.get("APPLE_PRIVATE_KEY");
  const keyId = Deno.env.get("APPLE_KEY_ID");
  const issuerId = Deno.env.get("APPLE_ISSUER_ID");

  if (!privateKeyPEM || !keyId || !issuerId) {
    throw new Error("App Store API credentials not configured");
  }

  const header = {
    alg: "ES256",
    kid: keyId,
    typ: "JWT",
  };

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: issuerId,
    iat: now,
    exp: now + 3600, // Valid for 1 hour
    aud: "appstoreconnect-v1",
  };

  // Encode header and payload as base64url
  const headerB64 = btoa(JSON.stringify(header))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");

  const payloadB64 = btoa(JSON.stringify(payload))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");

  const message = `${headerB64}.${payloadB64}`;
  const messageBuffer = new TextEncoder().encode(message);

  // Import private key (P8 format)
  const key = await crypto.subtle.importKey(
    "pkcs8",
    _pemToDER(privateKeyPEM),
    {
      name: "ECDSA",
      namedCurve: "P-256",
    },
    false,
    ["sign"]
  );

  // Sign message
  const signature = await crypto.subtle.sign("ECDSA", key, messageBuffer);
  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");

  return `${message}.${signatureB64}`;
}

/**
 * Fetch transaction info from App Store Server API
 * (used to verify purchase status)
 */
export async function getTransactionInfo(
  originalTransactionId: string,
  environment: "Sandbox" | "Production" = "Production"
): Promise<AppStoreSubscription> {
  const baseUrl =
    environment === "Sandbox"
      ? "https://api.sandbox.apple.com"
      : "https://api.storekit.itunes.apple.com";

  const jwt = await createAppStoreAPIJWT();

  const response = await fetch(
    `${baseUrl}/inApps/v1/transactions/${originalTransactionId}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!response.ok) {
    const errorData = (await response.json()) as AppStoreAPIError;
    throw new Error(
      `App Store API error (${response.status}): ${errorData.message || errorData.code}`
    );
  }

  const data = await response.json();
  return {
    originalTransactionId: data.signedTransactionInfo?.originalTransactionId,
    bundleId: data.bundleId,
    productId: data.signedTransactionInfo?.productId,
    expiresDate: data.signedTransactionInfo?.expiresDate,
    status: data.signedTransactionInfo?.status,
    environment,
  };
}

/**
 * Get all subscriptions for a given app account token (unsupported for IAP model)
 * NOTE: App Store API does NOT support querying by appAccountToken.
 * Only originalTransactionId is supported. This function exists for reference only.
 */
export async function listSubscriptions(
  bundleId: string,
  environment: "Sandbox" | "Production" = "Production"
): Promise<AppStoreSubscription[]> {
  // WARNING: This endpoint requires admin access and pagination.
  // For production, implement cursor-based pagination.
  // See: https://developer.apple.com/documentation/appstoreserverapi/get_all_subscription_statuses

  const baseUrl =
    environment === "Sandbox"
      ? "https://api.sandbox.apple.com"
      : "https://api.storekit.itunes.apple.com";

  const jwt = await createAppStoreAPIJWT();

  const response = await fetch(
    `${baseUrl}/inApps/v1/subscriptions/statuses`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!response.ok) {
    const errorData = (await response.json()) as AppStoreAPIError;
    throw new Error(
      `App Store API error (${response.status}): ${errorData.message || errorData.code}`
    );
  }

  const data = await response.json();
  return data.data || [];
}

/**
 * Convert PEM format to DER for crypto.subtle.importKey()
 */
function _pemToDER(pem: string): ArrayBuffer {
  const lines = pem.split("\n");
  let base64String = "";

  for (const line of lines) {
    if (
      !line.startsWith("-----BEGIN") &&
      !line.startsWith("-----END") &&
      line.trim()
    ) {
      base64String += line.trim();
    }
  }

  const binaryString = atob(base64String);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

// ============================================================================
// Notes
// ============================================================================
//
// IMPORTANT: This is a FALLBACK utility for when webhooks are missed.
// In normal operation, Apple Server Notifications V2 should handle all updates.
//
// Use cases:
// 1. Webhook timeout recovery (user logs in, we verify status via API)
// 2. Debug missing notifications
// 3. Scheduled reconciliation job
//
// Limitations:
// - API calls cost (Apple charges per request, though generously)
// - Cannot query by appAccountToken (only originalTransactionId)
// - Subject to rate limits
//
// Setup (one-time):
// 1. Generate .p8 key in App Store Connect (Keys → Certificates, Identifiers & Profiles)
// 2. Store in Supabase secrets:
//    - APPLE_PRIVATE_KEY = full .p8 file content (PEM format)
//    - APPLE_KEY_ID = from App Store Connect
//    - APPLE_ISSUER_ID = from App Store Connect
//
// Example usage (in an Edge Function):
// ```
// import { getTransactionInfo } from "../_shared/app-store-api.ts";
//
// const txn = await getTransactionInfo(originalTransactionId, "Sandbox");
// console.log(txn.status, txn.expiresDate);
// ```
