// coach-alerts-hourly — evaluación de alertas por umbral
//
// Usa coach_metrics_daily + coach_alert_thresholds para detectar:
//   - Condiciones que disparan alertas (burnout, overload, churn alto, etc.)
//   - Cierra alertas cuando la condición se invierte
//
// Output: crea/resuelve rows en coach_alerts
//
// Disparo: cada hora (top of hour)
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, AGENT_TRIGGER_SECRET
// Deploy: supabase functions deploy coach-alerts-hourly --no-verify-jwt

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const TRIGGER_SECRET = Deno.env.get("AGENT_TRIGGER_SECRET");

async function supabaseRequest(
  path: string,
  options: RequestInit = {}
): Promise<any> {
  const url = `${SUPABASE_URL}/rest/v1${path}`;
  const headers = {
    "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
    ...options.headers,
  };

  const response = await fetch(url, { ...options, headers });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Supabase API error: ${response.status} ${error}`);
  }

  return response.json();
}

interface AlertThreshold {
  id: string;
  alert_type: string;
  threshold_value: number;
  threshold_operator: string;
  secondary_condition: string | null;
  severity: string;
  recommended_action_template: string;
}

interface CoachMetricsDaily {
  coach_id: string;
  health_score: number;
  retention_pct: number;
  utilization_pct: number;
  satisfaction_pct: number;
  engagement_pct: number;
  client_count_current: number;
  churn_rate_7d_pct: number;
  sesiones_ultima_semana: number;
}

function checkCondition(
  metricValue: number,
  thresholdValue: number,
  operator: string
): boolean {
  switch (operator) {
    case "<":
      return metricValue < thresholdValue;
    case ">":
      return metricValue > thresholdValue;
    case "<=":
      return metricValue <= thresholdValue;
    case ">=":
      return metricValue >= thresholdValue;
    case "=":
      return metricValue === thresholdValue;
    case "<>":
      return metricValue !== thresholdValue;
    default:
      return false;
  }
}

function evaluateSecondaryCondition(
  condition: string | null,
  metrics: CoachMetricsDaily
): boolean {
  if (!condition) return true;

  // Parse conditions like "last_login > 7d", "trend_7d < -10%"
  // For now, simplified: just check if condition mentions a metric we have

  if (condition.includes("last_login > 7d")) {
    // Placeholder: we'd need historical data to compute this
    return true;
  }

  if (condition.includes("trend_7d")) {
    // Placeholder: would need trends table
    return true;
  }

  if (condition.includes("client_count > 0")) {
    return metrics.client_count_current > 0;
  }

  return true;
}

function interpolateTemplate(
  template: string,
  metrics: CoachMetricsDaily
): string {
  let result = template;
  result = result.replace("{engagement_score}", Math.round(metrics.engagement_pct).toString());
  result = result.replace("{utilization_pct}", Math.round(metrics.utilization_pct).toString());
  result = result.replace("{churn_rate_7d}", Math.round(metrics.churn_rate_7d_pct).toString());
  result = result.replace("{retention_pct}", Math.round(metrics.retention_pct).toString());
  result = result.replace("{client_count}", metrics.client_count_current.toString());
  result = result.replace("{health_score}", metrics.health_score?.toString() || "0");
  result = result.replace("{last_login_days}", "2"); // Placeholder
  return result;
}

Deno.serve(async (req) => {
  // Verify trigger secret
  const secret = req.headers.get("X-Trigger-Secret");
  if (secret !== TRIGGER_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    // 1. Get all active thresholds
    const thresholds: AlertThreshold[] = await supabaseRequest(
      `/coach_alert_thresholds?active=eq.true&select=*`
    );

    // 2. Get latest metrics for all coaches
    const today = new Date().toISOString().split("T")[0];
    const latestMetrics: CoachMetricsDaily[] = await supabaseRequest(
      `/coach_metrics_daily?date=eq.${today}&select=*`
    );

    if (!latestMetrics || latestMetrics.length === 0) {
      return new Response("No metrics available yet", { status: 200 });
    }

    let alertsCreated = 0;
    let alertsResolved = 0;

    // 3. For each coach's metrics, evaluate against all thresholds
    for (const metrics of latestMetrics) {
      for (const threshold of thresholds) {
        // Get metric value
        let metricValue = 0;
        if (threshold.alert_type.includes("engagement"))
          metricValue = metrics.engagement_pct;
        else if (threshold.alert_type.includes("utilization"))
          metricValue = metrics.utilization_pct;
        else if (threshold.alert_type.includes("churn"))
          metricValue = metrics.churn_rate_7d_pct;
        else if (threshold.alert_type.includes("retention"))
          metricValue = metrics.retention_pct;
        else if (threshold.alert_type.includes("overload"))
          metricValue = metrics.utilization_pct;
        else if (threshold.alert_type.includes("burnout"))
          metricValue = metrics.engagement_pct;
        else continue;

        // Check if triggered
        const isTriggered =
          checkCondition(
            metricValue,
            threshold.threshold_value,
            threshold.threshold_operator
          ) &&
          evaluateSecondaryCondition(threshold.secondary_condition, metrics);

        if (isTriggered) {
          // Check if alert already exists (open)
          const existingAlert = await supabaseRequest(
            `/coach_alerts?coach_id=eq.${metrics.coach_id}&alert_type=eq.${threshold.alert_type}&resolved_at=is.null&limit=1`
          );

          if (!existingAlert || existingAlert.length === 0) {
            // Create new alert
            const context = {
              engagement_score: metrics.engagement_pct,
              utilization_pct: metrics.utilization_pct,
              churn_rate_7d: metrics.churn_rate_7d_pct,
              retention_pct: metrics.retention_pct,
              client_count: metrics.client_count_current,
              threshold_value: threshold.threshold_value,
              threshold_operator: threshold.threshold_operator,
            };

            const recommendedAction = interpolateTemplate(
              threshold.recommended_action_template || "",
              metrics
            );

            await supabaseRequest(`/coach_alerts`, {
              method: "POST",
              body: JSON.stringify({
                coach_id: metrics.coach_id,
                alert_type: threshold.alert_type,
                severity: threshold.severity,
                context: context,
                recommended_action: recommendedAction,
              }),
            });

            alertsCreated++;
          }
        } else {
          // Condition not triggered — check if we should resolve existing alerts
          const openAlerts = await supabaseRequest(
            `/coach_alerts?coach_id=eq.${metrics.coach_id}&alert_type=eq.${threshold.alert_type}&resolved_at=is.null`
          );

          if (openAlerts && openAlerts.length > 0) {
            const alert = openAlerts[0];
            // Check if condition has been false for 24h (simplified: just resolve now)
            const now = new Date().toISOString();

            await supabaseRequest(`/coach_alerts?id=eq.${alert.id}`, {
              method: "PATCH",
              body: JSON.stringify({ resolved_at: now }),
            });

            alertsResolved++;
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        alerts_created: alertsCreated,
        alerts_resolved: alertsResolved,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in coach-alerts-hourly:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
