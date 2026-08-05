// ===================================================================
// mi-red — devuelve la RED del logueado (rol='owner'|'coach'|'collaborator'):
// su organización, sus coaches (owner ve todos, coach ve los suyos) y sus
// clientes. Service role + validacion de permisos. Es el read contraparte de
// asignar/agregar/eliminar: la RLS de candidatos NO deja que el owner lea a los
// clientes de sus coaches (la policy es coach_id=pw_coach_id()), así que la
// lectura tiene que pasar por acá para que el dueño vea su red completa.
// Filtra SIEMPRE por su org_id: nunca ve otra empresa.
//
// Phase 2: Aceptar coach + colaborador si tienen permisos. Lista filtrada:
// - Owner: ve todos los coaches, clientes, sesiones de su org
// - Coach: ve sus propios clientes, sesiones, coaches de su org
// - Collaborator: ve sus clientes asignados (via RLS) + coaches si tiene permiso
//
// Header: Authorization: Bearer <JWT del user (owner|coach|collab)>
// Resp:   { ok, org, owner, coaches:[...], clientes:[...], citas:[...] } | { error }
//
// Deploy: supabase functions deploy mi-red --no-verify-jwt
// ===================================================================

import { validatePermission, getEmailFromToken, getOrgIdByEmail } from "../_shared/permissions.ts";

const SB_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const ANON = Deno.env.get("SUPABASE_ANON_KEY") || "";
const svc = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` };

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

async function q(path: string): Promise<any[]> {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/${path}`, { headers: svc });
    if (!r.ok) return [];
    const rows = await r.json();
    return Array.isArray(rows) ? rows : [];
  } catch { return []; }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (!SB_URL || !SERVICE || !ANON) return json({ error: "env_missing" }, 500);

  const auth = req.headers.get("Authorization") || req.headers.get("authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  const email = await getEmailFromToken(token, SB_URL, ANON);
  if (!email) return json({ error: "invalid_token" }, 403);

  // Get user's org
  const orgId = await getOrgIdByEmail(email, SB_URL, SERVICE);
  if (!orgId) return json({ error: "no_org" }, 403);

  // Get full user record to extract user_id and role
  const users = await q(`usuarios?email=eq.${encodeURIComponent(email)}&org_id=eq.${encodeURIComponent(orgId)}&select=id,nombre,email,activo,foto_url,configuracion,org_id,rol&limit=1`);
  const user = users[0];
  if (!user || !user.id) return json({ error: "user_not_found" }, 403);

  // Phase 2: Validate permission
  const perm = await validatePermission(orgId, user.id, "LIST_ORG_DATA", SB_URL, SERVICE);
  if (!perm.allowed) {
    return json({ error: "permission_denied", reason: perm.reason }, 403);
  }

  // Determine what this user can see based on role
  const userRole = user.rol || "coach";
  const userId = user.id;

  const orgs = await q(`organizaciones?id=eq.${encodeURIComponent(orgId)}&select=*&limit=1`);
  const org = orgs[0] || null;

  // ────────────────────────────────────────────────────────────────────────────
  // Coaches + Clientes filtramos según el rol del usuario
  // ────────────────────────────────────────────────────────────────────────────

  let coaches: any[] = [];
  let clientes: any[] = [];
  let coachIds: string[] = [];

  if (userRole === "owner") {
    // Owner: ve TODOS los coaches y clientes de su org
    coaches = await q(
      `usuarios?org_id=eq.${encodeURIComponent(orgId)}&rol=eq.coach&order=created_at.asc&select=id,nombre,email,activo,foto_url,configuracion`,
    );
    clientes = await q(
      `candidatos?org_id=eq.${encodeURIComponent(orgId)}&select=id,nombre,email,activo,coach_id,semana_activa,foto_perfil,created_at,updated_at&order=created_at.desc`,
    );
    coachIds = [userId, ...coaches.map((c: any) => c.id)].filter(Boolean);
  } else if (userRole === "coach") {
    // Coach: ve sus propios clientes + lista de coaches para asignar
    // Los clientes se filtran por coach_id via RLS, pero traemos la lista completa para UI
    coaches = await q(
      `usuarios?org_id=eq.${encodeURIComponent(orgId)}&rol=eq.coach&order=created_at.asc&select=id,nombre,email,activo,foto_url,configuracion`,
    );
    // RLS de candidatos filtrará por coach_id=userId (solo sus clientes)
    clientes = await q(
      `candidatos?org_id=eq.${encodeURIComponent(orgId)}&select=id,nombre,email,activo,coach_id,semana_activa,foto_perfil,created_at,updated_at&order=created_at.desc`,
    );
    coachIds = [userId, ...coaches.map((c: any) => c.id)].filter(Boolean);
  }
  // Collaborators: RLS filtrará clientes asignados, no traemos nada extra aquí

  // ────────────────────────────────────────────────────────────────────────────
  // Citas de la red
  // ────────────────────────────────────────────────────────────────────────────
  let citas: any[] = [];
  if (coachIds.length) {
    const from = new Date(Date.now() - 120 * 86400000).toISOString();
    const inList = coachIds.map((id) => String(id)).join(",");
    // Personal citas: coach_id en el team
    const personal = await q(
      `citas?coach_id=in.(${inList})&inicio=gte.${from}&order=inicio.desc&select=id,nombre,email,tipo,inicio,estado,coach_id,telefono,origen,resultado,notas_llamada,grupal,modalidad,lugar`,
    );
    // Group events: org_id match y grupal=true
    const grupal = await q(
      `citas?org_id=eq.${encodeURIComponent(orgId)}&grupal=eq.true&inicio=gte.${from}&order=inicio.desc&select=id,nombre,email,tipo,inicio,estado,coach_id,telefono,origen,resultado,notas_llamada,grupal,modalidad,lugar`,
    );
    // Deduplication: avoid showing the same cita twice (personal + grupal filters can overlap)
    const seen = new Set<string>();
    citas = [...personal, ...grupal].filter((c) => {
      const key = `${c.id}-${c.inicio}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  // El usuario actual se devuelve como "owner" (o coach) para que el panel lo marque como "Vos"
  return json({ ok: true, org, owner: user, coaches, clientes, citas });
});
