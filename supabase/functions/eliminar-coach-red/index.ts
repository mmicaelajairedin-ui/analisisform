// ===================================================================
// eliminar-coach-red — el DUEÑO de una red (rol='owner') suspende, reactiva o
// quita a uno de SUS coaches. Service role + gate al owner + verifica que el
// coach es de SU empresa. Modos:
//   suspender → activo=false (pierde acceso, sigue en la red)
//   reactivar → activo=true
//   quitar    → libera a sus clientes (coach_id=null) y lo saca de la red
//               (activo=false + org_id=null → libera un lugar del cupo).
//               No borra la cuenta (sin pérdida de datos).
//
// Body:   { coach_id, modo:'suspender'|'reactivar'|'quitar' }
// Header: Authorization: Bearer <JWT del owner>
// Resp:   { ok, modo, liberados? } | { error }
//
// Deploy: supabase functions deploy eliminar-coach-red --no-verify-jwt
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
    const r = await fetch(`${SB_URL}/rest/v1/usuarios?email=eq.${encodeURIComponent(email)}&rol=eq.owner&select=org_id&limit=1`, { headers: svc });
    if (!r.ok) return null;
    const rows = await r.json();
    return (Array.isArray(rows) && rows[0] && rows[0].org_id) || null;
  } catch { return null; }
}
async function coachInOrg(coachId: string, orgId: string): Promise<boolean> {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/usuarios?id=eq.${encodeURIComponent(coachId)}&org_id=eq.${encodeURIComponent(orgId)}&rol=eq.coach&select=id&limit=1`, { headers: svc });
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
  const email = await callerEmail(token);
  if (!email) return json({ error: "not_owner" }, 403);
  const orgId = await ownerOrg(email);
  if (!orgId) return json({ error: "not_owner" }, 403);

  let body: { coach_id?: string; modo?: string };
  try { body = await req.json(); } catch { return json({ error: "bad_json" }, 400); }
  const coach_id = (body.coach_id || "").toString().trim();
  const modo = (body.modo || "").toString().trim();
  if (!coach_id) return json({ error: "missing_id" }, 400);
  if (["suspender", "reactivar", "quitar"].indexOf(modo) < 0) return json({ error: "modo_invalido" }, 400);
  if (!(await coachInOrg(coach_id, orgId))) return json({ error: "coach_ajeno" }, 403);

  async function patchCoach(fields: Record<string, unknown>): Promise<boolean> {
    try {
      const r = await fetch(`${SB_URL}/rest/v1/usuarios?id=eq.${encodeURIComponent(coach_id)}&org_id=eq.${encodeURIComponent(orgId)}`,
        { method: "PATCH", headers: { ...svc, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify(fields) });
      return r.ok;
    } catch { return false; }
  }

  if (modo === "suspender") return (await patchCoach({ activo: false })) ? json({ ok: true, modo }) : json({ error: "update_failed" }, 502);
  if (modo === "reactivar") return (await patchCoach({ activo: true })) ? json({ ok: true, modo }) : json({ error: "update_failed" }, 502);

  // quitar: liberar clientes (coach_id → null) y sacar al coach de la red.
  let liberados = 0;
  try {
    const r = await fetch(`${SB_URL}/rest/v1/candidatos?coach_id=eq.${encodeURIComponent(coach_id)}&org_id=eq.${encodeURIComponent(orgId)}`,
      { method: "PATCH", headers: { ...svc, "Content-Type": "application/json", Prefer: "return=representation" }, body: JSON.stringify({ coach_id: null }) });
    if (r.ok) { const rows = await r.json(); liberados = Array.isArray(rows) ? rows.length : 0; }
  } catch { /* seguimos: igual sacamos al coach */ }
  const okc = await patchCoach({ activo: false, org_id: null });
  return okc ? json({ ok: true, modo: "quitar", liberados }) : json({ error: "update_failed" }, 502);
});
