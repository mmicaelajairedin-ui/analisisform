/**
 * Client-side Entitlement Helper
 *
 * Utility for checking subscription eligibility from frontend code.
 * Used in panel-v2.html to show/hide "Buy Apple IAP" CTA based on Stripe status.
 *
 * Concept: A coach can have Stripe OR Apple IAP, but not both simultaneously.
 * This helper enforces that mutual exclusivity at the UI level.
 */

interface EntitlementCheckOptions {
  coachId: string;
  checkType?: "iap_only" | "stripe_only" | "any";
  useAuth?: boolean; // If true, send Authorization header (from Supabase Auth)
}

interface EntitlementResult {
  hasAccess: boolean;
  coach_id: string;
  plan?: "basic" | "pro";
  paymentSource?: "stripe" | "apple_iap";
  status?: string;
  expiresAt?: string;
  gracePeriodUntil?: string | null;
  reason?: string;
  error?: string;
}

/**
 * Check if coach has active subscription (Stripe or IAP)
 * Call from panel-v2.html before showing "Buy Apple IAP" CTA
 */
export async function checkEntitlement(
  options: EntitlementCheckOptions
): Promise<EntitlementResult> {
  const {
    coachId,
    checkType = "any",
    useAuth = false,
  } = options;

  const queryParams = new URLSearchParams({
    coach_id: coachId,
    checkType,
  });

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  // If useAuth=true, attach Supabase Auth JWT (from localStorage)
  if (useAuth) {
    const token = _getAuthToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  }

  try {
    const response = await fetch(
      `${_getSupabaseUrl()}/functions/v1/check-entitlement?${queryParams}`,
      {
        method: "GET",
        headers,
      }
    );

    if (!response.ok) {
      // 403 = no access (not an error, just ineligible)
      if (response.status === 403) {
        const data = await response.json();
        return {
          hasAccess: false,
          coach_id: coachId,
          reason: data.reason || "No active subscription",
        };
      }

      // Other errors
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("[entitlement-client] Check failed:", error);
    return {
      hasAccess: false,
      coach_id: coachId,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Determine if coach is eligible to purchase Apple IAP
 * (i.e., NOT already subscribed to Stripe)
 *
 * Usage: if (!(await isEligibleForAppleIAP(coachId))) { hideAppleCTA(); }
 */
export async function isEligibleForAppleIAP(coachId: string): Promise<boolean> {
  const result = await checkEntitlement({
    coachId,
    checkType: "stripe_only", // Check only Stripe
  });

  // If Stripe is active, NOT eligible for Apple
  if (result.hasAccess && result.paymentSource === "stripe") {
    return false; // Has active Stripe, can't buy Apple
  }

  // Otherwise, eligible (either no subscription or only IAP)
  return true;
}

/**
 * Determine if coach is eligible to purchase Stripe
 * (i.e., NOT already subscribed to Apple IAP)
 */
export async function isEligibleForStripe(coachId: string): Promise<boolean> {
  const result = await checkEntitlement({
    coachId,
    checkType: "iap_only", // Check only IAP
  });

  // If IAP is active, NOT eligible for Stripe
  if (result.hasAccess && result.paymentSource === "apple_iap") {
    return false; // Has active IAP, can't buy Stripe
  }

  // Otherwise, eligible
  return true;
}

/**
 * Get user-friendly message for why they can't purchase
 */
export function getIneligibilityMessage(result: EntitlementResult): string {
  if (!result.hasAccess) {
    return result.reason || "No active subscription";
  }

  if (result.paymentSource === "stripe") {
    return `You already have an active Stripe subscription (${result.plan} plan). To switch to Apple IAP, please cancel your Stripe subscription first.`;
  }

  if (result.paymentSource === "apple_iap") {
    return `You already have an active Apple IAP subscription (${result.plan} plan). To switch to Stripe, please cancel your Apple IAP subscription first.`;
  }

  return "Unable to determine eligibility";
}

// ============================================================================
// Private Helpers
// ============================================================================

function _getSupabaseUrl(): string {
  // In panel-v2.html, SUPABASE_URL is available in the window scope
  // Fallback to environment variable if in Node/Deno context
  if (typeof window !== "undefined" && (window as any).SUPABASE_URL) {
    return (window as any).SUPABASE_URL;
  }
  return Deno.env.get("SUPABASE_URL") || "";
}

function _getAuthToken(): string | null {
  // Try to get auth token from Supabase Auth (stored in localStorage)
  if (typeof localStorage !== "undefined") {
    try {
      const authData = localStorage.getItem(
        `sb-${_getSupabaseUrl().split("://")[1]?.split(".")[0]}-auth-token`
      );
      if (authData) {
        const parsed = JSON.parse(authData);
        return parsed.access_token || null;
      }
    } catch {
      return null;
    }
  }
  return null;
}

// ============================================================================
// Notes
// ============================================================================
//
// Integration in panel-v2.html (example):
//
// ```javascript
// // At start of coach panel load
// import { isEligibleForAppleIAP, checkEntitlement } from "../_shared/entitlement-client.ts";
//
// async function initCoachPanel(coachId) {
//   const elig = await isEligibleForAppleIAP(coachId);
//   if (!elig) {
//     // Hide "Buy Apple IAP" button
//     document.getElementById("buy-apple-btn").style.display = "none";
//     // Show message
//     showAlert("You already have an active Stripe subscription");
//   }
// }
// ```
//
// The check-entitlement endpoint handles:
// - Optional auth (anonymous OK for self-check)
// - Merging Stripe + IAP results
// - Prioritizing Stripe if both active (rare)
// - Grace period logic (grace_period = has access)
