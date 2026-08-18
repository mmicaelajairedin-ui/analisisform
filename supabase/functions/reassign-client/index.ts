// ===================================================================
// reassign-client — reasigna cliente a otro coach
// Usa service role para validar permisos y ejecutar update.
// Body: { org_id, client_id, new_coach_id }
// Resp: { ok, data: { id, coach_id } } | { error }
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

async function getEntityOrg(table: string, id: string): Promise<string | null> {
  if (!UUID_RE.test(id)) return null;
  try {
    const r = await fetch(
      `${SB_URL}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}&select=org_id`,
      { headers: svc }
    );
    if (!r.ok) return null;
    const rows = await r.json();
    return (Array.isArray(rows) && rows[0]) ? String(rows[0].org_id) : null;
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

  let body: { org_id?: string; client_id?: string; new_coach_id?: string };
  try { body = await req.json(); } catch { return json({ error: "bad_json" }, 400); }

  const org_id = (body.org_id || "").toString().trim();
  const client_id = (body.client_id || "").toString().trim();
  const new_coach_id = (body.new_coach_id || "").toString().trim();

  if (!org_id) return json({ error: "missing_org_id" }, 400);
  if (!client_id) return json({ error: "missing_client_id" }, 400);
  if (!new_coach_id) return json({ error: "missing_new_coach_id" }, 400);

  // Verify caller is owner/admin of this org
  if (!(await isOwnerOrAdminOfOrg(who.id, who.email, org_id))) {
    return json({ error: "not_authorized" }, 403);
  }

  // Verify client belongs to this org
  const clientOrg = await getEntityOrg("candidatos", client_id);
  if (clientOrg !== org_id) {
    return json({ error: "client_not_in_org" }, 403);
  }

  // Verify new_coach belongs to this org
  const coachOrg = await getEntityOrg("usuarios", new_coach_id);
  if (coachOrg !== org_id) {
    return json({ error: "coach_not_in_org" }, 403);
  }

  // Perform the reassignment
  try {
    // Step 1: Update coach_id
    const url = `${SB_URL}/rest/v1/candidatos?id=eq.${encodeURIComponent(client_id)}&select=id,coach_id`;
    const r = await fetch(url, {
      method: "PATCH",
      headers: { ...svc, "Content-Type": "application/json", "Prefer": "return=representation" },
      body: JSON.stringify({ coach_id: new_coach_id })
    });

    if (!r.ok) return json({ error: "update_failed", status: r.status }, 502);

    // Step 2: Close old assignment (best-effort)
    try {
      const oldCheck = await fetch(
        `${SB_URL}/rest/v1/coach_client_assignments?client_id=eq.${encodeURIComponent(client_id)}&estado=eq.activa&select=id`,
        { headers: svc }
      );
      if (oldCheck.ok) {
        const oldRows = await oldCheck.json();
        if (Array.isArray(oldRows) && oldRows.length > 0) {
          const oldId = oldRows[0].id;
          const closeResp = await fetch(
            `${SB_URL}/rest/v1/coach_client_assignments?id=eq.${encodeURIComponent(oldId)}`,
            { method: "PATCH", headers: { ...svc, "Content-Type": "application/json" }, body: JSON.stringify({ estado: "cerrada", updated_at: new Date().toISOString() }) }
          );
          if (!closeResp.ok) console.error(`[reassign-client] Failed to close old assignment ${oldId}: ${closeResp.status}`);
        }
      }
    } catch (e) {
      console.error("[reassign-client] Failed to close old assignment:", e);
    }

    // Step 3: Create new assignment
    try {
      const assignmentCheck = await fetch(
        `${SB_URL}/rest/v1/coach_client_assignments?org_id=eq.${encodeURIComponent(org_id)}&client_id=eq.${encodeURIComponent(client_id)}&coach_id=eq.${encodeURIComponent(new_coach_id)}&select=id`,
        { headers: svc }
      );
      if (assignmentCheck.ok) {
        const rows = await assignmentCheck.json();
        if (Array.isArray(rows) && rows.length > 0) {
          // Reactivate if paused
          const updateResp = await fetch(
            `${SB_URL}/rest/v1/coach_client_assignments?id=eq.${encodeURIComponent(rows[0].id)}`,
            { method: "PATCH", headers: { ...svc, "Content-Type": "application/json" }, body: JSON.stringify({ estado: "activa", updated_at: new Date().toISOString() }) }
          );
          if (!updateResp.ok) console.error(`[reassign-client] Failed to update assignment ${rows[0].id}: ${updateResp.status}`);
        } else {
          // Create new
          const createResp = await fetch(
            `${SB_URL}/rest/v1/coach_client_assignments`,
            { method: "POST", headers: { ...svc, "Content-Type": "application/json" }, body: JSON.stringify({ org_id, coach_id: new_coach_id, client_id, estado: "activa" }) }
          );
          if (!createResp.ok) console.error(`[reassign-client] Failed to create assignment: ${createResp.status}`);
        }
      } else {
        console.error(`[reassign-client] Failed to check existing assignment: ${assignmentCheck.status}`);
      }
    } catch (e) {
      console.error("[reassign-client] Failed to sync assignment:", e);
    }

    const result = await r.json();
    const updated = Array.isArray(result) ? result[0] : result;
    return json({ ok: true, data: updated || { id: client_id, coach_id: new_coach_id } });
  } catch { return json({ error: "db_unreachable" }, 502); }
});
