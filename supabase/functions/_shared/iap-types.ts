/**
 * IAP Coach Plans — Shared Types
 *
 * Tipos TypeScript para todas las Edge Functions que manejan Apple IAP.
 * Single source of truth para estructuras de datos, enums, interfaces.
 */

// ============================================================================
// Apple Server Notifications V2 — Types
// ============================================================================

export enum AppleNotificationType {
  SUBSCRIBED = "SUBSCRIBED",
  DID_RENEW = "DID_RENEW",
  DID_FAIL_TO_RENEW = "DID_FAIL_TO_RENEW",
  DID_RECOVER = "DID_RECOVER",
  DID_CHANGE_RENEWAL_PREF = "DID_CHANGE_RENEWAL_PREF",
  DID_CHANGE_RENEWAL_STATUS = "DID_CHANGE_RENEWAL_STATUS",
  GRACE_PERIOD_EXPIRED = "GRACE_PERIOD_EXPIRED",
  EXPIRED = "EXPIRED",
  REVOKE = "REVOKE",
  REFUND = "REFUND",
  PRICE_INCREASE = "PRICE_INCREASE",
  OFFER_REDEEMED = "OFFER_REDEEMED",
}

export enum AppleSubType {
  INITIAL_BUY = "INITIAL_BUY",
  RESUBSCRIBE = "RESUBSCRIBE",
  DOWNGRADE = "DOWNGRADE",
  UPGRADE = "UPGRADE",
  AUTO_RENEW_DISABLED = "AUTO_RENEW_DISABLED",
  AUTO_RENEW_ENABLED = "AUTO_RENEW_ENABLED",
  VOLUNTARY = "VOLUNTARY",
  BILLING_RETRY = "BILLING_RETRY",
  PRICE_INCREASE = "PRICE_INCREASE",
  CROSS_SELL = "CROSS_SELL",
  UNKNOWN = "UNKNOWN",
}

export interface AppleServerNotificationPayload {
  notificationType: AppleNotificationType;
  subtype?: AppleSubType;
  notificationUUID: string; // notification_id (UNIQUE per subscription event)
  data: AppleNotificationData;
  version: string; // "2.0"
  signedDate: number; // ms since epoch
}

export interface AppleNotificationData {
  appAccountToken?: string; // UUID linking to usuarios.app_account_token
  bundleId: string;
  bundleVersion: string;
  environment: "Sandbox" | "Production";
  expirationIntent?: string; // "1" (billing_issue), "2" (opt_out), "3" (other)
  expiresDate: number; // ms since epoch
  gracePeriodExpiresDate?: number;
  isUpgraded?: boolean;
  lastTransactions?: Array<{
    originalTransactionId: string;
    transactionId: string;
    webOrderLineItemId: string;
    bundleId: string;
    productId: string;
    subscriptionGroupIdentifier: string;
    purchaseDate: number;
    originalPurchaseDate: number;
    expiresDate: number;
    quantity: number;
    type: string;
    inAppOwnershipType: string;
    signedDate: number;
    revocationDate?: number;
    revocationReason?: string;
    isUpgraded: boolean;
    offerIdentifier?: string;
    offerType?: string;
  }>;
  offerIdentifier?: string;
  offerType?: string;
  originalTransactionId: string;
  price?: number;
  productId: string;
  productType: string;
  purchaseDate: number;
  quantity: number;
  reason?: string; // Para REFUND: "1" (customer), "2" (billing)
  recentSubscriptionStartDate?: number;
  renewalDate?: number;
  revocationDate?: number;
  revocationReason?: string;
  sandboxEnvironment?: boolean;
  signedDate: number;
  storefront: string; // e.g., "USA"
  storefrontId: string; // e.g., "143441"
  subscriptionGroupIdentifier: string;
  transactionId: string;
  transactionReason?: string;
  type: string;
  webOrderLineItemId?: string;
}

export interface AppleJWTPayload {
  iss: string; // "https://appstoreconnect.apple.com"
  aud: string; // bundleId
  exp: number; // expiration timestamp
  iat: number; // issued at timestamp
  nonce?: string;
  signedDate?: number;
  data: {
    signedTransactionInfo?: string; // JWT (otro JWT adentro del JWT)
    signedRenewalInfo?: string; // JWT
    environment?: "Sandbox" | "Production";
    bundleId?: string;
    appAccountToken?: string;
  };
}

// ============================================================================
// Subscription Status (6+ states)
// ============================================================================

export enum SubscriptionStatus {
  ACTIVE = "active", // Suscripción activa, acceso OK
  EXPIRED = "expired", // Expiró, sin acceso
  GRACE_PERIOD = "grace_period", // Apple falla billing, grace period activo (3 días), acceso OK
  BILLING_RETRY = "billing_retry", // Apple retrying (estado interno), sin acceso
  REVOKED = "revoked", // Coach/usuario revocó, sin acceso
  REFUNDED = "refunded", // Reembolsado, sin acceso
}

export interface SubscriptionStatusInfo {
  status: SubscriptionStatus;
  hasAccess: boolean; // true si status IN ('active', 'grace_period')
  expiresAt: Date;
  gracePeriodExpiresAt?: Date;
  revokedAt?: Date;
  refundedAt?: Date;
}

export function hasIAPEntitlement(status: SubscriptionStatus, expiresDate: Date): boolean {
  const now = new Date();
  return (status === SubscriptionStatus.ACTIVE || status === SubscriptionStatus.GRACE_PERIOD) &&
    expiresDate > now;
}

// ============================================================================
// Database Models (reflect SQL schema)
// ============================================================================

export interface UsuariosSuscripcionesIAP {
  id: string; // UUID
  coach_id: string; // UUID
  original_transaction_id: string;
  app_account_token: string; // UUID
  product_id: string; // 'coach.plan.basic.monthly' | 'coach.plan.pro.monthly'
  bundle_id: string;
  status: SubscriptionStatus;
  purchase_date: string; // ISO timestamp
  expires_date: string; // ISO timestamp
  grace_period_expires_at?: string;
  renewal_cancelled_at?: string;
  refunded_at?: string;
  environment: "sandbox" | "production";
  payment_source: "apple_iap";
  created_at: string;
  updated_at: string;
  last_webhook_at?: string;
  last_notification_type?: string;
  error_message?: string;
}

export interface AppStoreServerNotification {
  id: string; // UUID
  notification_id: string; // Apple's unique ID
  coach_id?: string; // UUID or null
  original_transaction_id?: string;
  bundle_id: string;
  notification_type: AppleNotificationType;
  sub_type?: AppleSubType;
  raw_payload: Record<string, unknown>; // Full JWT as JSON
  data: AppleNotificationData;
  processed: boolean;
  processed_at?: string; // ISO timestamp
  processing_error?: string;
  received_at: string; // ISO timestamp
  created_at: string;
  environment: "sandbox" | "production";
}

export interface SuspiciousDoubleCharge {
  id: string; // UUID
  coach_id: string; // UUID
  stripe_charge_id?: string;
  stripe_amount?: number;
  stripe_charge_at?: string;
  apple_transaction_id?: string;
  apple_amount?: number;
  apple_charge_at?: string;
  time_delta_ms?: number;
  currency: string;
  severity: "auto_refund" | "review" | "false_positive";
  resolved: boolean;
  resolution_type?: "refund_stripe" | "refund_apple" | "keep_both" | "false_positive";
  refund_amount?: number;
  refund_processed_at?: string;
  refund_notes?: string;
  detected_at: string; // ISO timestamp
  reviewed_at?: string;
  reviewed_by?: string; // UUID
  notification_sent: boolean;
  notification_sent_at?: string;
  notification_method?: "email" | "whatsapp" | "both";
  notes?: Record<string, unknown>;
}

// ============================================================================
// Validation & Entitlement
// ============================================================================

export interface ValidateIAPRequest {
  originalTransactionId: string;
  appAccountToken: string;
  productId: string;
  bundleId: string;
  environment: "sandbox" | "production";
}

export interface ValidateIAPResponse {
  valid: boolean;
  coach_id?: string; // UUID if valid
  subscription?: UsuariosSuscripcionesIAP;
  error?: string;
}

export interface CheckEntitlementRequest {
  coach_id: string; // UUID
}

export interface CheckEntitlementResponse {
  hasAccess: boolean;
  status?: SubscriptionStatus;
  expiresAt?: Date;
  plan?: "basic" | "pro";
  error?: string;
}

// ============================================================================
// Apple App Store Server API
// ============================================================================

export interface AppStoreServerAPIResponse {
  data?: unknown;
  error?: {
    errorCode: number;
    errorMessage: string;
  };
}

export interface AppStoreGetSubscriptionStatusResponse {
  data: {
    signedTransactionInfo: string; // JWT
    signedRenewalInfo: string; // JWT
    environment: "Sandbox" | "Production";
    bundleId: string;
    bundleVersion: string;
    appAccountToken?: string;
  };
}

// ============================================================================
// Edge Function Request/Response Wrappers
// ============================================================================

export interface WebhookRequest {
  body: string; // Raw body (Apple JWT as base64 or text)
  headers: Record<string, string>;
}

export interface WebhookResponse {
  statusCode: number;
  body: string; // JSON
}

export interface EdgeFunctionError {
  code: string;
  message: string;
  statusCode: number;
  details?: Record<string, unknown>;
}

// ============================================================================
// Constants
// ============================================================================

export const APPLE_BUNDLE_ID = "com.pathwaycareercoach.ios";
export const APPLE_TEAM_ID = process.env.APPLE_TEAM_ID || "";
export const APPLE_KEY_ID = process.env.APPLE_KEY_ID || "";
export const APPLE_ISSUER_ID = process.env.APPLE_ISSUER_ID || "";

export const PRODUCT_IDS = {
  BASIC_MONTHLY: "coach.plan.basic.monthly",
  PRO_MONTHLY: "coach.plan.pro.monthly",
} as const;

export const ENTITLEMENT_STATUSES = [
  SubscriptionStatus.ACTIVE,
  SubscriptionStatus.GRACE_PERIOD,
] as const;

export const NO_ENTITLEMENT_STATUSES = [
  SubscriptionStatus.EXPIRED,
  SubscriptionStatus.BILLING_RETRY,
  SubscriptionStatus.REVOKED,
  SubscriptionStatus.REFUNDED,
] as const;

// ============================================================================
// Helpers
// ============================================================================

export function isProductIdValid(productId: string): boolean {
  return Object.values(PRODUCT_IDS).includes(productId as any);
}

export function notificationTypeToStatus(notificationType: AppleNotificationType): SubscriptionStatus {
  const map: Record<AppleNotificationType, SubscriptionStatus> = {
    [AppleNotificationType.SUBSCRIBED]: SubscriptionStatus.ACTIVE,
    [AppleNotificationType.DID_RENEW]: SubscriptionStatus.ACTIVE,
    [AppleNotificationType.DID_FAIL_TO_RENEW]: SubscriptionStatus.BILLING_RETRY,
    [AppleNotificationType.DID_RECOVER]: SubscriptionStatus.ACTIVE,
    [AppleNotificationType.DID_CHANGE_RENEWAL_PREF]: SubscriptionStatus.ACTIVE, // Plan change, still active
    [AppleNotificationType.DID_CHANGE_RENEWAL_STATUS]: SubscriptionStatus.ACTIVE, // re-enabled
    [AppleNotificationType.GRACE_PERIOD_EXPIRED]: SubscriptionStatus.EXPIRED,
    [AppleNotificationType.EXPIRED]: SubscriptionStatus.EXPIRED,
    [AppleNotificationType.REVOKE]: SubscriptionStatus.REVOKED,
    [AppleNotificationType.REFUND]: SubscriptionStatus.REFUNDED,
    [AppleNotificationType.PRICE_INCREASE]: SubscriptionStatus.ACTIVE, // No change, pending user action
    [AppleNotificationType.OFFER_REDEEMED]: SubscriptionStatus.ACTIVE,
  };
  return map[notificationType] || SubscriptionStatus.ACTIVE;
}

export function durationToMs(seconds: number): number {
  return seconds * 1000;
}

export function msToSeconds(ms: number): number {
  return Math.floor(ms / 1000);
}
