// ===================================================================
// change-owner-org — cambia el dueño (owner) de una organización
// Admin-gated. El owner actual queda como coach, el nuevo owner toma control.
// Body: { org_id, new_owner_id }
// Resp: { ok, org_id, new_owner_id } | { error }
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

  let body: { org_id?: string; new_owner_id?: string };
  try { body = await req.json(); } catch { return json({ error: "bad_json" }, 400); }
  const org_id = (body.org_id || "").toString().trim();
  const new_owner_id = (body.new_owner_id || "").toString().trim();
  if (!org_id || !new_owner_id) return json({ error: "missing_ids" }, 400);

  // Obtener org actual
  let org: { id: string; owner_id: string } | null = null;
  try {
    const r = await fetch(`${SB_URL}/rest/v1/organizaciones?id=eq.${encodeURIComponent(org_id)}&select=id,owner_id&limit=1`, { headers: svc });
    if (!r.ok) return json({ error: "org_lookup_failed", status: r.status }, 502);
    const rows = await r.json();
    org = (Array.isArray(rows) && rows[0]) || null;
  } catch { return json({ error: "db_unreachable" }, 502); }
  if (!org) return json({ error: "org_not_found" }, 404);

  // Verificar que el nuevo owner existe, es coach/colaborador y está en la org
  let newOwner: { id: string; rol: string; org_id: string | null } | null = null;
  try {
    const r = await fetch(`${SB_URL}/rest/v1/usuarios?id=eq.${encodeURIComponent(new_owner_id)}&select=id,rol,org_id&limit=1`, { headers: svc });
    if (!r.ok) return json({ error: "lookup_failed", status: r.status }, 502);
    const rows = await r.json();
    newOwner = (Array.isArray(rows) && rows[0]) || null;
  } catch { return json({ error: "db_unreachable" }, 502); }
  if (!newOwner) return json({ error: "new_owner_not_found" }, 404);
  if (!["coach", "colaborador", "assistant"].includes(newOwner.rol)) {
    return json({ error: "invalid_new_owner_role", rol: newOwner.rol }, 409);
  }
  if (String(newOwner.org_id) !== String(org_id)) {
    return json({ error: "new_owner_not_in_org" }, 409);
  }

  // Cambiar owner de org
  try {
    const r = await fetch(`${SB_URL}/rest/v1/organizaciones?id=eq.${encodeURIComponent(org_id)}`, {
      method: "PATCH", headers: { ...svc, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ owner_id: new_owner_id }),
    });
    if (!r.ok) return json({ error: "org_update_failed", status: r.status }, 502);
  } catch { return json({ error: "org_update_failed" }, 502); }

  // Cambiar rol del nuevo owner a owner (si es coach)
  if (newOwner.rol === "coach") {
    try {
      const r = await fetch(`${SB_URL}/rest/v1/usuarios?id=eq.${encodeURIComponent(new_owner_id)}`, {
        method: "PATCH", headers: { ...svc, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ rol: "owner" }),
      });
      if (!r.ok) return json({ error: "user_update_failed", status: r.status }, 502);
    } catch { return json({ error: "user_update_failed" }, 502); }
  }

  // Cambiar rol del owner anterior a coach (si no es admin)
  if (org.owner_id && org.owner_id !== new_owner_id) {
    try {
      const oldOwner = await fetch(`${SB_URL}/rest/v1/usuarios?id=eq.${encodeURIComponent(org.owner_id)}&select=rol&limit=1`, { headers: svc }).then(r => r.json()).then(rows => Array.isArray(rows) ? rows[0] : null);
      if (oldOwner && oldOwner.rol === "owner") {
        const r = await fetch(`${SB_URL}/rest/v1/usuarios?id=eq.${encodeURIComponent(org.owner_id)}`, {
          method: "PATCH", headers: { ...svc, "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify({ rol: "coach" }),
        });
        // best-effort; no fallar si no se puede cambiar rol del anterior
      }
    } catch { /* best-effort */ }
  }

  return json({ ok: true, org_id, new_owner_id });
});
