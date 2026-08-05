// ===================================================================
// add-collab-to-org — crea un nuevo colaborador en una organización
// Admin-gated. Crea usuario con rol='colaborador' u otro, org_id asignado.
// Body: { org_id, nombre, email, rol:'coach'|'colaborador'|'assistant' }
// Resp: { ok, user_id, org_id, email } | { error }
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

  let body: { org_id?: string; nombre?: string; email?: string; rol?: string };
  try { body = await req.json(); } catch { return json({ error: "bad_json" }, 400); }
  const org_id = (body.org_id || "").toString().trim();
  const nombre = (body.nombre || "").toString().trim();
  const email = (body.email || "").toString().trim().toLowerCase();
  const rol = (body.rol === "coach" || body.rol === "assistant") ? body.rol : "colaborador";

  if (!org_id || !nombre || !email || !EMAIL_RE.test(email)) {
    return json({ error: "missing_fields" }, 400);
  }

  // Verificar que la org existe
  let org: { id: string; nombre: string; plan: string; max_coaches: number | null } | null = null;
  try {
    const r = await fetch(`${SB_URL}/rest/v1/organizaciones?id=eq.${encodeURIComponent(org_id)}&select=id,nombre,plan,max_coaches&limit=1`, { headers: svc });
    if (!r.ok) return json({ error: "org_lookup_failed", status: r.status }, 502);
    const rows = await r.json();
    org = (Array.isArray(rows) && rows[0]) || null;
  } catch { return json({ error: "db_unreachable" }, 502); }
  if (!org) return json({ error: "org_not_found" }, 404);

  // Verificar que el email no existe
  try {
    const r = await fetch(`${SB_URL}/rest/v1/usuarios?email=ilike.${encodeURIComponent(email)}&select=id&limit=1`, { headers: svc });
    if (!r.ok) return json({ error: "lookup_failed", status: r.status }, 502);
    const rows = await r.json();
    if (Array.isArray(rows) && rows.length > 0) {
      return json({ error: "email_exists" }, 409);
    }
  } catch { return json({ error: "db_unreachable" }, 502); }

  // Verificar límite de colaboradores si rol=coach
  if (rol === "coach") {
    let coachCount = 0;
    try {
      const r = await fetch(`${SB_URL}/rest/v1/usuarios?org_id=eq.${encodeURIComponent(org_id)}&rol=eq.coach&select=count`, { headers: { ...svc, Prefer: "count=exact" } });
      if (r.ok) coachCount = parseInt(r.headers.get("content-range")?.split("/")[1] || "0", 10);
    } catch { /* best-effort */ }
    if (org.max_coaches && coachCount >= org.max_coaches) {
      return json({ error: "max_coaches_reached", current: coachCount, max: org.max_coaches }, 409);
    }
  }

  // Crear nuevo usuario
  let userId = "";
  try {
    const r = await fetch(`${SB_URL}/rest/v1/usuarios`, {
      method: "POST", headers: { ...svc, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify({ email, nombre, rol, org_id, activo: true }),
    });
    if (!r.ok) return json({ error: "create_failed", status: r.status }, 502);
    const created = await r.json();
    const row = Array.isArray(created) ? created[0] : created;
    userId = (row && row.id) || "";
  } catch { return json({ error: "create_failed" }, 502); }
  if (!userId) return json({ error: "create_failed" }, 502);

  // Log auditoría
  try {
    await fetch(`${SB_URL}/rest/v1/audit_logs`, {
      method: "POST", headers: { ...svc, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ org_id, action: "collab_created", details: { collab_email: email, collab_name: nombre, rol, by: who.email } }),
    });
  } catch { /* best-effort */ }

  return json({ ok: true, user_id: userId, org_id, email, nombre, rol });
});
