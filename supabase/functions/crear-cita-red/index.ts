// ===================================================================
// crear-cita-red — el usuario logueado (owner|coach|collaborator) agenda una
// cita/sesión. El owner puede crear para cualquier coach de su org. El coach
// puede crear solo para sí mismo (coach_id = su user_id). Collaborator solo si
// tiene permiso CREATE_CITA.
//
// Corre con SERVICE ROLE (bypassa RLS) tras validar permisos. La RLS de citas
// es por coach → el usuario no puede insertar una cita con otro coach_id por
// PATCH/POST directo del navegador. Va por acá, verificada.
//
// Phase 2: Acepta coach + collaborator si tienen CREATE_CITA. Validaciones:
// - Coach: coach_id en request DEBE ser su user_id (previene tampering)
// - Collaborator: coach_id en request DEBE ser su user_id
// - Owner: coach_id puede ser cualquiera en su org
//
// Body:   { coach_id, nombre, email?, tipo, inicio (ISO), modalidad?, lugar?, grupal? }
// Header: Authorization: Bearer <JWT del user (owner|coach|collab)>
// Resp:   { ok, cita } | { error }
//
// Deploy: supabase functions deploy crear-cita-red --no-verify-jwt
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
async function coachInOrg(coachId: string, orgId: string): Promise<boolean> {
  try {
    const r = await fetch(
      `${SB_URL}/rest/v1/usuarios?id=eq.${encodeURIComponent(coachId)}&org_id=eq.${encodeURIComponent(orgId)}&rol=in.(coach,owner)&select=id&limit=1`,
      { headers: svc },
    );
    if (!r.ok) return false;
    const rows = await r.json();
    return Array.isArray(rows) && rows.length > 0;
  } catch { return false; }
}
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

async function hasConflict(coachId: string, inicio: string): Promise<boolean> {
  try {
    const inicioMs = new Date(inicio).getTime();
    if (isNaN(inicioMs)) return false;
    const r = await fetch(
      `${SB_URL}/rest/v1/citas?coach_id=eq.${encodeURIComponent(coachId)}&estado=neq.cancelada&select=inicio`,
      { headers: svc },
    );
    if (!r.ok) return false;
    const citas = await r.json();
    if (!Array.isArray(citas)) return false;
    return citas.some((c: { inicio: string }) => {
      const ms = new Date(c.inicio).getTime();
      const diff = Math.abs(ms - inicioMs) / (1000 * 60);
      return diff < 59;
    });
  } catch { return false; }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "post_only" }, 405);
  if (!SB_URL || !SERVICE || !ANON) return json({ error: "env_missing" }, 500);

  // ── Gate: quien llama debe tener permiso CREATE_CITA ───────────────────────
  const auth = req.headers.get("Authorization") || req.headers.get("authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  const email = await getEmailFromToken(token, SB_URL, ANON);
  if (!email) return json({ error: "invalid_token" }, 403);

  const orgId = await getOrgIdByEmail(email, SB_URL, SERVICE);
  if (!orgId) return json({ error: "no_org" }, 403);

  // Get user's ID and role
  async function getUserInfo(userEmail: string): Promise<{ id: string; rol: string } | null> {
    try {
      const r = await fetch(
        `${SB_URL}/rest/v1/usuarios?email=eq.${encodeURIComponent(userEmail)}&org_id=eq.${encodeURIComponent(
          orgId,
        )}&select=id,rol&limit=1`,
        { headers: svc },
      );
      if (!r.ok) return null;
      const rows = await r.json();
      return (Array.isArray(rows) && rows[0] ? rows[0] : null) || null;
    } catch {
      return null;
    }
  }

  const userInfo = await getUserInfo(email);
  if (!userInfo || !userInfo.id) return json({ error: "user_not_found" }, 403);

  // Validate permission
  const perm = await validatePermission(orgId, userInfo.id, "CREATE_CITA", SB_URL, SERVICE);
  if (!perm.allowed) {
    return json({ error: "permission_denied", reason: perm.reason }, 403);
  }

  const userId = userInfo.id;
  const userRole = userInfo.rol;

  // ── Input ────────────────────────────────────────────────────────
  let body: {
    coach_id?: string; nombre?: string; email?: string; tipo?: string;
    inicio?: string; modalidad?: string; lugar?: string; grupal?: boolean;
  };
  try { body = await req.json(); } catch { return json({ error: "bad_json" }, 400); }
  const coach_id = (body.coach_id || "").toString().trim();
  const inicio = (body.inicio || "").toString().trim();
  const nombre = (body.nombre || "").toString().trim().slice(0, 120);
  const cliEmail = (body.email || "").toString().trim().toLowerCase().slice(0, 160);
  const tipo = (body.tipo || "Sesión").toString().trim().slice(0, 80);
  const modalidad = body.modalidad === "presencial" ? "presencial" : "online";
  const lugar = (body.lugar || "").toString().trim().slice(0, 200);
  const grupal = body.grupal === true;
  if (!coach_id || !inicio) return json({ error: "missing_fields" }, 400);
  if (isNaN(new Date(inicio).getTime())) return json({ error: "bad_inicio" }, 400);

  // ── Validar que el coach_id es permitido según el rol del usuario ────────
  // Owner: puede crear cita para cualquier coach de su org
  // Coach/Collaborator: solo pueden crear para sí mismos (coach_id = su user_id)
  if (userRole !== "owner" && coach_id !== userId) {
    return json({ error: "cannot_create_for_other_coach" }, 403);
  }

  // ── El coach destino debe ser de ESTA empresa ───────────────────
  if (!(await coachInOrg(coach_id, orgId))) return json({ error: "coach_ajeno" }, 403);

  // ── Verificar conflictos (mismo coach, ±59 min) ──────────────────
  if (await hasConflict(coach_id, inicio)) {
    return json({ error: "coach_conflict", message: "El coach ya tiene una cita en ese horario." }, 409);
  }

  // ── Crear la cita ────────────────────────────────────────────────
  const base: Record<string, unknown> = { coach_id, nombre, email: cliEmail, tipo, inicio, estado: "confirmada", origen: "red" };
  const full = { ...base, modalidad, grupal, ...(modalidad === "presencial" && lugar ? { lugar } : {}) };
  async function insert(payload: Record<string, unknown>) {
    return await fetch(`${SB_URL}/rest/v1/citas`, {
      method: "POST",
      headers: { ...svc, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify(payload),
    });
  }
  try {
    let r = await insert(full);
    // Reintento SIN columnas opcionales (modalidad/lugar/grupal) si aún no existen.
    if (r.status === 400) r = await insert(base);
    if (!r.ok) return json({ error: "insert_failed", status: r.status }, 502);
    const rows = await r.json().catch(() => []);
    const cita = Array.isArray(rows) && rows[0] ? rows[0] : { coach_id, nombre, tipo, inicio, estado: "confirmada" };
    // Sincronizar a Google Calendar (best-effort — no bloquea la creación).
    // Extrae el hangoutLink y lo guarda en citas.meet_link.
    if (cita.id) {
      try {
        await fetch(`${SB_URL}/functions/v1/sync-cita-to-gcal`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: SERVICE, Authorization: `Bearer ${SERVICE}` },
          body: JSON.stringify({ cita_id: cita.id }),
        });
      } catch { /* ignore */ }
    }
    // Email de confirmación al cliente (best-effort, no bloquea la creación).
    // JULIO 2026: Google Meet links come from Google Calendar sync, not sala.html
    if (EMAIL_RE.test(cliEmail)) {
      try { await notificarCita(cliEmail, tipo, inicio, modalidad, lugar, cita.meet_link || ""); } catch { /* ignore */ }
    }
    return json({ ok: true, cita });
  } catch { return json({ error: "write_failed" }, 502); }
});

// Fecha legible desde el ISO, sin depender de la zona del server (parseo directo).
function fmtFecha(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]} · ${m[4]}:${m[5]}` : iso;
}
// Email de confirmación de la cita al cliente (misma idea que el panel del coach).
async function notificarCita(to: string, tipo: string, inicio: string, modalidad: string, lugar: string, meetLink: string): Promise<void> {
  const cuando = fmtFecha(inicio);
  const donde = modalidad === "presencial"
    ? `<p style='font-size:15px'>📍 <b>Presencial:</b> ${lugar || "te confirmamos el lugar"}</p>`
    : meetLink
      ? `<p style='margin:20px 0'><a href='${meetLink}' target='_blank' rel='noopener' style='background:#1F5740;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:15px;font-weight:600;display:inline-block'>Entrar a Google Meet →</a></p>`
      : `<p style='margin:20px 0;color:#8A968E'><b>Google Meet:</b> el link aparecerá en tu Google Calendar.</p>`;
  const html =
    "<p style='font-size:15px'>¡Hola!</p>" +
    "<p style='font-size:15px;line-height:1.6'>Tu sesión quedó agendada:</p>" +
    "<p style='font-size:15px'><b>" + tipo + "</b><br>🗓️ " + cuando + "</p>" +
    donde +
    "<p style='font-size:13px;color:#777'>Si necesitás reprogramar, respondé este correo.</p>";
  try {
    await fetch(`${SB_URL}/functions/v1/send-email`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to, subject: "Tu sesión quedó agendada 🗓️", html, reply_to: "hi@pathwaycareercoach.com", signature: "pathway" }),
    });
  } catch { /* best-effort */ }
}
