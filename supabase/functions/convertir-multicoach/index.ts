// ===================================================================
// convertir-multicoach — promueve un COACH existente a MULTICOACH (dueño de su
// propia red). Admin-gated (service role). Crea la organización, cambia al
// coach a rol='owner' con ese org_id, y le PASA SUS CLIENTES a la nueva red
// (org_id = la nueva org, manteniendo coach_id = él → así arrancan asignados a
// él mismo, y después puede repartirlos a los coaches que sume).
//
// Body:   { coach_id, plan:'boutique'|'studio'|'pro', nombre_red, dias }
// Header: Authorization: Bearer <JWT del admin>
// Resp:   { ok, org_id, plan, movidos } | { error }
//
// Deploy: supabase functions deploy convertir-multicoach --no-verify-jwt
// ===================================================================

const SB_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const ANON = Deno.env.get("SUPABASE_ANON_KEY") || "";
const svc = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` };

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function planLimits(plan: string): { max_coaches: number | null; max_clientes: number | null } {
  if (plan === "pro") return { max_coaches: null, max_clientes: null };
  if (plan === "studio") return { max_coaches: 8, max_clientes: 120 };
  return { max_coaches: 3, max_clientes: 45 };
}
async function callerEmail(token: string): Promise<string | null> {
  if (!token || token === ANON) return null;
  try {
    const r = await fetch(`${SB_URL}/auth/v1/user`, { headers: { apikey: ANON, Authorization: `Bearer ${token}` } });
    if (!r.ok) return null;
    const u = await r.json();
    const em = (u && u.email ? String(u.email) : "").trim().toLowerCase();
    return EMAIL_RE.test(em) ? em : null;
  } catch { return null; }
}
async function isAdmin(email: string): Promise<boolean> {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/usuarios?email=ilike.${encodeURIComponent(email)}&rol=eq.admin&select=id&limit=1`, { headers: svc });
    if (!r.ok) return false;
    const rows = await r.json();
    return Array.isArray(rows) && rows.length > 0;
  } catch { return false; }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "post_only" }, 405);
  if (!SB_URL || !SERVICE || !ANON) return json({ error: "env_missing" }, 500);

  const auth = req.headers.get("Authorization") || req.headers.get("authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  const adminEmail = await callerEmail(token);
  if (!adminEmail || !(await isAdmin(adminEmail))) return json({ error: "not_admin" }, 403);

  let body: { coach_id?: string; plan?: string; nombre_red?: string; dias?: number | string };
  try { body = await req.json(); } catch { return json({ error: "bad_json" }, 400); }
  const coach_id = (body.coach_id || "").toString().trim();
  if (!coach_id) return json({ error: "missing_id" }, 400);
  const plan = (body.plan === "pro" || body.plan === "studio") ? body.plan : "boutique";
  const lim = planLimits(plan);
  const diasN = parseInt(String(body.dias ?? "14"), 10);
  const dias = Math.max(1, Math.min(365, isNaN(diasN) ? 14 : diasN));
  const trialEnd = new Date(Date.now() + dias * 86400000).toISOString();
  const trialDate = trialEnd.slice(0, 10);

  // El coach a convertir.
  let coach: { id: string; email: string; nombre: string | null; rol: string; org_id: string | null; configuracion: Record<string, unknown> | null } | null = null;
  try {
    const r = await fetch(`${SB_URL}/rest/v1/usuarios?id=eq.${encodeURIComponent(coach_id)}&select=id,email,nombre,rol,org_id,configuracion&limit=1`, { headers: svc });
    if (!r.ok) return json({ error: "lookup_failed", status: r.status }, 502);
    const rows = await r.json();
    coach = (Array.isArray(rows) && rows[0]) || null;
  } catch { return json({ error: "db_unreachable" }, 502); }
  if (!coach) return json({ error: "coach_no_existe" }, 404);
  if (coach.rol === "owner") return json({ error: "ya_es_owner" }, 409);
  if (coach.rol !== "coach") return json({ error: "no_es_coach", rol: coach.rol }, 409);

  const cfg = (coach.configuracion && typeof coach.configuracion === "object") ? coach.configuracion as Record<string, unknown> : {};
  const nicho = (cfg.coach_type as string) || "carrera";
  const nombreRed = (body.nombre_red || "").toString().trim() || (coach.nombre ? `Red de ${coach.nombre}` : "Mi red");

  // 1) Crear la organización.
  let orgId = "";
  try {
    const r = await fetch(`${SB_URL}/rest/v1/organizaciones`, {
      method: "POST", headers: { ...svc, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify({ nombre: nombreRed, owner_email: coach.email, plan, nicho, max_coaches: lim.max_coaches, max_clientes: lim.max_clientes, estado_sub: "prueba", fecha_fin_prueba: trialDate, activo: true }),
    });
    if (!r.ok) return json({ error: "org_write_failed", status: r.status }, 502);
    const created = await r.json();
    const row = Array.isArray(created) ? created[0] : created;
    orgId = (row && row.id) || "";
  } catch { return json({ error: "org_write_failed" }, 502); }
  if (!orgId) return json({ error: "org_write_failed" }, 502);

  // 2) Promover el coach a owner (con su nueva org).
  const nc = { ...cfg, plan, estado_sub: "prueba", fecha_fin_prueba: trialEnd, coach_type: nicho, es_multicoach: true, convertido_por: adminEmail };
  try {
    const r = await fetch(`${SB_URL}/rest/v1/usuarios?id=eq.${encodeURIComponent(coach_id)}`, {
      method: "PATCH", headers: { ...svc, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ rol: "owner", org_id: orgId, configuracion: nc }),
    });
    if (!r.ok) return json({ error: "promote_failed", status: r.status }, 502);
  } catch { return json({ error: "promote_failed" }, 502); }

  // 3) Pasar SUS clientes a la nueva red (mantienen coach_id = él).
  let movidos = 0;
  try {
    const r = await fetch(`${SB_URL}/rest/v1/candidatos?coach_id=eq.${encodeURIComponent(coach_id)}`, {
      method: "PATCH", headers: { ...svc, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify({ org_id: orgId }),
    });
    if (r.ok) { const rows = await r.json(); movidos = Array.isArray(rows) ? rows.length : 0; }
  } catch { /* la red ya quedó creada; los clientes se pueden reasignar luego */ }

  return json({ ok: true, org_id: orgId, plan, movidos });
});
