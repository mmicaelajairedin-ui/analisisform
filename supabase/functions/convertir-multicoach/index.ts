// ===================================================================
// convertir-multicoach — promueve un COACH existente a MULTICOACH (dueño de su
// propia red). Admin-gated (service role). Crea la organización, cambia al
// coach a rol='owner' con ese org_id, y le PASA SUS CLIENTES a la nueva red
// (org_id = la nueva org, manteniendo coach_id = él → así arrancan asignados a
// él mismo, y después puede repartirlos a los coaches que sume).
//
// Body:   { coach_id, plan:'boutique'|'studio'|'pro', nombre_red, dias }
// Header: Authorization: Bearer <JWT del admin>
// Resp:   { ok, org_id, plan, movidos } | { error }
//
// Deploy: supabase functions deploy convertir-multicoach --no-verify-jwt
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

function planLimits(plan: string): { max_coaches: number | null; max_clientes: number | null } {
  if (plan === "pro") return { max_coaches: null, max_clientes: null };
  if (plan === "studio") return { max_coaches: 8, max_clientes: 120 };
  return { max_coaches: 3, max_clientes: 45 };
}
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
// Admin por auth_id (link estable) O email (el email del login puede no coincidir con el de la ficha).
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
  if (!(await isAdmin(who.id, who.email))) return json({ error: "not_admin", email: who.email }, 403);
  const adminEmail = who.email;

  let body: { coach_id?: string; plan?: string; nombre_red?: string; dias?: number | string };
  try { body = await req.json(); } catch { return json({ error: "bad_json" }, 400); }
  const coach_id = (body.coach_id || "").toString().trim();
  if (!coach_id) return json({ error: "missing_id" }, 400);
  const plan = (body.plan === "pro" || body.plan === "studio") ? body.plan : "boutique";
  const lim = planLimits(plan);
  const diasN = parseInt(String(body.dias ?? "14"), 10);
  const dias = Math.max(1, Math.min(365, isNaN(diasN) ? 14 : diasN));
  const trialEnd = new Date(Date.now() + dias * 86400000).toISOString();
  const trialDate = trialEnd.slice(0, 10);

  // El coach a convertir.
  let coach: { id: string; email: string; nombre: string | null; rol: string; org_id: string | null; configuracion: Record<string, unknown> | null; foto_url?: string | null } | null = null;
  try {
    const r = await fetch(`${SB_URL}/rest/v1/usuarios?id=eq.${encodeURIComponent(coach_id)}&select=id,email,nombre,rol,org_id,configuracion,foto_url&limit=1`, { headers: svc });
    if (!r.ok) return json({ error: "lookup_failed", status: r.status }, 502);
    const rows = await r.json();
    coach = (Array.isArray(rows) && rows[0]) || null;
  } catch { return json({ error: "db_unreachable" }, 502); }
  if (!coach) return json({ error: "coach_no_existe" }, 404);
  if (coach.rol === "owner") return json({ error: "ya_es_owner" }, 409);
  if (coach.rol !== "coach") return json({ error: "no_es_coach", rol: coach.rol }, 409);

  const cfg = (coach.configuracion && typeof coach.configuracion === "object") ? coach.configuracion as Record<string, unknown> : {};
  const nicho = (cfg.coach_type as string) || "carrera";
  const nombreRed = (body.nombre_red || "").toString().trim() || (coach.nombre ? `Red de ${coach.nombre}` : "Mi red");

  // La marca de la RED arranca sembrada con lo que el coach YA tenía (perfil
  // público / white-label): así su red se ve como él desde el minuto uno y solo
  // ajusta lo que quiera. Solo se copian los campos que existen (no pisar con
  // vacío). Los nombres calzan con lo que lee _mcBrand/Config en multicoach.html.
  const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
  const marca: Record<string, unknown> = { nombre: nombreRed };
  const _titulo = str(cfg.titulo) || str((coach as Record<string, unknown>).titulo_profesional);
  const _desc = str(cfg.bio) || str((coach as Record<string, unknown>).bio);
  const _agendar = str(cfg.calendly_url) || str(cfg.link_agendar);
  const _color = str(cfg.color_marca) || str(cfg.color);
  const _logo = str(cfg.logo_url) || str(cfg.logo);
  const _foto = str(coach.foto_url) || str(cfg.foto_url) || str(cfg.foto_perfil);
  if (_titulo) marca.titulo = _titulo;
  if (_desc) marca.descripcion = _desc;
  if (_agendar) marca.link_agendar = _agendar;
  if (/^#[0-9a-fA-F]{6}$/.test(_color)) marca.color = _color;
  if (_logo) marca.logo = _logo;
  if (_foto) marca.foto = _foto;

  // 1) Crear la organización.
  let orgId = "";
  try {
    const r = await fetch(`${SB_URL}/rest/v1/organizaciones`, {
      method: "POST", headers: { ...svc, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify({ nombre: nombreRed, owner_email: coach.email, owner_id: coach_id, plan, nicho, max_coaches: lim.max_coaches, max_clientes: lim.max_clientes, estado_sub: "prueba", fecha_fin_prueba: trialDate, activo: true, marca }),
    });
    if (!r.ok) return json({ error: "org_write_failed", status: r.status }, 502);
    const created = await r.json();
    const row = Array.isArray(created) ? created[0] : created;
    orgId = (row && row.id) || "";
  } catch { return json({ error: "org_write_failed" }, 502); }
  if (!orgId) return json({ error: "org_write_failed" }, 502);

  // 2) Promover el coach a owner (con su nueva org).
  const nc = { ...cfg, plan, estado_sub: "prueba", fecha_fin_prueba: trialEnd, coach_type: nicho, es_multicoach: true, convertido_por: adminEmail };
  try {
    const r = await fetch(`${SB_URL}/rest/v1/usuarios?id=eq.${encodeURIComponent(coach_id)}`, {
      method: "PATCH", headers: { ...svc, "Content-Type": "application/json", Prefer: "return=minimal" },
      // activo:true → reactiva la cuenta: si el coach venía con la prueba/suscripción
      // vencida (activo=false), sin esto quedaba trabado en el muro de pago del login
      // y no entraba a su red aunque ya sea owner.
      body: JSON.stringify({ rol: "owner", org_id: orgId, configuracion: nc, activo: true }),
    });
    if (!r.ok) return json({ error: "promote_failed", status: r.status }, 502);
  } catch { return json({ error: "promote_failed" }, 502); }

  // 3) Pasar SUS clientes a la nueva red (mantienen coach_id = él).
  let movidos = 0;
  try {
    const r = await fetch(`${SB_URL}/rest/v1/candidatos?coach_id=eq.${encodeURIComponent(coach_id)}`, {
      method: "PATCH", headers: { ...svc, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify({ org_id: orgId }),
    });
    if (r.ok) { const rows = await r.json(); movidos = Array.isArray(rows) ? rows.length : 0; }
  } catch { /* la red ya quedó creada; los clientes se pueden reasignar luego */ }

  // 4) Avisar al coach que ahora es MULTICOACH (email best-effort, no bloquea).
  try { await notificarConversion(coach.email, coach.nombre || "", nombreRed); } catch { /* ignore */ }

  return json({ ok: true, org_id: orgId, plan, movidos });
});

// Email de bienvenida a multicoach: le avisa al coach que ahora es dueño de su red
// y lo manda a entrar (el login lo rutea solo a multicoach.html por su rol='owner').
async function notificarConversion(to: string, nombre: string, red: string): Promise<boolean> {
  if (!to) return false;
  const fn = (nombre || "").split(" ")[0] || "";
  const redTxt = red || "tu red";
  const html =
    "<p style='font-size:15px'>Hola " + fn + ",</p>" +
    "<p style='font-size:15px;line-height:1.6'>¡Novedad grande! Ahora sos <b>multicoach</b> en Pathway: <b>" + redTxt + "</b> es tu red y vos sos el dueño. Podés sumar coaches y colaboradores, repartir tus clientes y gestionar todo desde un solo panel.</p>" +
    "<p style='margin:22px 0'><a href='https://pathwaycareercoach.com/login.html' style='background:#1F5740;color:#fff;text-decoration:none;padding:13px 26px;border-radius:10px;font-size:15px;font-weight:600;display:inline-block'>Entrar a mi red →</a></p>" +
    "<p style='font-size:14px;line-height:1.7;color:#42504A'><b>Tus primeros pasos:</b><br>1️⃣ Entrá con tu mismo email y contraseña.<br>2️⃣ Sumá a tu primer coach o colaborador.<br>3️⃣ Repartí tus clientes entre tu equipo.</p>" +
    "<p style='font-size:13px;color:#777'>Tus clientes actuales ya están en tu red, asignados a vos. Cualquier duda, respondé este correo.</p>";
  try {
    const r = await fetch(`${SB_URL}/functions/v1/send-email`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to, to_name: nombre || "", subject: "Ahora sos multicoach en Pathway 🎉", html, reply_to: "hi@pathwaycareercoach.com", signature: "pathway" }),
    });
    return r.ok;
  } catch { return false; }
}
