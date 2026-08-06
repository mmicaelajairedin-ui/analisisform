// ===================================================================
// asignar-cliente — el usuario logueado (owner) asigna/reasigna un cliente de
// su empresa a uno de SUS coaches. Corre con SERVICE ROLE (bypassa RLS) tras
// validar permisos. TANTO el cliente COMO el coach deben pertenecer a la misma
// organización (mismo org_id).
//
// Phase 2: Validado con validatePermission(ASSIGN_CLIENT). Por ahora owner-only,
// pero la arquitectura permite extenderlo a coaches con permiso específico.
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

// ============================================================================
// INLINED: Permission validation helper (Phase 2)
// ============================================================================
async function validatePermission(
  orgId: string,
  userId: string,
  action: string,
  sbUrl: string,
  serviceKey: string,
): Promise<{ allowed: boolean; reason?: string; role?: string }> {
  if (!orgId || !userId || !sbUrl || !serviceKey) {
    return { allowed: false, reason: "missing_params" };
  }

  try {
    const userResp = await fetch(
      `${sbUrl}/rest/v1/usuarios?id=eq.${encodeURIComponent(userId)}&org_id=eq.${encodeURIComponent(
        orgId,
      )}&select=id,rol,configuracion`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
      },
    );

    if (!userResp.ok) {
      return { allowed: false, reason: "user_lookup_failed" };
    }

    const users = await userResp.json();
    if (!Array.isArray(users) || users.length === 0) {
      return { allowed: false, reason: "user_not_in_org" };
    }

    const user = users[0];
    const role = user.rol || "unknown";

    if (action === "LIST_ORG_DATA") {
      if (role === "owner") return { allowed: true, role };
      if (role === "coach") return { allowed: true, role };
      return { allowed: false, reason: "insufficient_role", role };
    }

    if (action === "CREATE_CITA") {
      if (role === "owner") return { allowed: true, role };
      if (role === "coach") return { allowed: true, role };
      return { allowed: false, reason: "insufficient_role", role };
    }

    if (action === "ASSIGN_CLIENT") {
      if (role === "owner") return { allowed: true, role };
      return { allowed: false, reason: "owner_only", role };
    }

    return { allowed: false, reason: "unknown_action", role };
  } catch (err) {
    console.error("[validatePermission] Error:", err);
    return { allowed: false, reason: "validation_error" };
  }
}

async function getEmailFromToken(token: string, sbUrl: string, anonKey: string): Promise<string | null> {
  if (!token || !sbUrl || !anonKey) return null;
  try {
    const r = await fetch(`${sbUrl}/auth/v1/user`, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${token}`,
      },
    });
    if (!r.ok) return null;
    const u = await r.json();
    const em = (u && u.email ? String(u.email) : "").trim().toLowerCase();
    const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
    return EMAIL_RE.test(em) ? em : null;
  } catch {
    return null;
  }
}

async function getOrgIdByEmail(email: string, sbUrl: string, serviceKey: string): Promise<string | null> {
  if (!email || !sbUrl || !serviceKey) return null;
  try {
    const r = await fetch(
      `${sbUrl}/rest/v1/usuarios?email=eq.${encodeURIComponent(email)}&select=org_id&limit=1`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
      },
    );
    if (!r.ok) return null;
    const rows = await r.json();
    return (Array.isArray(rows) && rows[0] ? rows[0].org_id : null) || null;
  } catch {
    return null;
  }
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

  // ── Gate: quien llama debe tener permiso ASSIGN_CLIENT ──────────────────────
  const auth = req.headers.get("Authorization") || req.headers.get("authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  const email = await getEmailFromToken(token, SB_URL, ANON);
  if (!email) return json({ error: "invalid_token" }, 403);

  const orgId = await getOrgIdByEmail(email, SB_URL, SERVICE);
  if (!orgId) return json({ error: "no_org" }, 403);

  // Get user's ID
  async function getUserId(userEmail: string): Promise<string | null> {
    try {
      const r = await fetch(
        `${SB_URL}/rest/v1/usuarios?email=eq.${encodeURIComponent(userEmail)}&org_id=eq.${encodeURIComponent(
          orgId,
        )}&select=id&limit=1`,
        { headers: svc },
      );
      if (!r.ok) return null;
      const rows = await r.json();
      return (Array.isArray(rows) && rows[0] ? rows[0].id : null) || null;
    } catch {
      return null;
    }
  }

  const userId = await getUserId(email);
  if (!userId) return json({ error: "user_not_found" }, 403);

  // Validate permission
  const perm = await validatePermission(orgId, userId, "ASSIGN_CLIENT", SB_URL, SERVICE);
  if (!perm.allowed) {
    return json({ error: "permission_denied", reason: perm.reason }, 403);
  }

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
    const r = await fetch(
      `${SB_URL}/rest/v1/candidatos?id=eq.${encodeURIComponent(cliente_id)}&org_id=eq.${encodeURIComponent(orgId)}`,
      { method: "PATCH", headers: { ...svc, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify({ coach_id }) },
    );
    if (!r.ok) return json({ error: "update_failed", status: r.status }, 502);
  } catch { return json({ error: "write_failed" }, 502); }
  return json({ ok: true, cliente_id, coach_id });
});
