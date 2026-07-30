// coach-trends-daily — cálculo de tendencias y forecasts
//
// Compara valores actuales con 7d/30d/90d atrás:
//   - change_7d = value_today - value_7d_ago
//   - velocity = change / 7 días
//   - forecast_30d = value_today + (velocity × 30)
//   - direction = 'up', 'down', 'flat'
//
// Output: popula coach_trends (una row per coach per metric per day)
//
// Disparo: diario 07:00 UTC (después de coach-metrics-daily)
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, AGENT_TRIGGER_SECRET
// Deploy: supabase functions deploy coach-trends-daily --no-verify-jwt

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

interface Trend {
  coach_id: string;
  metric_name: string;
  date: string;
  value_current: number;
  value_7d_ago: number | null;
  value_30d_ago: number | null;
  value_90d_ago: number | null;
  change_7d: number | null;
  change_7d_pct: number | null;
  change_30d_pct: number | null;
  change_90d_pct: number | null;
  direction_7d: string;
  velocity: number | null;
  forecast_30d: number | null;
}

function getDirection(change: number | null): string {
  if (change === null || change === 0) return "flat";
  return change > 0 ? "up" : "down";
}

async function getHistoricalValue(
  coachId: string,
  daysAgo: number
): Promise<{ [key: string]: number }> {
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() - daysAgo);
  const dateStr = targetDate.toISOString().split("T")[0];

  try {
    const metrics = await supabaseRequest(
      `/coach_metrics_daily?coach_id=eq.${coachId}&date=eq.${dateStr}&select=health_score,retention_pct,utilization_pct,satisfaction_pct,engagement_pct`
    );

    if (metrics && metrics.length > 0) {
      return metrics[0];
    }
  } catch (error) {
    console.warn(`Could not fetch metrics for ${daysAgo} days ago:`, error);
  }

  return {};
}

Deno.serve(async (req) => {
  // Verify trigger secret
  const secret = req.headers.get("X-Trigger-Secret");
  if (secret !== TRIGGER_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const today = new Date().toISOString().split("T")[0];
    const METRICS_NAMES = [
      "health_score",
      "retention_pct",
      "utilization_pct",
      "satisfaction_pct",
      "engagement_pct",
    ];

    // Get all metrics for today
    const metricsToday = await supabaseRequest(
      `/coach_metrics_daily?date=eq.${today}&select=*`
    );

    if (!metricsToday || metricsToday.length === 0) {
      return new Response("No metrics available for today", { status: 200 });
    }

    const trends: Trend[] = [];

    // For each coach and each metric, compute trends
    for (const metrics of metricsToday) {
      const coachId = metrics.coach_id;

      // Fetch historical values
      const values7d = await getHistoricalValue(coachId, 7);
      const values30d = await getHistoricalValue(coachId, 30);
      const values90d = await getHistoricalValue(coachId, 90);

      for (const metricName of METRICS_NAMES) {
        const valueCurrent = metrics[metricName] || 0;
        const value7dAgo = values7d[metricName] || null;
        const value30dAgo = values30d[metricName] || null;
        const value90dAgo = values90d[metricName] || null;

        // Calculate changes
        const change7d =
          value7dAgo !== null ? valueCurrent - value7dAgo : null;
        const change7dPct =
          value7dAgo !== null && value7dAgo !== 0
            ? ((valueCurrent / value7dAgo - 1) * 100)
            : null;
        const change30dPct =
          value30dAgo !== null && value30dAgo !== 0
            ? ((valueCurrent / value30dAgo - 1) * 100)
            : null;
        const change90dPct =
          value90dAgo !== null && value90dAgo !== 0
            ? ((valueCurrent / value90dAgo - 1) * 100)
            : null;

        // Calculate velocity and forecast
        const velocity = change7d !== null ? change7d / 7 : null;
        const forecast30d =
          velocity !== null ? valueCurrent + velocity * 30 : null;

        // Direction
        const direction = getDirection(change7d);

        trends.push({
          coach_id: coachId,
          metric_name: metricName,
          date: today,
          value_current: valueCurrent,
          value_7d_ago: value7dAgo,
          value_30d_ago: value30dAgo,
          value_90d_ago: value90dAgo,
          change_7d: change7d,
          change_7d_pct: change7dPct ? parseFloat(change7dPct.toFixed(2)) : null,
          change_30d_pct: change30dPct
            ? parseFloat(change30dPct.toFixed(2))
            : null,
          change_90d_pct: change90dPct
            ? parseFloat(change90dPct.toFixed(2))
            : null,
          direction_7d: direction,
          velocity: velocity ? parseFloat(velocity.toFixed(2)) : null,
          forecast_30d: forecast30d
            ? parseFloat(forecast30d.toFixed(2))
            : null,
        });
      }
    }

    // Upsert trends
    if (trends.length > 0) {
      await supabaseRequest(`/coach_trends`, {
        method: "POST",
        headers: {
          "Prefer": "resolution=merge-duplicates",
        },
        body: JSON.stringify(trends),
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        trends_created: trends.length,
        date: today,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in coach-trends-daily:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
