// ===================================================================
// remove-member-org — remueve un miembro (coach/colaborador) de una org
// Admin-gated. Setea org_id=null para que quede independiente.
// Body: { org_id, member_id }
// Resp: { ok, org_id, member_id } | { error }
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

  let body: { org_id?: string; member_id?: string };
  try { body = await req.json(); } catch { return json({ error: "bad_json" }, 400); }
  const org_id = (body.org_id || "").toString().trim();
  const member_id = (body.member_id || "").toString().trim();
  if (!org_id || !member_id) return json({ error: "missing_ids" }, 400);

  // Verificar que la org existe
  let org: { id: string; owner_id: string } | null = null;
  try {
    const r = await fetch(`${SB_URL}/rest/v1/organizaciones?id=eq.${encodeURIComponent(org_id)}&select=id,owner_id&limit=1`, { headers: svc });
    if (!r.ok) return json({ error: "org_lookup_failed", status: r.status }, 502);
    const rows = await r.json();
    org = (Array.isArray(rows) && rows[0]) || null;
  } catch { return json({ error: "db_unreachable" }, 502); }
  if (!org) return json({ error: "org_not_found" }, 404);

  // Verificar que el miembro existe y está en la org
  let member: { id: string; org_id: string | null; rol: string; email: string; nombre: string } | null = null;
  try {
    const r = await fetch(`${SB_URL}/rest/v1/usuarios?id=eq.${encodeURIComponent(member_id)}&select=id,org_id,rol,email,nombre&limit=1`, { headers: svc });
    if (!r.ok) return json({ error: "lookup_failed", status: r.status }, 502);
    const rows = await r.json();
    member = (Array.isArray(rows) && rows[0]) || null;
  } catch { return json({ error: "db_unreachable" }, 502); }
  if (!member) return json({ error: "member_not_found" }, 404);
  if (String(member.org_id) !== String(org_id)) return json({ error: "member_not_in_org" }, 409);

  // No permitir remover al owner
  if (String(member_id) === String(org.owner_id)) {
    return json({ error: "cannot_remove_owner" }, 409);
  }

  // Contar candidatos del miembro para auditoría
  let candidateCount = 0;
  try {
    const r = await fetch(`${SB_URL}/rest/v1/candidatos?coach_id=eq.${encodeURIComponent(member_id)}&select=count`, { headers: { ...svc, Prefer: "count=exact" } });
    if (r.ok) candidateCount = parseInt(r.headers.get("content-range")?.split("/")[1] || "0", 10);
  } catch { /* best-effort */ }

  // Remover miembro (setear org_id=null) — si tiene clientes, solo setea org_id a null
  try {
    const r = await fetch(`${SB_URL}/rest/v1/usuarios?id=eq.${encodeURIComponent(member_id)}`, {
      method: "PATCH", headers: { ...svc, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ org_id: null }),
    });
    if (!r.ok) return json({ error: "remove_failed", status: r.status }, 502);
  } catch { return json({ error: "remove_failed" }, 502); }

  // Log auditoría
  try {
    await fetch(`${SB_URL}/rest/v1/audit_logs`, {
      method: "POST", headers: { ...svc, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ org_id, action: "member_removed", details: { member_email: member.email, member_name: member.nombre, member_role: member.rol, candidate_count: candidateCount, by: who.email } }),
    });
  } catch { /* best-effort */ }

  return json({ ok: true, org_id, member_id, member_email: member.email, candidates_preserved: candidateCount });
});
