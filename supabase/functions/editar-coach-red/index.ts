// ===================================================================
// editar-coach-red — el DUEÑO de una red cambia el TIPO de un miembro de su
// red: 'coach' (da clases) ↔ 'colaborador' (no da clases, gestiona clientes y
// ve la agenda). Service role tras verificar owner + que el miembro es de su org.
//
// La distinción vive en usuarios.configuracion.member_role (los dos son
// rol='coach' a nivel usuarios). PostgREST no hace merge de un JSONB, así que
// leemos la configuracion actual, mergeamos y reescribimos.
//
// Body:   { coach_id, member_role: 'coach' | 'colaborador' }
// Header: Authorization: Bearer <JWT del owner logueado>
// Resp:   { ok, member_role } | { error }
//
// Deploy: supabase functions deploy editar-coach-red --no-verify-jwt
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
async function ownerOrg(email: string): Promise<string | null> {
  try {
    const r = await fetch(
      `${SB_URL}/rest/v1/usuarios?email=eq.${encodeURIComponent(email)}&rol=eq.owner&select=org_id&limit=1`,
      { headers: svc },
    );
    if (!r.ok) return null;
    const rows = await r.json();
    return (Array.isArray(rows) && rows[0] ? rows[0].org_id : null) || null;
  } catch { return null; }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "post_only" }, 405);
  if (!SB_URL || !SERVICE || !ANON) return json({ error: "env_missing" }, 500);

  const auth = req.headers.get("Authorization") || req.headers.get("authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  const email = await callerEmail(token);
  if (!email) return json({ error: "not_owner" }, 403);
  const orgId = await ownerOrg(email);
  if (!orgId) return json({ error: "not_owner" }, 403);

  let body: { coach_id?: string; member_role?: string };
  try { body = await req.json(); } catch { return json({ error: "bad_json" }, 400); }
  const coachId = (body.coach_id || "").toString().trim();
  const memberRole = (body.member_role || "").toString().toLowerCase() === "colaborador" ? "colaborador" : "coach";
  if (!coachId) return json({ error: "missing_coach" }, 400);

  // El miembro tiene que ser de ESTA org (y rol coach). Leemos su configuracion.
  let cfg: Record<string, unknown> = {};
  try {
    const r = await fetch(
      `${SB_URL}/rest/v1/usuarios?id=eq.${encodeURIComponent(coachId)}&org_id=eq.${encodeURIComponent(orgId)}&rol=eq.coach&select=configuracion&limit=1`,
      { headers: svc },
    );
    if (!r.ok) return json({ error: "lookup_failed", status: r.status }, 502);
    const rows = await r.json();
    if (!Array.isArray(rows) || !rows.length) return json({ error: "coach_ajeno" }, 403);
    cfg = (rows[0] && rows[0].configuracion && typeof rows[0].configuracion === "object") ? rows[0].configuracion : {};
  } catch { return json({ error: "db_unreachable" }, 502); }

  cfg.member_role = memberRole;
  cfg.no_da_clases = memberRole === "colaborador";

  try {
    const r = await fetch(
      `${SB_URL}/rest/v1/usuarios?id=eq.${encodeURIComponent(coachId)}&org_id=eq.${encodeURIComponent(orgId)}`,
      { method: "PATCH", headers: { ...svc, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify({ configuracion: cfg }) },
    );
    if (!r.ok) return json({ error: "update_failed", status: r.status }, 502);
  } catch { return json({ error: "write_failed" }, 502); }
  return json({ ok: true, member_role: memberRole });
});
