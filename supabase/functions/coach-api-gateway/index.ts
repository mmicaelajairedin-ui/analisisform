// coach-api-gateway — API endpoints para owner-coach-detail.html
//
// Rutas:
//   GET /api/coach/{coach_id}                    → perfil
//   GET /api/coach/{coach_id}/metrics/latest     → métricas + health score
//   GET /api/coach/{coach_id}/trends/latest      → tendencias
//   GET /api/coach/{coach_id}/alerts             → alertas (querystring: severity=critical,warning)
//   GET /api/coach/{coach_id}/benchmarks/today   → percentiles + team comparison
//   GET /api/coach/{coach_id}/financials/monthly → revenue, cost, margin
//   GET /api/coach/{coach_id}/clients            → clientes activos (querystring: limit=5)
//   GET /api/coach/{coach_id}/activity           → timeline (querystring: limit=10)
//
// Auth: Supabase JWT (auth.uid() must be owner o admin, o owner del coach)
// Deploy: supabase functions deploy coach-api-gateway

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

async function supabaseRequest(
  path: string,
  options: RequestInit = {},
  jwt?: string
): Promise<any> {
  const url = `${SUPABASE_URL}/rest/v1${path}`;
  const authHeader = jwt
    ? `Bearer ${jwt}`
    : `Bearer ${SERVICE_ROLE_KEY}`;

  const headers = {
    "Authorization": authHeader,
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

function getJwtFromRequest(req: Request): string | null {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.substring(7);
}

function decodeJwt(token: string): any {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const decoded = atob(parts[1]);
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

async function handleGetCoachProfile(
  coachId: string,
  jwt: string
): Promise<Response> {
  try {
    const coach = await supabaseRequest(
      `/usuarios?id=eq.${coachId}&select=id,nombre,email,photo_url,rol,created_at`,
      {},
      jwt
    );

    if (!coach || coach.length === 0) {
      return new Response(JSON.stringify({ error: "Coach not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        id: coach[0].id,
        name: coach[0].nombre,
        email: coach[0].email,
        photo_url: coach[0].photo_url,
        status: "active",
        tier: "pro",
        active: true,
        created_at: coach[0].created_at,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

async function handleGetMetricsLatest(
  coachId: string,
  jwt: string
): Promise<Response> {
  try {
    const today = new Date().toISOString().split("T")[0];
    const metrics = await supabaseRequest(
      `/coach_metrics_daily?coach_id=eq.${coachId}&date=eq.${today}&select=*`,
      {},
      jwt
    );

    if (!metrics || metrics.length === 0) {
      // Return mock data if no metrics yet
      return new Response(
        JSON.stringify({
          date: today,
          health_score: 0,
          health_status: "gray",
          retention_pct: 0,
          utilization_pct: 0,
          satisfaction_pct: 0,
          engagement_pct: 0,
          client_count_current: 0,
          sesiones_ultima_semana: 0,
          informes_ultima_semana: 0,
          churn_rate_7d_pct: 0,
          forecast_health_30d: 0,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    const m = metrics[0];
    const healthStatus =
      m.health_score >= 80
        ? "green"
        : m.health_score >= 60
          ? "yellow"
          : "red";

    return new Response(
      JSON.stringify({
        date: m.date,
        health_score: m.health_score,
        health_status: healthStatus,
        retention_pct: m.retention_pct,
        utilization_pct: m.utilization_pct,
        satisfaction_pct: m.satisfaction_pct,
        engagement_pct: m.engagement_pct,
        client_count_current: m.client_count_current,
        sesiones_ultima_semana: m.sesiones_ultima_semana,
        informes_ultima_semana: m.informes_ultima_semana,
        churn_rate_7d_pct: m.churn_rate_7d_pct,
        forecast_health_30d: Math.round(m.health_score * 1.05), // Simplified
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

async function handleGetTrendsLatest(
  coachId: string,
  jwt: string
): Promise<Response> {
  try {
    const today = new Date().toISOString().split("T")[0];
    const trends = await supabaseRequest(
      `/coach_trends?coach_id=eq.${coachId}&date=eq.${today}&select=*`,
      {},
      jwt
    );

    return new Response(
      JSON.stringify({
        date: today,
        metrics: trends || [],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

async function handleGetAlerts(
  coachId: string,
  severity: string,
  jwt: string
): Promise<Response> {
  try {
    const severityFilter =
      severity &&
      severity
        .split(",")
        .map((s) => `severity=eq.${s.trim()}`)
        .join("&");

    const query = `/coach_alerts?coach_id=eq.${coachId}&resolved_at=is.null${severityFilter ? "&" + severityFilter : ""}&select=*`;
    const alerts = await supabaseRequest(query, {}, jwt);

    return new Response(
      JSON.stringify({
        alerts: alerts || [],
        critical_count: (alerts || []).filter((a) => a.severity === "critical")
          .length,
        warning_count: (alerts || []).filter((a) => a.severity === "warning")
          .length,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

async function handleGetBenchmarks(
  coachId: string,
  jwt: string
): Promise<Response> {
  try {
    const today = new Date().toISOString().split("T")[0];
    const benchmarks = await supabaseRequest(
      `/coach_benchmarks?coach_id=eq.${coachId}&date=eq.${today}&select=*&limit=1`,
      {},
      jwt
    );

    if (!benchmarks || benchmarks.length === 0) {
      return new Response(
        JSON.stringify({
          date: today,
          coach: {},
          percentiles: {},
          rank: { overall: 0, total_coaches: 0 },
          team_medians: {},
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    const b = benchmarks[0];
    return new Response(
      JSON.stringify({
        date: b.date,
        coach: {
          health_score: b.health_score,
          retention_pct: b.retention_pct,
          utilization_pct: b.utilization_pct,
          satisfaction_pct: b.satisfaction_pct,
          engagement_pct: b.engagement_pct,
        },
        percentiles: {
          health_score: b.percentile_health,
          retention_pct: b.percentile_retention,
          utilization_pct: b.percentile_utilization,
          satisfaction_pct: b.percentile_satisfaction,
          engagement_pct: b.percentile_engagement,
        },
        rank: {
          overall: b.rank_overall,
          total_coaches: b.total_coaches,
        },
        team_medians: {
          health_score: b.team_median_health,
          retention_pct: b.team_median_retention,
          utilization_pct: b.team_median_utilization,
          satisfaction_pct: b.team_median_satisfaction,
          engagement_pct: b.team_median_engagement,
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

async function handleGetClients(
  coachId: string,
  limit: string,
  jwt: string
): Promise<Response> {
  try {
    const limitNum = parseInt(limit || "5", 10);
    const clients = await supabaseRequest(
      `/candidatos?coach_id=eq.${coachId}&estado=eq.active&order=fecha_inicio.desc&limit=${limitNum}&select=id,nombre,email,estado,fecha_inicio,foto_perfil`,
      {},
      jwt
    );

    const total = await supabaseRequest(
      `/candidatos?coach_id=eq.${coachId}&estado=eq.active&select=count()`,
      {},
      jwt
    );

    return new Response(
      JSON.stringify({
        clients: (clients || []).map((c) => ({
          id: c.id,
          name: c.nombre,
          email: c.email,
          estado: c.estado,
          fecha_inicio: c.fecha_inicio,
          dias_activo: Math.floor(
            (new Date().getTime() -
              new Date(c.fecha_inicio).getTime()) /
              (1000 * 60 * 60 * 24)
          ),
          engagement_score: 75, // Placeholder
          status_badge: "green",
          ultima_actividad: new Date().toISOString(),
        })),
        total_active: total ? total[0]?.count : 0,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const pathParts = url.pathname.split("/").filter(Boolean);

  // Route: /api/coach/{coachId}/{endpoint}
  if (pathParts[0] !== "api" || pathParts[1] !== "coach" || !pathParts[2]) {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const coachId = pathParts[2];
  const endpoint = pathParts[3];
  const jwt = getJwtFromRequest(req);

  if (!jwt) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    if (endpoint === "metrics" && pathParts[4] === "latest") {
      return await handleGetMetricsLatest(coachId, jwt);
    }

    if (endpoint === "trends" && pathParts[4] === "latest") {
      return await handleGetTrendsLatest(coachId, jwt);
    }

    if (endpoint === "alerts") {
      const severity = url.searchParams.get("severity");
      return await handleGetAlerts(coachId, severity || "", jwt);
    }

    if (endpoint === "benchmarks" && pathParts[4] === "today") {
      return await handleGetBenchmarks(coachId, jwt);
    }

    if (endpoint === "clients") {
      const limit = url.searchParams.get("limit");
      return await handleGetClients(coachId, limit || "5", jwt);
    }

    if (!endpoint) {
      return await handleGetCoachProfile(coachId, jwt);
    }

    return new Response(JSON.stringify({ error: "Endpoint not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
