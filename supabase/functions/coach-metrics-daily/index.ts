// coach-metrics-daily — agregación diaria de métricas por coach
//
// Calcula para cada coach:
//   - Conteos: clientes activos, sesiones/informes última semana
//   - Retention%: clientes activos / clientes en últimos 90 días
//   - Utilization%: clientes activos / capacity_max
//   - Satisfaction%: engagement proxy (actividad)
//   - Engagement%: last_login + sesiones + informes + mensajes
//   - Health Score: aggregate de las 4 dimensiones
//   - Churn rate 7d%
//
// Output: popula coach_metrics_daily (inmutable, one row per coach per day)
//
// Disparo: scheduled daily 02:00, 04:00, 05:00, 06:00, 07:00 UTC
// Header: X-Trigger-Secret = AGENT_TRIGGER_SECRET
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, AGENT_TRIGGER_SECRET
// Deploy: supabase functions deploy coach-metrics-daily --no-verify-jwt

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const TRIGGER_SECRET = Deno.env.get("AGENT_TRIGGER_SECRET");

interface CoachMetrics {
  coach_id: string;
  date: string;
  client_count_current: number;
  sesiones_ultima_semana: number;
  informes_ultima_semana: number;
  mensajes_ultima_semana: number;
  retention_pct: number;
  utilization_pct: number;
  satisfaction_pct: number;
  engagement_pct: number;
  health_score: number;
  churn_rate_7d_pct: number;
}

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

async function calculateEngagementScore(
  coachId: string,
  lastLogin: string | null
): Promise<number> {
  // Engagement = last_login(40%) + sesiones(30%) + informes(20%) + mensajes(10%)
  let score = 0;

  // Last login component (40 points max)
  if (lastLogin) {
    const lastLoginDate = new Date(lastLogin);
    const daysSinceLogin = Math.floor(
      (new Date().getTime() - lastLoginDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSinceLogin < 1) score += 40;
    else if (daysSinceLogin < 3) score += 25;
    else if (daysSinceLogin < 7) score += 15;
    // else score += 0
  }

  // Sesiones última semana (30 points max) — obtenemos del query siguiente
  // Informes última semana (20 points max)
  // Mensajes última semana (10 points max)
  // Estos se añaden en el loop principal

  return Math.min(score, 100);
}

async function computeCoachMetrics(
  coachId: string,
  today: string
): Promise<CoachMetrics | null> {
  try {
    // 1. Contar clientes activos
    const activeClients = await supabaseRequest(
      `/candidatos?coach_id=eq.${coachId}&estado=eq.active&select=count(id)`
    );
    const clientCountCurrent = activeClients[0]?.count || 0;

    // 2. Contar clientes en últimos 90 días (para retention)
    const allClientsIn90d = await supabaseRequest(
      `/candidatos?coach_id=eq.${coachId}&fecha_inicio=gte.${new Date(new Date().setDate(new Date().getDate() - 90)).toISOString().split("T")[0]}&select=count(id)`
    );
    const totalClientsIn90d = allClientsIn90d[0]?.count || 1; // Avoid division by zero

    // 3. Sesiones última semana
    const oneWeekAgo = new Date(new Date().setDate(new Date().getDate() - 7))
      .toISOString()
      .split("T")[0];
    const sessionsWeek = await supabaseRequest(
      `/sesiones_registro?coach_id=eq.${coachId}&fecha=gte.${oneWeekAgo}&select=count(id)`
    );
    const sesionesUltimaSemana = sessionsWeek[0]?.count || 0;

    // 4. Informes última semana
    const reportsWeek = await supabaseRequest(
      `/informes?coach_id=eq.${coachId}&fecha_creacion=gte.${oneWeekAgo}&select=count(id)`
    );
    const informesUltimaSemana = reportsWeek[0]?.count || 0;

    // 5. Mensajes última semana (si existe tabla mensajes)
    let mensajesUltimaSemana = 0;
    try {
      const messagesWeek = await supabaseRequest(
        `/mensajes?coach_id=eq.${coachId}&fecha=gte.${oneWeekAgo}&select=count(id)`
      );
      mensajesUltimaSemana = messagesWeek[0]?.count || 0;
    } catch {
      // Tabla mensajes podría no existir aún
    }

    // 6. Obtener last_login del coach
    const coachData = await supabaseRequest(
      `/usuarios?id=eq.${coachId}&select=last_login`
    );
    const lastLogin = coachData[0]?.last_login || null;

    // 7. Capacity
    const capacity = await supabaseRequest(
      `/coach_capacity_config?coach_id=eq.${coachId}&active=eq.true&select=capacity_max`
    );
    const capacityMax = capacity[0]?.capacity_max || 15;

    // 8. Retention%
    const retentionPct =
      totalClientsIn90d > 0 ? (clientCountCurrent / totalClientsIn90d) * 100 : 0;

    // 9. Utilization%
    const utilizationPct = (clientCountCurrent / capacityMax) * 100;

    // 10. Satisfaction% (proxy: engagement based on activity)
    const satisfactionPct = Math.min(
      100,
      (sesionesUltimaSemana / 5) * 100 // Assume 5+ sessions = good
    );

    // 11. Engagement%
    let engagementPct = await calculateEngagementScore(coachId, lastLogin);
    engagementPct += (sesionesUltimaSemana / 5) * 30; // Sessions component
    engagementPct += (informesUltimaSemana / 2) * 20; // Reports component
    engagementPct += (mensajesUltimaSemana / 10) * 10; // Messages component
    engagementPct = Math.min(engagementPct, 100);

    // 12. Health Score = 40% retention + 25% utilization + 20% satisfaction + 15% engagement
    const healthScore = Math.round(
      retentionPct * 0.4 +
        utilizationPct * 0.25 +
        satisfactionPct * 0.2 +
        engagementPct * 0.15
    );

    // 13. Churn rate 7d
    // Count clients who churned in last 7 days
    const churned7d = await supabaseRequest(
      `/candidatos?coach_id=eq.${coachId}&estado=eq.churned&fecha_inicio=gte.${oneWeekAgo}&select=count(id)`
    );
    const churnedCount = churned7d[0]?.count || 0;
    const churnRate7dPct =
      totalClientsIn90d > 0 ? (churnedCount / totalClientsIn90d) * 100 : 0;

    return {
      coach_id: coachId,
      date: today,
      client_count_current: clientCountCurrent,
      sesiones_ultima_semana: sesionesUltimaSemana,
      informes_ultima_semana: informesUltimaSemana,
      mensajes_ultima_semana: mensajesUltimaSemana,
      retention_pct: parseFloat(retentionPct.toFixed(2)),
      utilization_pct: parseFloat(utilizationPct.toFixed(2)),
      satisfaction_pct: parseFloat(satisfactionPct.toFixed(2)),
      engagement_pct: parseFloat(engagementPct.toFixed(2)),
      health_score: Math.max(0, Math.min(100, healthScore)),
      churn_rate_7d_pct: parseFloat(churnRate7dPct.toFixed(2)),
    };
  } catch (error) {
    console.error(`Error computing metrics for coach ${coachId}:`, error);
    return null;
  }
}

Deno.serve(async (req) => {
  // Verify trigger secret
  const secret = req.headers.get("X-Trigger-Secret");
  if (secret !== TRIGGER_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const today = new Date().toISOString().split("T")[0];

    // Get all active coaches
    const coaches = await supabaseRequest(
      `/usuarios?rol=eq.coach&active=eq.true&select=id`
    );

    if (!coaches || coaches.length === 0) {
      return new Response("No coaches found", { status: 200 });
    }

    // Compute metrics for each coach
    const metricsToInsert: CoachMetrics[] = [];
    for (const coach of coaches) {
      const metrics = await computeCoachMetrics(coach.id, today);
      if (metrics) {
        metricsToInsert.push(metrics);
      }
    }

    // Insert/upsert into coach_metrics_daily
    if (metricsToInsert.length > 0) {
      await supabaseRequest(`/coach_metrics_daily`, {
        method: "POST",
        headers: {
          "Prefer": "resolution=merge-duplicates",
        },
        body: JSON.stringify(metricsToInsert),
      });

      console.log(
        `Computed and stored metrics for ${metricsToInsert.length} coaches`
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        coaches_processed: metricsToInsert.length,
        date: today,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in coach-metrics-daily:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
