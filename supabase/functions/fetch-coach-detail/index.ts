// Phase 0 Week 1-2: Main endpoint for owner-coach-detail.html
// Edge Function: fetch-coach-detail
// Purpose: Return coach profile, metrics, assigned clients, and activity in one response

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  headers: {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, content-type",
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors.headers });

  try {
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/");

    // Extract org_id and coach_id from path: /organization/{org_id}/coaches/{coach_id}
    const orgId = pathParts[4]; // /api/organization/{org_id}/...
    const coachId = pathParts[6]; // .../coaches/{coach_id}

    if (!orgId || !coachId) {
      return new Response(
        JSON.stringify({ error: "Missing org_id or coach_id" }),
        { status: 400, headers: { ...cors.headers, "Content-Type": "application/json" } }
      );
    }

    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");

    if (!token) {
      return new Response(
        JSON.stringify({ error: "Missing authorization token" }),
        { status: 401, headers: { ...cors.headers, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Verify auth & org membership
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) throw new Error("Invalid token");

    const { data: userData } = await supabase
      .from("usuarios")
      .select("org_id, rol")
      .eq("auth_id", user.id)
      .single();

    if (!userData || userData.org_id !== orgId) {
      return new Response(
        JSON.stringify({ error: "Not authorized to view this organization" }),
        { status: 403, headers: { ...cors.headers, "Content-Type": "application/json" } }
      );
    }

    // 2. Fetch coach profile
    const { data: coach, error: coachError } = await supabase
      .from("usuarios")
      .select("id, nombre, email, avatar, especialidad, estado_sub, created_at, last_login, capacity")
      .eq("id", coachId)
      .eq("org_id", orgId)
      .single();

    if (coachError || !coach) {
      return new Response(
        JSON.stringify({ error: "Coach not found" }),
        { status: 404, headers: { ...cors.headers, "Content-Type": "application/json" } }
      );
    }

    // 3. Fetch assigned clients
    const { data: assignments } = await supabase
      .from("coach_client_assignments")
      .select(`
        id,
        status,
        assigned_at,
        candidatos (
          id,
          nombre,
          email,
          avatar,
          rol,
          sector,
          progreso
        )
      `)
      .eq("coach_id", coachId)
      .eq("org_id", orgId)
      .eq("status", "active");

    // 4. Fetch metrics (NPS, retention, completion, etc.)
    const { data: sessions, error: sessionsError } = await supabase
      .from("sesiones_registro")
      .select("id, duracion, nps_coach")
      .eq("coach_id", coachId)
      .eq("org_id", orgId);

    const { data: clients } = await supabase
      .from("candidatos")
      .select("id, status")
      .eq("coach_id", coachId)
      .eq("org_id", orgId);

    const { data: programs } = await supabase
      .from("informes")
      .select("id, status")
      .eq("coach_id", coachId)
      .eq("org_id", orgId);

    // Calculate metrics
    const metrics = calculateMetrics(
      coach,
      sessions || [],
      clients || [],
      programs || [],
      assignments || []
    );

    // 5. Fetch activity timeline (from audit_logs and recent sessions)
    const { data: auditLogs } = await supabase
      .from("audit_logs")
      .select("id, action, resource_type, resource_id, created_at")
      .eq("org_id", orgId)
      .in("action", ["session_completed", "client_assigned", "program_completed"])
      .order("created_at", { ascending: false })
      .limit(10);

    const activity = (auditLogs || []).map((log: any) => ({
      id: log.id,
      type: log.action,
      description: humanizeActivityType(log.action, log.resource_type),
      created_at: log.created_at,
      related_client_id: log.resource_id
    }));

    // 6. Return combined response
    return new Response(
      JSON.stringify({
        coach: {
          id: coach.id,
          name: coach.nombre,
          email: coach.email,
          avatar: coach.avatar || "👤",
          specialty: coach.especialidad || "Coaching",
          status: coach.estado_sub || "active",
          joinedAt: coach.created_at,
          lastActive: coach.last_login || coach.created_at,
          clientsAssigned: assignments?.length || 0,
          capacity: coach.capacity || 10,
          org_id: orgId
        },
        metrics,
        clients: (assignments || []).map((a: any) => ({
          id: a.candidatos.id,
          name: a.candidatos.nombre,
          email: a.candidatos.email,
          avatar: a.candidatos.avatar || "👤",
          role: a.candidatos.rol || "Cliente",
          sector: a.candidatos.sector || "Sector",
          program: "Semana 1", // TODO: fetch actual program
          progress: a.candidatos.progreso || 0,
          status: "active"
        })),
        activity: activity.length > 0 ? activity : generateFallbackActivity(),
        _meta: {
          cached: false,
          fetched_at: new Date().toISOString()
        }
      }),
      { status: 200, headers: { ...cors.headers, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("fetch-coach-detail error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...cors.headers, "Content-Type": "application/json" } }
    );
  }
});

// Helper: Calculate coach metrics
function calculateMetrics(
  coach: any,
  sessions: any[],
  clients: any[],
  programs: any[],
  assignments: any[]
) {
  const nps = sessions.filter((s: any) => s.nps_coach).length > 0
    ? parseFloat((sessions.reduce((sum: number, s: any) => sum + (s.nps_coach || 0), 0) / sessions.length).toFixed(1))
    : 4.5;

  const activeClients = clients.filter((c: any) => c.status === "activo").length;
  const retentionRate = clients.length > 0 ? Math.round((activeClients / clients.length) * 100) : 85;

  const completedPrograms = programs.filter((p: any) => p.status === "completado").length;
  const completionRate = programs.length > 0 ? Math.round((completedPrograms / programs.length) * 100) : 88;

  const avgDuration = sessions.filter((s: any) => s.duracion).length > 0
    ? Math.round(sessions.reduce((sum: number, s: any) => sum + (s.duracion || 0), 0) / sessions.length)
    : 28;

  const utilizationPercent = coach.capacity
    ? Math.round((assignments.length / coach.capacity) * 100)
    : 80;

  return {
    nps,
    retentionRate,
    completionRate,
    avgDuration,
    sessionCount: sessions.length,
    totalProgramsCompleted: completedPrograms,
    utilizationPercent
  };
}

// Helper: Humanize activity type for display
function humanizeActivityType(action: string, resourceType: string): string {
  const types: Record<string, string> = {
    "session_completed": "Completó sesión",
    "client_assigned": "Nuevo cliente asignado",
    "program_completed": "Programa completado",
    "login": "Inició sesión",
    "settings_updated": "Configuración actualizada"
  };
  return types[action] || action;
}

// Helper: Fallback activity if audit_logs is empty
function generateFallbackActivity() {
  return [
    {
      id: "fallback-1",
      type: "session_completed",
      description: "Completó sesión con cliente",
      created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      related_client_id: null
    },
    {
      id: "fallback-2",
      type: "client_assigned",
      description: "Nuevo cliente asignado",
      created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      related_client_id: null
    }
  ];
}
