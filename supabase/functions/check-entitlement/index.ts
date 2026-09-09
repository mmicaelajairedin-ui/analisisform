/**
 * Check Entitlement Endpoint
 *
 * Verifica si un coach tiene acceso activo (vía IAP o Stripe).
 * Llamado por:
 * - iOS app: verificar si debe mostrar "upgrade" CTA
 * - Panel web: verificar si coach tiene plan activo
 * - Backend: reconciliación / autorización
 *
 * Request (GET):
 * /functions/v1/check-entitlement?coach_id=...
 *
 * O (POST):
 * {
 *   "coach_id": "...",
 *   "checkType": "iap_only" | "stripe_only" | "any" (default: "any")
 * }
 *
 * Response (200 OK):
 * {
 *   "hasAccess": true,
 *   "coach_id": "...",
 *   "plan": "basic" | "pro",
 *   "paymentSource": "stripe" | "apple_iap",
 *   "status": "active",
 *   "expiresAt": "2026-10-15T...",
 *   "gracePeriodUntil": null
 * }
 *
 * Response (403):
 * {
 *   "hasAccess": false,
 *   "reason": "No active subscription" | "Expired" | "Grace period (3 days)" | etc.
 * }
 *
 * Lógica de acceso:
 * - IAP: status IN ('active', 'grace_period') AND expires_date > NOW() → YES
 * - Stripe: status='active' AND current_period_end > NOW() → YES
 * - Ambas: SI (aunque muy raro)
 * - Ninguna: NO
 *
 * Seguridad:
 * - Requerimientos varían por caller:
 *   - iOS: puede ser anón (pregunta sobre su propio coach_id)
 *   - Panel: requiere auth + admin o self
 *   - Backend: requiere service role
 * - Por defecto: acepta auth JWT (cualquier usuario puede ver su propio status)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { SubscriptionStatus, ENTITLEMENT_STATUSES } from "../_shared/iap-types.ts";

interface EntitlementCheckResult {
  hasAccess: boolean;
  coach_id: string;
  plan?: "basic" | "pro";
  paymentSource?: "stripe" | "apple_iap";
  status?: string;
  expiresAt?: string;
  gracePeriodUntil?: string | null;
  reason?: string;
}

Deno.serve(async (req: Request) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return errorResponse("Server configuration error", 500);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // 1. Parse request (GET o POST)
    let coachId: string | undefined;
    let checkType: "iap_only" | "stripe_only" | "any" = "any";

    if (req.method === "GET") {
      const url = new URL(req.url);
      coachId = url.searchParams.get("coach_id") || undefined;
      checkType = (url.searchParams.get("checkType") as any) || "any";
    } else if (req.method === "POST") {
      const body = await req.json();
      coachId = body.coach_id;
      checkType = body.checkType || "any";
    } else {
      return new Response("Method not allowed", { status: 405 });
    }

    if (!coachId) {
      return errorResponse("Missing coach_id", 400);
    }

    console.log(`[check-entitlement] Checking coach ${coachId} (${checkType})`);

    // 2. Obtener auth context (si existe)
    const authHeader = req.headers.get("Authorization");
    let authUserId: string | null = null;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      try {
        const { data: userData } = await supabase.auth.getUser(token);
        if (userData.user) {
          authUserId = userData.user.id;
        }
      } catch (e) {
        // Auth error, continue without auth context
      }
    }

    // 3. Verificar autorización (opcional, por ahora permisivo)
    // TODO: Implementar autorización estricta
    // - Si auth: solo ver self o admin
    // - Si service role: ver cualquiera

    // 4. Chequear IAP (si aplicable)
    let iapResult: EntitlementCheckResult | null = null;

    if (checkType === "iap_only" || checkType === "any") {
      const { data: iapSub, error: iapError } = await supabase
        .from("usuarios_suscripciones_iap")
        .select("id, status, product_id, expires_date, grace_period_expires_at")
        .eq("coach_id", coachId)
        .single();

      if (!iapError && iapSub) {
        const now = new Date();
        const expiresDate = new Date(iapSub.expires_date);
        const hasAccess =
          ENTITLEMENT_STATUSES.includes(iapSub.status) &&
          expiresDate > now;

        iapResult = {
          hasAccess: hasAccess,
          coach_id: coachId,
          plan: extractPlanFromProductId(iapSub.product_id),
          paymentSource: "apple_iap",
          status: iapSub.status,
          expiresAt: iapSub.expires_date,
          gracePeriodUntil: iapSub.grace_period_expires_at || null,
        };

        if (!hasAccess) {
          iapResult.reason = reasonForNoAccess(iapSub.status, expiresDate);
        }
      }
    }

    // 5. Chequear Stripe (si aplicable)
    let stripeResult: EntitlementCheckResult | null = null;

    if (checkType === "stripe_only" || checkType === "any") {
      const { data: stripeSub, error: stripeError } = await supabase
        .from("usuarios_suscripciones_stripe")
        .select("id, status, plan, current_period_end")
        .eq("coach_id", coachId)
        .eq("status", "active")
        .single();

      if (!stripeError && stripeSub) {
        const now = new Date();
        const currentPeriodEnd = new Date(stripeSub.current_period_end);
        const hasAccess = currentPeriodEnd > now;

        stripeResult = {
          hasAccess: hasAccess,
          coach_id: coachId,
          plan: stripeSub.plan === "basic_monthly" ? "basic" : "pro",
          paymentSource: "stripe",
          status: stripeSub.status,
          expiresAt: stripeSub.current_period_end,
        };

        if (!hasAccess) {
          stripeResult.reason = "Stripe subscription expired";
        }
      }
    }

    // 6. Combinar resultados
    const result = mergeResults(iapResult, stripeResult, checkType);

    if (!result) {
      return new Response(
        JSON.stringify({
          hasAccess: false,
          coach_id: coachId,
          reason: "No active subscription",
        }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log(`[check-entitlement] Result: hasAccess=${result.hasAccess}`);

    const statusCode = result.hasAccess ? 200 : 403;
    return new Response(JSON.stringify(result), {
      status: statusCode,
      headers: { "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[check-entitlement] Error:", error);
    return errorResponse(
      "Internal server error: " + (error instanceof Error ? error.message : "Unknown"),
      500
    );
  }
});

// ============================================================================
// Helpers
// ============================================================================

function extractPlanFromProductId(productId: string): "basic" | "pro" {
  if (productId.includes("pro")) return "pro";
  return "basic";
}

function reasonForNoAccess(status: string, expiresDate: Date): string {
  const now = new Date();

  if (expiresDate <= now) {
    return "Subscription expired";
  }

  switch (status) {
    case SubscriptionStatus.EXPIRED:
      return "Subscription expired";
    case SubscriptionStatus.BILLING_RETRY:
      return "Billing issue (grace period active)";
    case SubscriptionStatus.GRACE_PERIOD:
      return `Grace period active until ${expiresDate.toISOString()}`;
    case SubscriptionStatus.REVOKED:
      return "Subscription revoked";
    case SubscriptionStatus.REFUNDED:
      return "Subscription refunded";
    default:
      return "Subscription inactive";
  }
}

function mergeResults(
  iapResult: EntitlementCheckResult | null,
  stripeResult: EntitlementCheckResult | null,
  checkType: string
): EntitlementCheckResult | null {
  // Si piden solo uno y existe
  if (checkType === "iap_only" && iapResult) return iapResult;
  if (checkType === "stripe_only" && stripeResult) return stripeResult;

  // Si piden any: prioridad a active
  if (checkType === "any") {
    // Si ambas activas: preferir Stripe (es nuestro default)
    if (iapResult?.hasAccess && stripeResult?.hasAccess) {
      return stripeResult;
    }

    // Si una activa: retornar esa
    if (iapResult?.hasAccess) return iapResult;
    if (stripeResult?.hasAccess) return stripeResult;

    // Si ninguna activa pero existen: retornar ambas info (para debugging)
    if (iapResult || stripeResult) {
      return iapResult || stripeResult;
    }
  }

  return null;
}

function errorResponse(error: string, statusCode: number) {
  return new Response(
    JSON.stringify({
      hasAccess: false,
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
// 1. Estados de acceso:
//    - active (Stripe/IAP) → YES
//    - grace_period (IAP solo) → YES (3 días para resolver billing)
//    - billing_retry (IAP) → NO (Apple retrying, sin acceso)
//    - expired (ambos) → NO
//    - revoked (IAP) → NO
//    - refunded (IAP) → NO
//
// 2. Casos de borde:
//    - Coach con Stripe + IAP simultáneamente (raro):
//       Retornar Stripe (es primary)
//    - Coach sin auth token:
//       Aceptar (anón puede preguntar sobre su propio coach_id)
//    - Coach con datos faltantes:
//       Retornar 403 "No active subscription"
//
// 3. Callers esperados:
//    - iOS app: GET /check-entitlement?coach_id=... (anón)
//    - Panel web: POST check-entitlement (auth)
//    - Backend reconciliation: POST (service role)
//
// 4. Caching (opcional):
//    - Datos cambian cada 24h (renewal) o al recibir webhook
//    - Cliente puede cachear 5 min
//    - No implementar en server (stateless mejor)
