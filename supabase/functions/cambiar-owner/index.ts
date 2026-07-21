// ===================================================================
// cambiar-owner — TRANSFIERE una red a un nuevo dueño. Admin-gated (service
// role). El nuevo dueño es uno de los coaches de la red (se lo promueve a
// rol='owner'); el dueño anterior queda como rol='coach' (sigue en la red,
// puede atender). "El owner es coach aunque luego no quiera atender", así que
// bajarlo a coach no pierde nada: mantiene su org_id y sus clientes.
//
// Body:   { org_id, nuevo_owner_id }   (nuevo_owner_id = un coach de esa org)
// Header: Authorization: Bearer <JWT del admin>
// Resp:   { ok, org_id, nuevo_owner_id } | { error }
//
// Deploy: supabase functions deploy cambiar-owner --no-verify-jwt
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
async function isAdmin(email: string): Promise<boolean> {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/usuarios?email=eq.${encodeURIComponent(email)}&rol=eq.admin&select=id&limit=1`, { headers: svc });
    if (!r.ok) return false;
    const rows = await r.json();
    return Array.isArray(rows) && rows.length > 0;
  } catch { return false; }
}
async function q(path: string): Promise<any[]> {
  try { const r = await fetch(`${SB_URL}/rest/v1/${path}`, { headers: svc }); if (!r.ok) return []; const rows = await r.json(); return Array.isArray(rows) ? rows : []; } catch { return []; }
}
async function patch(path: string, fields: Record<string, unknown>): Promise<boolean> {
  try { const r = await fetch(`${SB_URL}/rest/v1/${path}`, { method: "PATCH", headers: { ...svc, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify(fields) }); return r.ok; } catch { return false; }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "post_only" }, 405);
  if (!SB_URL || !SERVICE || !ANON) return json({ error: "env_missing" }, 500);

  const auth = req.headers.get("Authorization") || req.headers.get("authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  const adminEmail = await callerEmail(token);
  if (!adminEmail || !(await isAdmin(adminEmail))) return json({ error: "not_admin" }, 403);

  let body: { org_id?: string; nuevo_owner_id?: string };
  try { body = await req.json(); } catch { return json({ error: "bad_json" }, 400); }
  const orgId = (body.org_id || "").toString().trim();
  const nuevoId = (body.nuevo_owner_id || "").toString().trim();
  if (!orgId || !nuevoId) return json({ error: "missing_ids" }, 400);

  // La org y el dueño actual.
  const orgs = await q(`organizaciones?id=eq.${encodeURIComponent(orgId)}&select=id&limit=1`);
  if (!orgs[0]) return json({ error: "org_no_existe" }, 404);

  // El nuevo dueño debe ser un coach de ESTA org.
  const nuevo = (await q(`usuarios?id=eq.${encodeURIComponent(nuevoId)}&org_id=eq.${encodeURIComponent(orgId)}&rol=eq.coach&select=id,email&limit=1`))[0];
  if (!nuevo) return json({ error: "nuevo_owner_ajeno" }, 403);

  // Dueño anterior → coach (sigue en la red).
  const actuales = await q(`usuarios?org_id=eq.${encodeURIComponent(orgId)}&rol=eq.owner&select=id`);
  for (const o of actuales) {
    if (String(o.id) === String(nuevoId)) continue;
    await patch(`usuarios?id=eq.${encodeURIComponent(o.id)}`, { rol: "coach" });
  }

  // Nuevo dueño → owner.
  const okPromote = await patch(`usuarios?id=eq.${encodeURIComponent(nuevoId)}`, { rol: "owner" });
  if (!okPromote) return json({ error: "promote_failed" }, 502);

  // La org apunta al nuevo email de dueño.
  await patch(`organizaciones?id=eq.${encodeURIComponent(orgId)}`, { owner_email: nuevo.email });

  return json({ ok: true, org_id: orgId, nuevo_owner_id: nuevoId });
});
