// ===================================================================
// load-team-members — carga miembros del equipo de una organización
// Usa service role para evitar restricciones RLS en cliente.
// Body: { org_id }
// Resp: { ok, data: usuarios[] } | { error }
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

async function isOwnerOrAdmin(id: string, email: string, org_id: string): Promise<boolean> {
  if (!id && !email) return false;
  try {
    // Check if caller is owner of this org OR admin
    const ors: string[] = [];
    if (id) ors.push(`auth_id.eq.${encodeURIComponent(id)}`);
    if (email) ors.push(`email.ilike.${encodeURIComponent(email)}`);

    const query = `${SB_URL}/rest/v1/usuarios?or=(${ors.join(",")})&select=id,rol,org_id&limit=2`;
    const r = await fetch(query, { headers: svc });
    if (!r.ok) return false;

    const rows = await r.json();
    if (!Array.isArray(rows) || rows.length === 0) return false;

    for (const row of rows) {
      if (row.rol === "admin") return true;
      if (row.rol === "owner" && row.org_id === org_id) return true;
    }
    return false;
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

  let body: { org_id?: string };
  try { body = await req.json(); } catch { return json({ error: "bad_json" }, 400); }
  const org_id = (body.org_id || "").toString().trim();
  if (!org_id) return json({ error: "missing_org_id" }, 400);

  // Verify caller is owner of this org or admin
  if (!(await isOwnerOrAdmin(who.id, who.email, org_id))) {
    return json({ error: "not_authorized" }, 403);
  }

  // Load all team members (coaches, owners, colaborators) for this org
  try {
    // PostgREST: combine org_id filter with role filter using proper syntax
    // Query: all usuarios where org_id=X AND (rol IN [coach, owner, colaborador])
    const query = `${SB_URL}/rest/v1/usuarios?org_id=eq.${encodeURIComponent(org_id)}&rol=in.(coach,owner,colaborador)&select=id,nombre,email,activo,rol,created_at,configuracion&order=nombre`;
    const r = await fetch(query, { headers: svc });
    if (!r.ok) return json({ error: "query_failed", status: r.status }, 502);

    const data = await r.json();
    return json({ ok: true, data: Array.isArray(data) ? data : [] });
  } catch { return json({ error: "db_unreachable" }, 502); }
});
