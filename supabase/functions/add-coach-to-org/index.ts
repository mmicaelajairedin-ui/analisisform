// ===================================================================
// add-coach-to-org — asigna un coach independiente a una organización
// Admin-gated. El coach pasa de rol='coach' sin org_id a estar en la org.
// Body: { coach_id, org_id }
// Resp: { ok, coach_id, org_id } | { error }
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

  let body: { coach_id?: string; org_id?: string };
  try { body = await req.json(); } catch { return json({ error: "bad_json" }, 400); }
  const coach_id = (body.coach_id || "").toString().trim();
  const org_id = (body.org_id || "").toString().trim();
  if (!coach_id || !org_id) return json({ error: "missing_ids" }, 400);

  // Verificar que el coach existe y es independiente
  let coach: { id: string; rol: string; org_id: string | null; email: string; nombre: string } | null = null;
  try {
    const r = await fetch(`${SB_URL}/rest/v1/usuarios?id=eq.${encodeURIComponent(coach_id)}&select=id,rol,org_id,email,nombre&limit=1`, { headers: svc });
    if (!r.ok) return json({ error: "lookup_failed", status: r.status }, 502);
    const rows = await r.json();
    coach = (Array.isArray(rows) && rows[0]) || null;
  } catch { return json({ error: "db_unreachable" }, 502); }
  if (!coach) return json({ error: "coach_not_found" }, 404);
  if (coach.rol !== "coach") return json({ error: "not_a_coach", rol: coach.rol }, 409);
  if (coach.org_id) return json({ error: "already_in_org", org_id: coach.org_id }, 409);

  // Verificar que la org existe y obtener límites
  let org: { id: string; nombre: string; plan: string; max_coaches: number | null; owner_id: string } | null = null;
  try {
    const r = await fetch(`${SB_URL}/rest/v1/organizaciones?id=eq.${encodeURIComponent(org_id)}&select=id,nombre,plan,max_coaches,owner_id&limit=1`, { headers: svc });
    if (!r.ok) return json({ error: "org_lookup_failed", status: r.status }, 502);
    const rows = await r.json();
    org = (Array.isArray(rows) && rows[0]) || null;
  } catch { return json({ error: "db_unreachable" }, 502); }
  if (!org) return json({ error: "org_not_found" }, 404);

  // Verificar límite de coaches en el plan
  let coachCount = 0;
  try {
    const r = await fetch(`${SB_URL}/rest/v1/usuarios?org_id=eq.${encodeURIComponent(org_id)}&rol=eq.coach&select=count`, { headers: { ...svc, Prefer: "count=exact" } });
    if (r.ok) coachCount = parseInt(r.headers.get("content-range")?.split("/")[1] || "0", 10);
  } catch { /* best-effort */ }
  if (org.max_coaches && coachCount >= org.max_coaches) {
    return json({ error: "max_coaches_reached", current: coachCount, max: org.max_coaches }, 409);
  }

  // Asignar coach a org
  try {
    const r = await fetch(`${SB_URL}/rest/v1/usuarios?id=eq.${encodeURIComponent(coach_id)}`, {
      method: "PATCH", headers: { ...svc, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ org_id }),
    });
    if (!r.ok) return json({ error: "assign_failed", status: r.status }, 502);
  } catch { return json({ error: "assign_failed" }, 502); }

  // Log auditoría
  try {
    await fetch(`${SB_URL}/rest/v1/audit_logs`, {
      method: "POST", headers: { ...svc, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ org_id, action: "coach_added", details: { coach_email: coach.email, coach_name: coach.nombre, by: who.email } }),
    });
  } catch { /* best-effort */ }

  return json({ ok: true, coach_id, org_id, coach_email: coach.email, coaches_now: coachCount + 1 });
});
