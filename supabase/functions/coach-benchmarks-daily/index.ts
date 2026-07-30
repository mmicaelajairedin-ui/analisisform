// coach-benchmarks-daily — cálculo de percentiles diarios
//
// Para cada métrica, calcula:
//   - Mediana del equipo
//   - Percentil de cada coach (qué % del equipo está debajo)
//   - Ranking overall (1 = mejor, N = peor)
//
// Output: popula coach_benchmarks
//
// Disparo: diario 05:30 UTC (después de coach-metrics-daily)
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, AGENT_TRIGGER_SECRET
// Deploy: supabase functions deploy coach-benchmarks-daily --no-verify-jwt

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

function calculatePercentile(
  value: number,
  allValues: number[]
): number {
  const sorted = [...allValues].sort((a, b) => a - b);
  const lessThan = sorted.filter((v) => v < value).length;
  return Math.round((lessThan / allValues.length) * 100);
}

function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

Deno.serve(async (req) => {
  // Verify trigger secret
  const secret = req.headers.get("X-Trigger-Secret");
  if (secret !== TRIGGER_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const today = new Date().toISOString().split("T")[0];

    // Get all metrics for today
    const metricsToday = await supabaseRequest(
      `/coach_metrics_daily?date=eq.${today}&select=*`
    );

    if (!metricsToday || metricsToday.length === 0) {
      return new Response("No metrics available for today", { status: 200 });
    }

    // Extract all values for each metric
    const healthScores = metricsToday.map((m) => m.health_score);
    const retentionPcts = metricsToday.map((m) => m.retention_pct);
    const utilizationPcts = metricsToday.map((m) => m.utilization_pct);
    const satisfactionPcts = metricsToday.map((m) => m.satisfaction_pct);
    const engagementPcts = metricsToday.map((m) => m.engagement_pct);

    // Calculate team medians
    const teamMedianHealth = calculateMedian(healthScores);
    const teamMedianRetention = calculateMedian(retentionPcts);
    const teamMedianUtilization = calculateMedian(utilizationPcts);
    const teamMedianSatisfaction = calculateMedian(satisfactionPcts);
    const teamMedianEngagement = calculateMedian(engagementPcts);

    // Create benchmark entries
    const benchmarks = metricsToday.map((metrics) => ({
      coach_id: metrics.coach_id,
      date: today,

      // Raw metrics
      health_score: metrics.health_score,
      retention_pct: metrics.retention_pct,
      utilization_pct: metrics.utilization_pct,
      satisfaction_pct: metrics.satisfaction_pct,
      engagement_pct: metrics.engagement_pct,

      // Percentiles
      percentile_health: calculatePercentile(
        metrics.health_score,
        healthScores
      ),
      percentile_retention: calculatePercentile(
        metrics.retention_pct,
        retentionPcts
      ),
      percentile_utilization: calculatePercentile(
        metrics.utilization_pct,
        utilizationPcts
      ),
      percentile_satisfaction: calculatePercentile(
        metrics.satisfaction_pct,
        satisfactionPcts
      ),
      percentile_engagement: calculatePercentile(
        metrics.engagement_pct,
        engagementPcts
      ),

      // Team aggregates
      team_median_health: Math.round(teamMedianHealth),
      team_median_retention: parseFloat(teamMedianRetention.toFixed(2)),
      team_median_utilization: parseFloat(teamMedianUtilization.toFixed(2)),
      team_median_satisfaction: parseFloat(teamMedianSatisfaction.toFixed(2)),
      team_median_engagement: parseFloat(teamMedianEngagement.toFixed(2)),

      // Ranking (rank by health_score DESC)
      rank_overall: 0, // Will be set in next step
      total_coaches: metricsToday.length,
    }));

    // Assign rankings
    const rankedByHealth = [...benchmarks].sort(
      (a, b) => b.health_score - a.health_score
    );
    for (let i = 0; i < rankedByHealth.length; i++) {
      const coachId = rankedByHealth[i].coach_id;
      const benchmark = benchmarks.find((b) => b.coach_id === coachId);
      if (benchmark) {
        benchmark.rank_overall = i + 1;
      }
    }

    // Upsert benchmarks
    await supabaseRequest(`/coach_benchmarks`, {
      method: "POST",
      headers: {
        "Prefer": "resolution=merge-duplicates",
      },
      body: JSON.stringify(benchmarks),
    });

    return new Response(
      JSON.stringify({
        success: true,
        benchmarks_created: benchmarks.length,
        date: today,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in coach-benchmarks-daily:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
