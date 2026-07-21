// ===================================================================
// crear-coach — alta / extensión de una cuenta de COACH desde el panel del
// admin, SIN chocar con RLS.
//
// Problema que resuelve: la tabla `usuarios` tiene RLS estricto
// (usuarios_hardening.sql) cuyas policies de INSERT solo permiten crear filas
// rol='cliente' (o la propia fila del usuario logueado). NO hay forma de que el
// navegador cree una fila rol='coach' de un email ajeno con la anon key ni con
// un JWT no-admin → el POST se rechaza con 403 y el botón "Dar acceso a un
// coach" del panel "no anda". El fallback por registro.html chocaba con la MISMA
// policy (anon solo puede rol='cliente').
//
// Esta función corre con SERVICE ROLE (bypassa RLS), PERO solo después de
// verificar que quien llama es admin de verdad: valida el JWT de Supabase Auth
// del que llama contra /auth/v1/user y confirma que ese email es rol='admin' en
// `usuarios`. Sin JWT de admin válido → 403. (Mismo criterio "re-verificar antes
// de escribir con service role" que migrate-user-to-auth.)
//
// Body: { email, nombre, dias, nicho }
// Header: Authorization: Bearer <JWT del admin logueado>
// Respuesta: { ok, mode:'created'|'extended', fecha_fin_prueba, nombre } | { error }
//
// Env (auto-inyectadas): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY
// Deploy: supabase functions deploy crear-coach --no-verify-jwt
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
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// Resuelve el JWT del que llama → email verificado por Supabase Auth (null si
// el token no corresponde a un usuario real, ej. es la anon key).
async function callerEmail(token: string): Promise<string | null> {
  if (!token || token === ANON) return null;
  try {
    const r = await fetch(`${SB_URL}/auth/v1/user`, {
      headers: { apikey: ANON, Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return null;
    const u = await r.json();
    const em = (u && u.email ? String(u.email) : "").trim().toLowerCase();
    return EMAIL_RE.test(em) ? em : null;
  } catch {
    return null;
  }
}

// ¿Ese email es rol='admin' en usuarios? (con service role, sin RLS).
async function isAdmin(email: string): Promise<boolean> {
  try {
    const r = await fetch(
      `${SB_URL}/rest/v1/usuarios?email=ilike.${encodeURIComponent(email)}&rol=eq.admin&select=id&limit=1`,
      { headers: svc },
    );
    if (!r.ok) return false;
    const rows = await r.json();
    return Array.isArray(rows) && rows.length > 0;
  } catch {
    return false;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "post_only" }, 405);
  if (!SB_URL || !SERVICE || !ANON) return json({ error: "env_missing" }, 500);

  // ── Gate de admin ────────────────────────────────────────────────
  const auth = req.headers.get("Authorization") || req.headers.get("authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  const adminEmail = await callerEmail(token);
  if (!adminEmail || !(await isAdmin(adminEmail))) {
    // 403 claro: la sesión de admin no está activa / no es admin.
    return json({ error: "not_admin" }, 403);
  }

  // ── Input ────────────────────────────────────────────────────────
  let body: { email?: string; nombre?: string; dias?: number | string; nicho?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad_json" }, 400);
  }

  const email = (body.email || "").toString().replace(/\s+/g, "").toLowerCase();
  if (!EMAIL_RE.test(email)) return json({ error: "email_invalid" }, 400);
  const nombre = (body.nombre || "").toString().trim();
  const nicho = (body.nicho || "carrera").toString().trim() || "carrera";
  const diasN = parseInt(String(body.dias ?? "30"), 10);
  const dias = Math.max(1, Math.min(365, isNaN(diasN) ? 30 : diasN));

  // ── ¿Ya existe ese email? ────────────────────────────────────────
  type Urow = { id: string; rol: string; configuracion: Record<string, unknown> | null; nombre: string | null };
  let rows: Urow[] = [];
  try {
    const r = await fetch(
      `${SB_URL}/rest/v1/usuarios?email=eq.${encodeURIComponent(email)}&select=id,rol,configuracion,nombre`,
      { headers: svc },
    );
    if (!r.ok) return json({ error: "lookup_failed", status: r.status }, 502);
    rows = await r.json();
  } catch {
    return json({ error: "db_unreachable" }, 502);
  }

  let coachRow: Urow | null = null;
  let anyRow: Urow | null = null;
  for (const u of rows || []) {
    if (!anyRow) anyRow = u;
    if ((u.rol === "coach" || u.rol === "admin") && !coachRow) coachRow = u;
  }

  // ── Coach existente → extender prueba + reactivar ────────────────
  if (coachRow) {
    const cf: Record<string, unknown> = (coachRow.configuracion && typeof coachRow.configuracion === "object") ? coachRow.configuracion as Record<string, unknown> : {};
    let base = cf.fecha_fin_prueba ? new Date(String(cf.fecha_fin_prueba)) : new Date();
    if (isNaN(base.getTime()) || base.getTime() < Date.now()) base = new Date();
    base.setDate(base.getDate() + dias);
    const nc = {
      ...cf,
      plan: (cf.plan as string) || "pro",
      estado_sub: "prueba",
      fecha_fin_prueba: base.toISOString(),
      coach_type: nicho,
      ultima_extension_admin: new Date().toISOString(),
    };
    try {
      const r = await fetch(
        `${SB_URL}/rest/v1/usuarios?id=eq.${encodeURIComponent(coachRow.id)}`,
        { method: "PATCH", headers: { ...svc, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify({ configuracion: nc, activo: true }) },
      );
      if (!r.ok) return json({ error: "update_failed", status: r.status }, 502);
    } catch {
      return json({ error: "write_failed" }, 502);
    }
    return json({ ok: true, mode: "extended", id: coachRow.id, fecha_fin_prueba: base.toISOString(), nombre: coachRow.nombre || nombre });
  }

  // ── Email ocupado por otro rol (cliente) → no pisar ──────────────
  if (anyRow) return json({ error: "email_in_use", rol: anyRow.rol || "?" }, 409);

  // ── Coach NUEVO → crear sin contraseña (la elige al activar) ─────
  if (!nombre) return json({ error: "nombre_required" }, 400);
  const trialEnd = new Date(Date.now() + dias * 86400000).toISOString();
  try {
    const r = await fetch(
      `${SB_URL}/rest/v1/usuarios`,
      {
        method: "POST",
        headers: { ...svc, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({
          email,
          nombre,
          rol: "coach",
          activo: true,
          configuracion: {
            plan: "pro",
            estado_sub: "prueba",
            fecha_fin_prueba: trialEnd,
            coach_type: nicho,
            creado_por_admin: true,
            creado_por: adminEmail,
            pendiente_activacion: true,
          },
        }),
      },
    );
    // 201 = ok; 409 = ya existía por email (intento previo que sí entró) → ok igual.
    if (!r.ok && r.status !== 409) return json({ error: "insert_failed", status: r.status }, 502);
  } catch {
    return json({ error: "write_failed" }, 502);
  }
  return json({ ok: true, mode: "created", fecha_fin_prueba: trialEnd });
});
