// ===================================================================
// asignar-cliente — el DUEÑO de una red (rol='owner') asigna/reasigna un
// cliente de su empresa a uno de SUS coaches. Corre con SERVICE ROLE (bypassa
// RLS) SOLO tras verificar que quien llama es el owner de esa organización y
// que TANTO el cliente COMO el coach pertenecen a su empresa (mismo org_id).
//
// Es la misma lección que crear-coach/crear-multicoach: una escritura
// privilegiada NO puede ir por un PATCH directo del navegador (RLS lo bloquea
// → "no anda"). Va por acá, verificada.
//
// Body:   { cliente_id, coach_id }
// Header: Authorization: Bearer <JWT del owner logueado>
// Resp:   { ok, cliente_id, coach_id } | { error }
//
// Deploy: supabase functions deploy asignar-cliente --no-verify-jwt
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

// El owner y su org (rol='owner' con org_id). Devuelve org_id o null.
async function ownerOrg(email: string): Promise<string | null> {
  try {
    const r = await fetch(
      `${SB_URL}/rest/v1/usuarios?email=eq.${encodeURIComponent(email)}&rol=eq.owner&select=org_id&limit=1`,
      { headers: svc },
    );
    if (!r.ok) return null;
    const rows = await r.json();
    const org = Array.isArray(rows) && rows[0] ? rows[0].org_id : null;
    return org || null;
  } catch { return null; }
}

// ¿La fila (candidatos|usuarios) con ese id pertenece a esta org?
async function belongsToOrg(table: string, id: string, orgId: string, extra = ""): Promise<boolean> {
  try {
    const r = await fetch(
      `${SB_URL}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}&org_id=eq.${encodeURIComponent(orgId)}${extra}&select=id&limit=1`,
      { headers: svc },
    );
    if (!r.ok) return false;
    const rows = await r.json();
    return Array.isArray(rows) && rows.length > 0;
  } catch { return false; }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "post_only" }, 405);
  if (!SB_URL || !SERVICE || !ANON) return json({ error: "env_missing" }, 500);

  // ── Gate: quien llama debe ser el owner de una org ───────────────
  const auth = req.headers.get("Authorization") || req.headers.get("authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  const email = await callerEmail(token);
  if (!email) return json({ error: "not_owner" }, 403);
  const orgId = await ownerOrg(email);
  if (!orgId) return json({ error: "not_owner" }, 403);

  // ── Input ────────────────────────────────────────────────────────
  let body: { cliente_id?: string; coach_id?: string };
  try { body = await req.json(); } catch { return json({ error: "bad_json" }, 400); }
  const cliente_id = (body.cliente_id || "").toString().trim();
  const coach_id = (body.coach_id || "").toString().trim();
  if (!cliente_id || !coach_id) return json({ error: "missing_ids" }, 400);

  // ── El cliente Y el coach deben ser de ESTA empresa ──────────────
  // El coach destino puede ser un coach O el propio dueño (el owner también
  // atiende clientes: "el owner es coach aunque luego no quiera atender").
  if (!(await belongsToOrg("candidatos", cliente_id, orgId))) return json({ error: "cliente_ajeno" }, 403);
  if (!(await belongsToOrg("usuarios", coach_id, orgId, "&rol=in.(coach,owner)"))) return json({ error: "coach_ajeno" }, 403);

  // ── Asignar ──────────────────────────────────────────────────────
  try {
    // Step 1: Update coach_id
    const r = await fetch(
      `${SB_URL}/rest/v1/candidatos?id=eq.${encodeURIComponent(cliente_id)}&org_id=eq.${encodeURIComponent(orgId)}`,
      { method: "PATCH", headers: { ...svc, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify({ coach_id }) },
    );
    if (!r.ok) return json({ error: "update_failed", status: r.status }, 502);

    // Step 2: Close old assignment if exists (best-effort, don't fail if error)
    try {
      const oldCheck = await fetch(
        `${SB_URL}/rest/v1/coach_client_assignments?client_id=eq.${encodeURIComponent(cliente_id)}&estado=eq.activa&select=id`,
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
          if (!closeResp.ok) console.error(`[asignar-cliente] Failed to close old assignment ${oldId}: ${closeResp.status}`);
        }
      }
    } catch (e) {
      console.error("[asignar-cliente] Failed to close old assignment:", e);
    }

    // Step 3: Create or update new assignment
    try {
      const assignmentCheck = await fetch(
        `${SB_URL}/rest/v1/coach_client_assignments?org_id=eq.${encodeURIComponent(orgId)}&client_id=eq.${encodeURIComponent(cliente_id)}&coach_id=eq.${encodeURIComponent(coach_id)}&select=id`,
        { headers: svc }
      );
      if (assignmentCheck.ok) {
        const rows = await assignmentCheck.json();
        if (Array.isArray(rows) && rows.length > 0) {
          // Update existing
          const updateResp = await fetch(
            `${SB_URL}/rest/v1/coach_client_assignments?id=eq.${encodeURIComponent(rows[0].id)}`,
            { method: "PATCH", headers: { ...svc, "Content-Type": "application/json" }, body: JSON.stringify({ estado: "activa", updated_at: new Date().toISOString() }) }
          );
          if (!updateResp.ok) console.error(`[asignar-cliente] Failed to update assignment ${rows[0].id}: ${updateResp.status}`);
        } else {
          // Create new
          const createResp = await fetch(
            `${SB_URL}/rest/v1/coach_client_assignments`,
            { method: "POST", headers: { ...svc, "Content-Type": "application/json" }, body: JSON.stringify({ org_id: orgId, coach_id, client_id: cliente_id, estado: "activa" }) }
          );
          if (!createResp.ok) console.error(`[asignar-cliente] Failed to create assignment: ${createResp.status}`);
        }
      } else {
        console.error(`[asignar-cliente] Failed to check existing assignment: ${assignmentCheck.status}`);
      }
    } catch (e) {
      console.error("[asignar-cliente] Failed to sync assignment:", e);
      // Continue: coach_id updated, assignment best-effort
    }
  } catch { return json({ error: "write_failed" }, 502); }
  return json({ ok: true, cliente_id, coach_id });
});
