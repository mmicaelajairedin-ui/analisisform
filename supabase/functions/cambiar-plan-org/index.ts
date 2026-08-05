// ===================================================================
// cambiar-plan-org — cambia el plan (boutique/studio/pro) de una org
// Admin-gated. Body: { org_id, plan:'boutique'|'studio'|'pro' }
// Resp: { ok, org_id, plan } | { error }
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

async function callerIdentity(token: string): Promise<{ id: string; email: string } | null> {
  if (!token || token === ANON) return null;
  try {
    const r = await fetch(`${SB_URL}/auth/v1/user`, { headers: { apikey: ANON, Authorization: `Bearer ${token}` } });
    if (!r.ok) return null;
    const u = await r.json();
    const id = (u && u.id) ? String(u.id) : "";
    const em = (u && u.email ? String(u.email) : "").trim().toLowerCase();
    if (!id && !EMAIL_RE.test(em)) return null;
    return { id, email: EMAIL_RE.test(em) ? em : "" };
  } catch { return null; }
}

async function isAdmin(id: string, email: string): Promise<boolean> {
  const ors: string[] = [];
  if (id) ors.push(`auth_id.eq.${encodeURIComponent(id)}`);
  if (email) ors.push(`email.ilike.${encodeURIComponent(email)}`);
  if (!ors.length) return false;
  try {
    const r = await fetch(`${SB_URL}/rest/v1/usuarios?or=(${ors.join(",")})&rol=eq.admin&select=id&limit=1`, { headers: svc });
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
  const who = await callerIdentity(token);
  if (!who) return json({ error: "no_session" }, 403);
  if (!(await isAdmin(who.id, who.email))) return json({ error: "not_admin" }, 403);

  let body: { org_id?: string; plan?: string };
  try { body = await req.json(); } catch { return json({ error: "bad_json" }, 400); }
  const org_id = (body.org_id || "").toString().trim();
  if (!org_id) return json({ error: "missing_org_id" }, 400);
  const plan = (body.plan === "pro" || body.plan === "studio") ? body.plan : "boutique";

  // Buscar org
  let org: { id: string; plan: string; nombre: string } | null = null;
  try {
    const r = await fetch(`${SB_URL}/rest/v1/organizaciones?id=eq.${encodeURIComponent(org_id)}&select=id,plan,nombre&limit=1`, { headers: svc });
    if (!r.ok) return json({ error: "lookup_failed", status: r.status }, 502);
    const rows = await r.json();
    org = (Array.isArray(rows) && rows[0]) || null;
  } catch { return json({ error: "db_unreachable" }, 502); }
  if (!org) return json({ error: "org_not_found" }, 404);

  // Actualizar plan
  try {
    const r = await fetch(`${SB_URL}/rest/v1/organizaciones?id=eq.${encodeURIComponent(org_id)}`, {
      method: "PATCH", headers: { ...svc, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ plan }),
    });
    if (!r.ok) return json({ error: "update_failed", status: r.status }, 502);
  } catch { return json({ error: "update_failed" }, 502); }

  return json({ ok: true, org_id, plan });
});
