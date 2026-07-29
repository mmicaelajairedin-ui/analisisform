// ===================================================================
// agregar-coach-red — el DUEÑO de una red (rol='owner') suma un coach a SU
// empresa. Corre con SERVICE ROLE (bypassa RLS) SOLO tras verificar que quien
// llama es el owner de la org. Respeta el TOPE de coaches del plan
// (organizaciones.max_coaches; null = ilimitado): si ya llegó al tope, no crea
// y devuelve cap_reached ("llegaste a tus N coaches").
//
// El coach queda como usuarios.rol='coach' con el MISMO org_id y el nicho de la
// red (un multicoach = un solo nicho). No paga aparte: la red paga. Recibe el
// email para activar su cuenta y elegir contraseña (igual que crear-coach).
//
// Body:   { email, nombre }
// Header: Authorization: Bearer <JWT del owner logueado>
// Resp:   { ok, mode:'created'|'exists', coach_id } | { error, max?, count? }
//
// Deploy: supabase functions deploy agregar-coach-red --no-verify-jwt
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
// El owner y SU organización (con el tope y el nicho).
async function ownerOrg(email: string): Promise<{ id: string; max_coaches: number | null; nicho: string | null; nombre: string; welcome: string } | null> {
  try {
    const ur = await fetch(`${SB_URL}/rest/v1/usuarios?email=eq.${encodeURIComponent(email)}&rol=eq.owner&select=org_id&limit=1`, { headers: svc });
    if (!ur.ok) return null;
    const urows = await ur.json();
    const orgId = Array.isArray(urows) && urows[0] ? urows[0].org_id : null;
    if (!orgId) return null;
    const or = await fetch(`${SB_URL}/rest/v1/organizaciones?id=eq.${encodeURIComponent(orgId)}&select=id,max_coaches,nicho,nombre,marca&limit=1`, { headers: svc });
    if (!or.ok) return null;
    const orows = await or.json();
    const org = Array.isArray(orows) && orows[0] ? orows[0] : null;
    const welcome = (org && org.marca && typeof org.marca === "object" && typeof org.marca.coach_welcome === "string") ? org.marca.coach_welcome : "";
    return org ? { id: org.id, max_coaches: (org.max_coaches ?? null), nicho: (org.nicho ?? null), nombre: (org.nombre || ""), welcome } : null;
  } catch { return null; }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "post_only" }, 405);
  if (!SB_URL || !SERVICE || !ANON) return json({ error: "env_missing" }, 500);

  // ── Gate: owner de una org ───────────────────────────────────────
  const auth = req.headers.get("Authorization") || req.headers.get("authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  const email = await callerEmail(token);
  if (!email) return json({ error: "not_owner" }, 403);
  const org = await ownerOrg(email);
  if (!org) return json({ error: "not_owner" }, 403);

  // ── Input ────────────────────────────────────────────────────────
  let body: { email?: string; nombre?: string; member_role?: string };
  try { body = await req.json(); } catch { return json({ error: "bad_json" }, 400); }
  const cEmail = (body.email || "").toString().replace(/\s+/g, "").toLowerCase();
  if (!EMAIL_RE.test(cEmail)) return json({ error: "email_invalid" }, 400);
  const cNombre = (body.nombre || "").toString().trim();
  if (!cNombre) return json({ error: "nombre_required" }, 400);
  // Tipo de miembro: 'coach' (da clases) o 'colaborador' (no da clases, pero
  // gestiona clientes y ve la agenda — "casi como coach"). A nivel usuarios los
  // dos son rol='coach' (así heredan la RLS y el flujo de la red); la distinción
  // vive en configuracion.member_role → el panel la muestra/edita.
  const memberRole = (body.member_role || "coach").toString().toLowerCase() === "colaborador" ? "colaborador" : "coach";

  // ── ¿Ya existe ese email? ────────────────────────────────────────
  let rows: Array<{ id: string; rol: string; org_id: string | null }> = [];
  try {
    const r = await fetch(`${SB_URL}/rest/v1/usuarios?email=eq.${encodeURIComponent(cEmail)}&select=id,rol,org_id`, { headers: svc });
    if (!r.ok) return json({ error: "lookup_failed", status: r.status }, 502);
    rows = await r.json();
  } catch { return json({ error: "db_unreachable" }, 502); }
  const existing = (rows || [])[0];
  if (existing) {
    // Ya es coach de ESTA red → ok idempotente. De otro rol/otra red → ocupado.
    if (existing.rol === "coach" && String(existing.org_id) === String(org.id)) return json({ ok: true, mode: "exists", coach_id: existing.id });
    return json({ error: "email_in_use", rol: existing.rol || "?" }, 409);
  }

  // ── Tope del plan ────────────────────────────────────────────────
  if (org.max_coaches != null) {
    try {
      const r = await fetch(`${SB_URL}/rest/v1/usuarios?org_id=eq.${encodeURIComponent(org.id)}&rol=eq.coach&select=id`, { headers: { ...svc, Prefer: "count=exact" } });
      let count = 0;
      const cr = r.headers.get("content-range"); // formato: 0-24/25
      if (cr && cr.indexOf("/") >= 0) count = parseInt(cr.split("/")[1], 10) || 0;
      else { const rowsC = await r.json(); count = Array.isArray(rowsC) ? rowsC.length : 0; }
      if (count >= org.max_coaches) return json({ error: "cap_reached", max: org.max_coaches, count }, 409);
    } catch { /* si el conteo falla, seguimos: mejor crear que trabar de gusto */ }
  }

  // ── Crear el coach de la red ─────────────────────────────────────
  const farEnd = new Date(Date.now() + 3650 * 86400000).toISOString(); // no paywall propio: la red paga
  try {
    const r = await fetch(`${SB_URL}/rest/v1/usuarios`, {
      method: "POST",
      headers: { ...svc, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify({
        email: cEmail, nombre: cNombre, rol: "coach", org_id: org.id, activo: true,
        configuracion: { plan: "red", estado_sub: "activa", fecha_fin_prueba: farEnd, coach_type: org.nicho || "carrera", es_coach_red: true, creado_por_owner: email, pendiente_activacion: true, member_role: memberRole, no_da_clases: memberRole === "colaborador" },
      }),
    });
    if (!r.ok && r.status !== 409) return json({ error: "insert_failed", status: r.status }, 502);
    let coachId = "";
    try { const created = await r.json(); const row = Array.isArray(created) ? created[0] : created; coachId = (row && row.id) || ""; } catch { /* return=minimal en 409 */ }
    // Email de activación AUTOMÁTICO (como el alta de coach del admin). No
    // bloquea: si el mail falla, el owner igual tiene el link en el panel.
    const emailSent = await enviarActivacion(cEmail, cNombre, org.nombre, org.welcome);
    return json({ ok: true, mode: "created", coach_id: coachId, email_sent: emailSent });
  } catch { return json({ error: "write_failed" }, 502); }
});

function esc(s: string): string {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
// Email de bienvenida/activación del coach de red (Brevo). Trae el NOMBRE de la red,
// los primeros pasos, y el mensaje de bienvenida que el OWNER puede editar
// (organizaciones.marca.coach_welcome). Así el onboarding sale de fábrica y el dueño
// lo personaliza a su estilo.
async function enviarActivacion(to: string, nombre: string, red: string, welcome: string): Promise<boolean> {
  const link = "https://pathwaycareercoach.com/registro.html?email=" + encodeURIComponent(to);
  const fn = esc((nombre || "").split(" ")[0] || "");
  const redTxt = red ? esc(red) : "una red";
  const custom = (welcome || "").trim()
    ? "<div style='background:#F0F5EF;border-radius:12px;padding:14px 16px;margin:16px 0;font-size:14px;line-height:1.6;color:#1B2E26'>" + esc(welcome.trim()) + "</div>"
    : "";
  const html =
    "<p style='font-size:15px'>Hola " + fn + ",</p>" +
    "<p style='font-size:15px;line-height:1.6'>Te sumaron a <b>" + redTxt + "</b> en Pathway. Para empezar, activá tu cuenta y elegí tu contraseña — toma 1 minuto.</p>" +
    custom +
    "<p style='margin:22px 0'><a href='" + link + "' style='background:#1F5740;color:#fff;text-decoration:none;padding:13px 26px;border-radius:10px;font-size:15px;font-weight:600;display:inline-block'>Activar mi cuenta →</a></p>" +
    "<p style='font-size:14px;line-height:1.7;color:#42504A'><b>Tus primeros pasos:</b><br>1️⃣ Activá tu cuenta con el botón de arriba.<br>2️⃣ Completá tu perfil (foto y datos).<br>3️⃣ Empezá a atender a tus clientes de la red.</p>" +
    "<p style='font-size:13px;color:#777'>Usá este mismo email (" + esc(to) + ") al activar. Cualquier duda, respondé este correo.</p>";
  try {
    const r = await fetch(`${SB_URL}/functions/v1/send-email`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to, to_name: nombre || "", subject: "Te sumaron a " + (red || "una red") + " · Activá tu cuenta", html, reply_to: "hi@pathwaycareercoach.com", signature: "pathway" }),
    });
    return r.ok;
  } catch { return false; }
}
