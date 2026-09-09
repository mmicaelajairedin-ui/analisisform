/**
 * Daily Double Charge Detection Job
 *
 * Runs daily via cron (GitHub Actions or Supabase Cron).
 * Detects coaches with simultaneous active Stripe + IAP subscriptions.
 * Inserts suspicious records for admin review + sends notification.
 *
 * Invoked: POST /functions/v1/detect-double-charges
 * Auth: Requires X-Detect-Secret header (env var DETECT_SECRET)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

interface SuspiciousDoubleCharge {
  coach_id: string;
  stripe_charge_id: string | null;
  apple_transaction_id: string | null;
  stripe_amount: number | null;
  apple_amount: number | null;
  time_delta_ms: number;
  currency: string;
  severity: "auto_refund" | "review" | "false_positive";
  detected_at: string;
}

Deno.serve(async (req: Request) => {
  try {
    // 1. Security: validate trigger secret
    const triggerSecret = req.headers.get("X-Detect-Secret");
    const expectedSecret = Deno.env.get("DETECT_SECRET");

    if (!triggerSecret || triggerSecret !== expectedSecret) {
      return errorResponse("Unauthorized", 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return errorResponse("Server configuration error", 500);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    console.log("[detect-double-charges] Starting daily detection job");

    // 2. Query detect_double_charges() helper function
    const { data: suspiciousList, error: detectError } = await supabase.rpc(
      "detect_double_charges",
      {}
    );

    if (detectError) {
      console.error("[detect-double-charges] RPC error:", detectError);
      return errorResponse(
        "Detection query failed: " + detectError.message,
        500
      );
    }

    if (!suspiciousList || suspiciousList.length === 0) {
      console.log("[detect-double-charges] No suspicious cases detected");
      return successResponse("No suspicious double charges detected", {
        count: 0,
      });
    }

    console.log(
      `[detect-double-charges] Found ${suspiciousList.length} suspicious cases`
    );

    // 3. Insert suspicious records into suspicious_double_charges table
    const recordsToInsert = suspiciousList.map((charge: any) => ({
      coach_id: charge.coach_id,
      stripe_charge_id: charge.stripe_charge_id,
      apple_transaction_id: charge.apple_transaction_id,
      stripe_amount: charge.stripe_amount,
      apple_amount: charge.apple_amount,
      time_delta_ms: charge.time_delta_ms || 0,
      currency: charge.currency || "USD",
      severity: determineSeverity(charge),
      detected_at: new Date().toISOString(),
      resolved: false,
      notification_sent: false,
    }));

    const { data: insertedRecords, error: insertError } = await supabase
      .from("suspicious_double_charges")
      .insert(recordsToInsert)
      .select();

    if (insertError) {
      console.error("[detect-double-charges] Insert error:", insertError);
      return errorResponse("Failed to insert records: " + insertError.message, 500);
    }

    console.log(
      `[detect-double-charges] Inserted ${insertedRecords?.length || 0} records`
    );

    // 4. Send admin notification
    const adminEmail = Deno.env.get("ADMIN_EMAIL");
    if (adminEmail && insertedRecords && insertedRecords.length > 0) {
      await sendAdminNotification(
        supabase,
        adminEmail,
        insertedRecords as SuspiciousDoubleCharge[]
      );
    }

    return successResponse("Double charge detection completed", {
      count: insertedRecords?.length || 0,
      records: insertedRecords,
    });

  } catch (error) {
    console.error("[detect-double-charges] Error:", error);
    return errorResponse(
      "Internal server error: " + (error instanceof Error ? error.message : "Unknown"),
      500
    );
  }
});

// ============================================================================
// Helpers
// ============================================================================

function determineSeverity(
  charge: any
): "auto_refund" | "review" | "false_positive" {
  // Heuristic: if amounts match and time delta < 1 hour, likely duplicate charge
  const amountsDiff = Math.abs(
    (charge.stripe_amount || 0) - (charge.apple_amount || 0)
  );
  const timeDelta = charge.time_delta_ms || 0;

  if (amountsDiff < 1 && timeDelta < 3600000) {
    // Same amount, < 1 hour apart
    return "auto_refund"; // Mark for immediate review/refund
  }

  if (amountsDiff < 10) {
    return "review"; // Similar amounts, manual review needed
  }

  return "false_positive"; // Likely different transactions
}

async function sendAdminNotification(
  supabase: any,
  adminEmail: string,
  records: SuspiciousDoubleCharge[]
): Promise<void> {
  const criticalCount = records.filter((r) => r.severity === "auto_refund")
    .length;
  const reviewCount = records.filter((r) => r.severity === "review").length;

  const subject = `[URGENT] ${criticalCount} potential double charges detected`;
  const body = `
Daily Double Charge Detection Report
====================================

Date: ${new Date().toISOString()}

CRITICAL (auto_refund): ${criticalCount} cases
REVIEW NEEDED: ${reviewCount} cases
FALSE POSITIVES: ${records.filter((r) => r.severity === "false_positive").length} cases

Affected Coaches: ${new Set(records.map((r) => r.coach_id)).size}

Details:
${records
  .sort((a, b) => (a.severity === "auto_refund" ? -1 : 1))
  .slice(0, 10)
  .map(
    (r) =>
      `- Coach ${r.coach_id}: Stripe $${r.stripe_amount} vs Apple $${r.apple_amount} (${r.severity})`
  )
  .join("\n")}

Action: Review in panel → Admin → Double Charge Tracking
  `;

  try {
    // Call send-email edge function (reuse existing)
    const response = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-email`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({
          to: adminEmail,
          subject,
          html: `<pre>${body}</pre>`,
        }),
      }
    );

    if (!response.ok) {
      console.error(
        "[detect-double-charges] Email notification failed:",
        await response.text()
      );
    } else {
      console.log("[detect-double-charges] Admin notification sent");
    }
  } catch (error) {
    console.error("[detect-double-charges] Email error:", error);
  }
}

function successResponse(message: string, data: any) {
  return new Response(
    JSON.stringify({
      success: true,
      message,
      ...data,
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
      success: false,
      error,
      statusCode,
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
// Severity determination (heuristic):
// - auto_refund: same amount + within 1 hour = almost certainly duplicate
// - review: similar amount = likely duplicate, needs manual confirmation
// - false_positive: different amounts = likely intentional (different plans, upgrades)
//
// The logic can be refined based on actual patterns discovered in production.
//
// To run manually:
// curl -X POST https://api.pathwaycareercoach.com/functions/v1/detect-double-charges \
//   -H "X-Detect-Secret: $DETECT_SECRET"
//
// To schedule (GitHub Actions):
// .github/workflows/detect-double-charges-daily.yml (cron: 0 1 * * * UTC = 01:00 UTC daily)
