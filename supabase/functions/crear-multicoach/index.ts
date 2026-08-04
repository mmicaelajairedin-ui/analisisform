// ===================================================================
// crear-multicoach — alta / extensión de un MULTICOACH (dueño de una red de
// coaches) desde el panel del admin, SIN chocar con RLS.
//
// Es el hermano de `crear-coach`, pero además de crear al dueño crea la
// ORGANIZACIÓN (la red/empresa) con sus límites según el plan:
//   - boutique → 3 coaches, 15 clientes, $149/mes
//   - pro      → ilimitado / ilimitado, $220/mes
//
// El dueño queda como usuarios.rol='owner' con org_id = su organización. Sus
// coaches (que sumará después) llevan el mismo org_id con rol='coach'. Un
// coach/cliente sin org_id = modelo normal (no cambia nada).
//
// Corre con SERVICE ROLE (bypassa RLS) SOLO tras verificar que quien llama es
// admin: valida el JWT contra /auth/v1/user y confirma rol='admin'. Mismo
// criterio que crear-coach / migrate-user-to-auth.
//
// Body:   { email, nombre, nombre_red, plan:'boutique'|'pro', nicho, dias }
// Header: Authorization: Bearer <JWT del admin logueado>
// Resp:   { ok, mode:'created'|'extended', org_id, plan, fecha_fin_prueba } | { error }
//
// Env (auto-inyectadas): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY
// Deploy: supabase functions deploy crear-multicoach --no-verify-jwt
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

// Límites por plan. NULL = ilimitado. (~15 clientes por coach.)
//   boutique $149 → 3 coaches / 45 clientes
//   studio   $249 → 8 coaches / 120 clientes
//   pro      $399+ → ilimitado / ilimitado
function planLimits(plan: string): { max_coaches: number | null; max_clientes: number | null } {
  if (plan === "pro") return { max_coaches: null, max_clientes: null };
  if (plan === "studio") return { max_coaches: 8, max_clientes: 120 };
  // boutique (default)
  return { max_coaches: 3, max_clientes: 45 };
}

// Resuelve el JWT del que llama → { id (auth user id), email }. El id es el
// vínculo ESTABLE con usuarios.auth_id: el email del login (ej. Gmail) puede NO
// coincidir con el email de la ficha (ej. hi@...), pero el auth_id sí.
async function callerIdentity(token: string): Promise<{ id: string; email: string } | null> {
  if (!token || token === ANON) return null;
  try {
    const r = await fetch(`${SB_URL}/auth/v1/user`, {
      headers: { apikey: ANON, Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return null;
    const u = await r.json();
    const id = (u && u.id) ? String(u.id) : "";
    const em = (u && u.email ? String(u.email) : "").trim().toLowerCase();
    if (!id && !EMAIL_RE.test(em)) return null;
    return { id, email: EMAIL_RE.test(em) ? em : "" };
  } catch {
    return null;
  }
}

// ¿Es admin? Matchea por auth_id (link estable) O por email (case-insensitive).
async function isAdmin(id: string, email: string): Promise<boolean> {
  const ors: string[] = [];
  if (id) ors.push(`auth_id.eq.${encodeURIComponent(id)}`);
  if (email) ors.push(`email.ilike.${encodeURIComponent(email)}`);
  if (!ors.length) return false;
  try {
    const r = await fetch(
      `${SB_URL}/rest/v1/usuarios?or=(${ors.join(",")})&rol=eq.admin&select=id&limit=1`,
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
  // Diagnóstico fino: distinguir "no llegó la sesión" (el navegador mandó la
  // anon key en vez del JWT del admin) de "el email no es admin en la base".
  const who = await callerIdentity(token);
  if (!who) return json({ error: "no_session", hint: "el navegador no mandó tu login (JWT). Reingresá." }, 403);
  if (!(await isAdmin(who.id, who.email))) return json({ error: "not_admin", email: who.email }, 403);
  const adminEmail = who.email;

  // ── Input ────────────────────────────────────────────────────────
  let body: { email?: string; nombre?: string; nombre_red?: string; plan?: string; nicho?: string; dias?: number | string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad_json" }, 400);
  }

  const email = (body.email || "").toString().replace(/\s+/g, "").toLowerCase();
  if (!EMAIL_RE.test(email)) return json({ error: "email_invalid" }, 400);
  const nombre = (body.nombre || "").toString().trim();
  const nombreRed = (body.nombre_red || "").toString().trim();
  const nicho = (body.nicho || "carrera").toString().trim() || "carrera";
  const plan = (body.plan === "pro" || body.plan === "studio") ? body.plan : "boutique";
  const lim = planLimits(plan);
  const diasN = parseInt(String(body.dias ?? "14"), 10);
  const dias = Math.max(1, Math.min(365, isNaN(diasN) ? 14 : diasN));
  const trialEnd = new Date(Date.now() + dias * 86400000).toISOString();
  const trialDate = trialEnd.slice(0, 10); // YYYY-MM-DD para organizaciones.fecha_fin_prueba (DATE)

  // ── ¿Ya existe ese email en usuarios? ────────────────────────────
  type Urow = { id: string; rol: string; configuracion: Record<string, unknown> | null; nombre: string | null; org_id: string | null };
  let rows: Urow[] = [];
  try {
    const r = await fetch(
      `${SB_URL}/rest/v1/usuarios?email=eq.${encodeURIComponent(email)}&select=id,rol,configuracion,nombre,org_id`,
      { headers: svc },
    );
    if (!r.ok) return json({ error: "lookup_failed", status: r.status }, 502);
    rows = await r.json();
  } catch {
    return json({ error: "db_unreachable" }, 502);
  }

  let ownerRow: Urow | null = null;
  let anyRow: Urow | null = null;
  for (const u of rows || []) {
    if (!anyRow) anyRow = u;
    if ((u.rol === "owner" || u.rol === "admin") && !ownerRow) ownerRow = u;
  }

  // ── Helper: extiende (o crea) la organización del dueño ──────────
  // Busca la org por owner_email; si existe la extiende, si no la crea.
  // Si ownerId está disponible (usuario ya existe), lo incluye en payload.
  async function upsertOrg(existingOrgId: string | null, ownerId?: string): Promise<{ id: string } | null> {
    // 1) ¿Ya tiene org? (por org_id del owner o por owner_email)
    let orgId = existingOrgId;
    if (!orgId) {
      try {
        const r = await fetch(
          `${SB_URL}/rest/v1/organizaciones?owner_email=eq.${encodeURIComponent(email)}&select=id&limit=1`,
          { headers: svc },
        );
        if (r.ok) { const os = await r.json(); if (Array.isArray(os) && os[0]) orgId = os[0].id; }
      } catch { /* sigue a crear */ }
    }
    const orgFields: any = {
      nombre: nombreRed || nombre || "Mi red",
      owner_email: email,
      plan,
      nicho,
      max_coaches: lim.max_coaches,
      max_clientes: lim.max_clientes,
      estado_sub: "prueba",
      fecha_fin_prueba: trialDate,
      activo: true,
    };
    // CYCLE 4: Incluir owner_id (new FK) cuando esté disponible
    if (ownerId) orgFields.owner_id = ownerId;
    if (orgId) {
      try {
        const r = await fetch(
          `${SB_URL}/rest/v1/organizaciones?id=eq.${encodeURIComponent(orgId)}`,
          { method: "PATCH", headers: { ...svc, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify(orgFields) },
        );
        if (!r.ok) return null;
      } catch { return null; }
      return { id: orgId };
    }
    // Crear nueva
    try {
      const r = await fetch(
        `${SB_URL}/rest/v1/organizaciones`,
        { method: "POST", headers: { ...svc, "Content-Type": "application/json", Prefer: "return=representation" }, body: JSON.stringify(orgFields) },
      );
      if (!r.ok) return null;
      const created = await r.json();
      const row = Array.isArray(created) ? created[0] : created;
      return (row && row.id) ? { id: row.id } : null;
    } catch { return null; }
  }

  // ── Owner existente → extender la red + reactivar ────────────────
  if (ownerRow) {
    const org = await upsertOrg(ownerRow.org_id, ownerRow.id);
    if (!org) return json({ error: "org_write_failed" }, 502);
    const cf: Record<string, unknown> = (ownerRow.configuracion && typeof ownerRow.configuracion === "object") ? ownerRow.configuracion as Record<string, unknown> : {};
    const nc = {
      ...cf,
      plan,
      estado_sub: "prueba",
      fecha_fin_prueba: trialEnd,
      coach_type: nicho,
      ultima_extension_admin: new Date().toISOString(),
    };
    try {
      const r = await fetch(
        `${SB_URL}/rest/v1/usuarios?id=eq.${encodeURIComponent(ownerRow.id)}`,
        { method: "PATCH", headers: { ...svc, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify({ configuracion: nc, activo: true, org_id: org.id }) },
      );
      if (!r.ok) return json({ error: "update_failed", status: r.status }, 502);
    } catch {
      return json({ error: "write_failed" }, 502);
    }
    return json({ ok: true, mode: "extended", org_id: org.id, plan, fecha_fin_prueba: trialEnd, nombre: ownerRow.nombre || nombre });
  }

  // ── Email ocupado por otro rol (coach/cliente) → no pisar ────────
  if (anyRow) return json({ error: "email_in_use", rol: anyRow.rol || "?" }, 409);

  // ── Multicoach NUEVO → crear org + owner sin contraseña ──────────
  if (!nombre) return json({ error: "nombre_required" }, 400);
  const org = await upsertOrg(null);
  if (!org) return json({ error: "org_write_failed" }, 502);
  let newOwnerId: string | null = null;
  try {
    const r = await fetch(
      `${SB_URL}/rest/v1/usuarios`,
      {
        method: "POST",
        headers: { ...svc, "Content-Type": "application/json", Prefer: "return=representation" },
        body: JSON.stringify({
          email,
          nombre,
          rol: "owner",
          org_id: org.id,
          activo: true,
          configuracion: {
            plan,
            estado_sub: "prueba",
            fecha_fin_prueba: trialEnd,
            coach_type: nicho,
            es_multicoach: true,
            creado_por_admin: true,
            creado_por: adminEmail,
            pendiente_activacion: true,
          },
        }),
      },
    );
    if (!r.ok && r.status !== 409) return json({ error: "insert_failed", status: r.status }, 502);
    // CYCLE 4: Obtener el ID del nuevo usuario para actualizar org con owner_id
    if (r.ok) {
      const created = await r.json();
      const userData = Array.isArray(created) ? created[0] : created;
      newOwnerId = userData?.id || null;
    }
  } catch {
    return json({ error: "write_failed" }, 502);
  }
  // CYCLE 4: Actualizar org con owner_id si se creó el usuario
  if (newOwnerId && org.id) {
    try {
      await fetch(
        `${SB_URL}/rest/v1/organizaciones?id=eq.${encodeURIComponent(org.id)}`,
        { method: "PATCH", headers: { ...svc, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify({ owner_id: newOwnerId }) },
      );
    } catch { /* best-effort */ }
  }
  return json({ ok: true, mode: "created", org_id: org.id, plan, fecha_fin_prueba: trialEnd });
});
