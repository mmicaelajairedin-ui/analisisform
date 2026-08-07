// Supabase Edge Function: /functions/v1/dashboard
// Deploy: supabase functions deploy dashboard --no-verify-jwt

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, content-type",
};

interface DashboardResponse {
  version: string;
  timestamp: string;
  cache_ttl_seconds: number;
  organization: {
    id: string;
    name: string;
    owner_id: string;
    stats: {
      coaches: number;
      active_coaches: number;
      max_coaches: number;
      clients: number;
    };
  };
  diagnosis: {
    status: "red" | "orange" | "green";
    critical_alert: Alert | null;
    alert_count: number;
    alert_summary: string;
  };
  today: {
    total_sessions: number;
    upcoming_2h: number;
    cancelled: number;
    completion_rate: number;
  };
  health: {
    level: string;
    title: string;
    explanation: string;
  };
  quick_actions: {
    available: QuickAction[];
  };
  meta: {
    request_id: string;
    execution_time_ms: number;
    cache_hit: boolean;
    auth: {
      user_id: string;
      org_id: string;
      role: string;
    };
  };
}

interface Alert {
  id: string;
  type: string;
  severity: string;
  entity_id: string;
  entity_name: string;
  title: string;
  description: string;
  days_since_issue: number;
  impact_score: number;
  urgency_score: number;
  combined_score: number;
}

interface QuickAction {
  id: string;
  label: string;
  icon: string;
  enabled: boolean;
}

const CACHE_TTL_DEFAULT = 300; // 5 minutes
const CACHE_TTL_CRITICAL = 30; // 30 seconds when alert detected

async function getDashboard(
  orgId: string,
  userId: string,
  userRole: string,
  supabase: any
): Promise<DashboardResponse> {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();

  try {
    // Query A: Diagnosis Engine (Coaches + Clients)
    const { data: alerts, error: alertsError } = await supabase
      .from("diagnostico_view")
      .select("*")
      .eq("org_id", orgId)
      .order("combined_score", { ascending: false })
      .limit(20);

    if (alertsError) throw alertsError;

    // Query B: Today Stats
    const today = new Date().toISOString().split("T")[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];

    const { data: todayStats, error: todayError } = await supabase
      .from("sesiones_registro")
      .select("fecha, estado")
      .eq("org_id", orgId)
      .gte("fecha", today)
      .lt("fecha", tomorrow);

    if (todayError) throw todayError;

    // Organization stats
    const { data: orgData, error: orgError } = await supabase
      .from("organizaciones")
      .select("id, nombre, owner_id, plan_tipo")
      .eq("id", orgId)
      .single();

    if (orgError) throw orgError;

    // Coaches count
    const { count: coachCount, error: coachError } = await supabase
      .from("usuarios")
      .select("*", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("rol", "coach")
      .eq("activo", true);

    if (coachError) throw coachError;

    // Clients count
    const { count: clientCount, error: clientError } = await supabase
      .from("candidatos")
      .select("*", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("activo", true);

    if (clientError) throw clientError;

    // Process alerts
    const processedAlerts = (alerts || []).map((alert: any) => ({
      id: `${alert.tipo}_${alert.entity_id}`,
      type: alert.tipo,
      severity: alert.tipo === "coach_inactivo" ? "orange" : "red",
      entity_id: alert.entity_id,
      entity_name: alert.entity_name,
      title: getTitleForAlert(alert.tipo, alert.entity_name),
      description: getDescriptionForAlert(alert.tipo, alert.days_since_issue),
      days_since_issue: alert.days_since_issue,
      impact_score: calculateImpactScore(alert.tipo),
      urgency_score: calculateUrgencyScore(alert.days_since_issue),
      combined_score:
        calculateImpactScore(alert.tipo) + calculateUrgencyScore(alert.days_since_issue),
    }));

    const criticalAlert =
      processedAlerts.length > 0 ? processedAlerts[0] : null;

    // Process today stats
    const processTodayStats = (sessions: any[]) => {
      const now = new Date();
      const nowPlus2h = new Date(now.getTime() + 2 * 60 * 60 * 1000);

      const total = sessions.length;
      const upcoming = sessions.filter((s: any) => {
        const sesionTime = new Date(s.fecha);
        return sesionTime > now && sesionTime <= nowPlus2h;
      }).length;
      const cancelled = sessions.filter((s: any) => s.estado === "cancelada")
        .length;

      return {
        total_sessions: total,
        upcoming_2h: upcoming,
        cancelled: cancelled,
        completion_rate: total > 0 ? Math.round(((total - cancelled) / total) * 100) : 0,
      };
    };

    const today_stats = processTodayStats(todayStats || []);

    // Determine org health
    const hasRedAlert = processedAlerts.some((a: Alert) => a.severity === "red");
    const hasOrangeAlert = processedAlerts.some(
      (a: Alert) => a.severity === "orange"
    );

    const healthStatus = hasRedAlert
      ? "red"
      : hasOrangeAlert
        ? "orange"
        : "green";

    const healthTitles: Record<string, string> = {
      red: "Riesgo Operativo",
      orange: "Atención Requerida",
      green: "Saludable",
    };

    const executionTime = Date.now() - startTime;
    const cacheTtl = criticalAlert ? CACHE_TTL_CRITICAL : CACHE_TTL_DEFAULT;

    const response: DashboardResponse = {
      version: "1.0",
      timestamp: new Date().toISOString(),
      cache_ttl_seconds: cacheTtl,
      organization: {
        id: orgId,
        name: orgData.nombre,
        owner_id: orgData.owner_id,
        stats: {
          coaches: coachCount || 0,
          active_coaches: coachCount || 0,
          max_coaches: 999,
          clients: clientCount || 0,
        },
      },
      diagnosis: {
        status: healthStatus,
        critical_alert: criticalAlert,
        alert_count: processedAlerts.length,
        alert_summary: generateAlertSummary(processedAlerts),
      },
      today: {
        total_sessions: today_stats.total_sessions,
        upcoming_2h: today_stats.upcoming_2h,
        cancelled: today_stats.cancelled,
        completion_rate: today_stats.completion_rate,
      },
      health: {
        level: healthStatus,
        title: healthTitles[healthStatus],
        explanation: generateHealthExplanation(
          healthStatus,
          processedAlerts,
          today_stats
        ),
      },
      quick_actions: {
        available: [
          {
            id: "new_client",
            label: "Nuevo Cliente",
            icon: "plus",
            enabled: true,
          },
          {
            id: "send_message",
            label: "Mensaje",
            icon: "mail",
            enabled: true,
          },
          {
            id: "schedule_session",
            label: "Agendar Sesión",
            icon: "calendar",
            enabled: true,
          },
          {
            id: "view_analytics",
            label: "Analítica",
            icon: "chart",
            enabled: true,
          },
          {
            id: "settings",
            label: "Configuración",
            icon: "settings",
            enabled: true,
          },
        ],
      },
      meta: {
        request_id: requestId,
        execution_time_ms: executionTime,
        cache_hit: false,
        auth: {
          user_id: userId,
          org_id: orgId,
          role: userRole,
        },
      },
    };

    return response;
  } catch (error) {
    console.error("Dashboard error:", error);
    throw error;
  }
}

function getTitleForAlert(tipo: string, name: string): string {
  const titles: Record<string, string> = {
    coach_inactivo: `${name} inactivo`,
    cliente_sin_actividad: `${name} sin actividad`,
  };
  return titles[tipo] || "Alerta";
}

function getDescriptionForAlert(tipo: string, days: number): string {
  if (tipo === "coach_inactivo") {
    return `Sin actividad en las últimas ${Math.ceil(days)} horas`;
  } else if (tipo === "cliente_sin_actividad") {
    return `Sin sesiones en los últimos ${Math.ceil(days)} días`;
  }
  return "Sin detalles";
}

function calculateImpactScore(tipo: string): number {
  const scores: Record<string, number> = {
    coach_inactivo: 3,
    cliente_sin_actividad: 5,
  };
  return scores[tipo] || 1;
}

function calculateUrgencyScore(daysSince: number): number {
  return Math.min(10, Math.ceil(daysSince * 0.4));
}

function generateAlertSummary(alerts: Alert[]): string {
  if (alerts.length === 0) {
    return "Todo en orden ✓";
  }
  const coaches = alerts.filter((a) => a.type === "coach_inactivo").length;
  const clients = alerts.filter((a) => a.type === "cliente_sin_actividad")
    .length;
  return `${coaches} coach(es) inactivo(s), ${clients} cliente(s) sin sesión`;
}

function generateHealthExplanation(
  level: string,
  alerts: Alert[],
  today: any
): string {
  if (level === "green") {
    return `Tu organización está en buen estado. ${today.total_sessions} sesiones hoy.`;
  } else if (level === "orange") {
    return `Se necesita atención: ${alerts.length} alerta(s) requieren revisión.`;
  } else {
    return `Riesgo operativo detectado. ${alerts.length} alerta(s) crítica(s).`;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_ANON_KEY") || "",
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Get current user from token
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user's organization and role
    const { data: userData, error: userError } = await supabase
      .from("usuarios")
      .select("org_id, rol")
      .eq("auth_id", user.id)
      .single();

    if (userError || !userData) {
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const dashboard = await getDashboard(
      userData.org_id,
      user.id,
      userData.rol,
      supabase
    );

    // Set cache headers
    const cacheControl = `public, max-age=${dashboard.cache_ttl_seconds}`;

    return new Response(JSON.stringify(dashboard), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Cache-Control": cacheControl,
      },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        detail: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
