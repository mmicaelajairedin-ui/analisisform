// ===================================================================
// update-team-member — actualiza estado, rol, permisos de miembro
// Usa service role para validar permisos y ejecutar update.
// Body: { org_id, member_id, updates: {...} }
// Resp: { ok, data: usuario } | { error }
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
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED_FIELDS = ["activo", "rol", "org_id", "configuracion"];

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

async function isOwnerOrAdminOfOrg(id: string, email: string, org_id: string): Promise<boolean> {
  if (!id && !email) return false;
  try {
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

async function getMember(member_id: string): Promise<{ id: string; org_id: string | null; rol: string } | null> {
  if (!UUID_RE.test(member_id)) return null;
  try {
    const r = await fetch(
      `${SB_URL}/rest/v1/usuarios?id=eq.${encodeURIComponent(member_id)}&select=id,org_id,rol`,
      { headers: svc }
    );
    if (!r.ok) return null;
    const rows = await r.json();
    return (Array.isArray(rows) && rows[0]) ? rows[0] : null;
  } catch { return null; }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "post_only" }, 405);
  if (!SB_URL || !SERVICE || !ANON) return json({ error: "env_missing" }, 500);

  const auth = req.headers.get("Authorization") || req.headers.get("authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  const who = await callerIdentity(token);
  if (!who) return json({ error: "no_session" }, 403);

  let body: { org_id?: string; member_id?: string; updates?: Record<string, unknown> };
  try { body = await req.json(); } catch { return json({ error: "bad_json" }, 400); }

  const org_id = (body.org_id || "").toString().trim();
  const member_id = (body.member_id || "").toString().trim();
  const updates = body.updates || {};

  if (!org_id) return json({ error: "missing_org_id" }, 400);
  if (!member_id) return json({ error: "missing_member_id" }, 400);
  if (Object.keys(updates).length === 0) return json({ error: "missing_updates" }, 400);

  // Verify caller is owner/admin of this org
  if (!(await isOwnerOrAdminOfOrg(who.id, who.email, org_id))) {
    return json({ error: "not_authorized" }, 403);
  }

  // Verify member exists and belongs to this org (unless removing from org)
  const member = await getMember(member_id);
  if (!member) return json({ error: "member_not_found" }, 404);

  // If not removing from org, verify member is in this org
  if (!("org_id" in updates) || updates.org_id !== null) {
    if (member.org_id !== org_id) {
      return json({ error: "member_not_in_org" }, 403);
    }
  }

  // Filter updates to only allowed fields
  const filteredUpdates: Record<string, unknown> = {};
  for (const field of ALLOWED_FIELDS) {
    if (field in updates) {
      filteredUpdates[field] = updates[field];
    }
  }

  if (Object.keys(filteredUpdates).length === 0) {
    return json({ error: "no_valid_fields_to_update" }, 400);
  }

  // Perform the update
  try {
    const url = `${SB_URL}/rest/v1/usuarios?id=eq.${encodeURIComponent(member_id)}&select=id,nombre,email,rol,org_id,activo,created_at`;
    const r = await fetch(url, {
      method: "PATCH",
      headers: { ...svc, "Content-Type": "application/json", "Prefer": "return=representation" },
      body: JSON.stringify(filteredUpdates)
    });

    if (!r.ok) return json({ error: "update_failed", status: r.status }, 502);

    const result = await r.json();
    const updated = Array.isArray(result) ? result[0] : result;
    return json({ ok: true, data: updated || { id: member_id } });
  } catch { return json({ error: "db_unreachable" }, 502); }
});
