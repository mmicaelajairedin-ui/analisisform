// ===================================================================
// admin-coach-op — operaciones de admin sobre coaches (extender trial /
// marcar pagado) SIN chocar con RLS.
//
// Problema que resuelve: desde el panel, "Extender trial" y "Marcar pagado"
// hacían un PATCH directo a usuarios. Bajo RLS estricto eso exige que el admin
// tenga (a) una policy que lo habilite y (b) su usuarios.auth_id ligado a
// auth.uid() (para que pw_is_admin() dé true). Si falta cualquiera de las dos,
// el UPDATE afecta 0 filas y "no deja".
//
// Esta función corre con SERVICE ROLE (bypassa RLS) y verifica al admin por
// EMAIL del JWT (no por auth_id): así funciona aunque el auth_id todavía no esté
// ligado — basta con tener una sesión de Supabase Auth activa (la que crea el
// login). Mismo gate de admin que crear-coach.
//
// Seguridad: solo escribe si el que llama tiene un JWT válido cuyo email es
// rol='admin' en usuarios. Sin eso → 403. El coach objetivo se identifica por
// id (uuid). No toca password_hash, rol, email ni auth_id del objetivo.
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY
// Deploy: supabase functions deploy admin-coach-op --no-verify-jwt
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
const isUuid = (s: string) => /^[0-9a-f-]{32,36}$/i.test(s);

// JWT del que llama → identidad verificada por Supabase Auth (email + uid).
// Devuelve {email, uid}: cualquiera de los dos puede venir null. La anon key no
// es un usuario real → {null, null}.
async function callerIdentity(token: string): Promise<{ email: string | null; uid: string | null }> {
  if (!token || token === ANON) return { email: null, uid: null };
  try {
    const r = await fetch(`${SB_URL}/auth/v1/user`, { headers: { apikey: ANON, Authorization: `Bearer ${token}` } });
    if (!r.ok) return { email: null, uid: null };
    const u = await r.json();
    const em = (u && u.email ? String(u.email) : "").trim().toLowerCase();
    const uid = (u && u.id ? String(u.id) : "").trim();
    return { email: EMAIL_RE.test(em) ? em : null, uid: isUuid(uid) ? uid : null };
  } catch {
    return { email: null, uid: null };
  }
}

// Admin si el que llama coincide con una fila usuarios rol='admin' por EMAIL del
// JWT O por auth_id (= auth.uid del JWT). El chequeo por auth_id cubre el caso
// real: la coach entra con Google (mmicaela...@gmail.com) pero su fila admin usa
// otro email de marca (hi@...); su auth_id SÍ está ligado, así que por ahí pasa.
async function isAdmin(email: string | null, uid: string | null): Promise<boolean> {
  const ors: string[] = [];
  if (email) ors.push(`email.ilike.${email}`);
  if (uid) ors.push(`auth_id.eq.${uid}`);
  if (!ors.length) return false;
  try {
    const r = await fetch(
      `${SB_URL}/rest/v1/usuarios?or=(${encodeURIComponent(ors.join(","))})&rol=eq.admin&select=id&limit=1`,
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

  // ── Gate de admin (por email del JWT O por auth_id) ───────────────
  const auth = req.headers.get("Authorization") || req.headers.get("authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  const who = await callerIdentity(token);
  if ((!who.email && !who.uid) || !(await isAdmin(who.email, who.uid))) return json({ error: "not_admin" }, 403);

  // ── Input ─────────────────────────────────────────────────────────
  let body: { op?: string; coach_id?: string; dias?: number | string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad_json" }, 400);
  }
  const op = (body.op || "").toString();
  const coachId = (body.coach_id || "").toString().trim();
  if (!isUuid(coachId)) return json({ error: "coach_id_invalid" }, 400);
  if (op !== "extend_trial" && op !== "mark_paid" && op !== "set_plan") return json({ error: "op_invalid" }, 400);

  // ── Leer la config actual del coach objetivo ──────────────────────
  let cur: { configuracion: Record<string, unknown> | null } | null = null;
  try {
    const r = await fetch(
      `${SB_URL}/rest/v1/usuarios?id=eq.${encodeURIComponent(coachId)}&select=configuracion,rol&limit=1`,
      { headers: svc },
    );
    if (r.ok) { const rows = await r.json(); if (Array.isArray(rows) && rows.length) cur = rows[0]; }
  } catch {
    return json({ error: "db_unreachable" }, 502);
  }
  if (!cur) return json({ error: "coach_not_found" }, 404);

  const cfg: Record<string, unknown> = (cur.configuracion && typeof cur.configuracion === "object") ? { ...cur.configuracion } : {};
  const nowIso = new Date().toISOString();

  if (op === "extend_trial") {
    let dias = parseInt(String(body.dias ?? 30), 10);
    if (!Number.isFinite(dias) || dias < 1 || dias > 365) dias = 30;
    const prev = cfg.fecha_fin_prueba ? new Date(String(cfg.fecha_fin_prueba)) : null;
    let base = (prev && !isNaN(prev.getTime()) && prev.getTime() > Date.now()) ? prev : new Date();
    base = new Date(base.getTime() + dias * 86400000);
    cfg.fecha_fin_prueba = base.toISOString();
    cfg.estado_sub = "prueba";
    cfg.ultima_extension_admin = nowIso;
  } else if (op === "set_plan") {
    cfg.plan = (body.plan === "pro") ? "pro" : "basic";
    cfg.plan_admin_at = nowIso;
  } else { // mark_paid
    cfg.estado_sub = "activa";
    cfg.fecha_fin_prueba = null;
    cfg.marcado_pagado_admin = true;
    cfg.marcado_pagado_at = nowIso;
  }

  try {
    const r = await fetch(
      `${SB_URL}/rest/v1/usuarios?id=eq.${encodeURIComponent(coachId)}`,
      {
        method: "PATCH",
        headers: { ...svc, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ configuracion: cfg, activo: true }),
      },
    );
    if (!r.ok) {
      const t = await r.text().catch(() => "");
      return json({ error: "write_failed", status: r.status, detail: t.slice(0, 200) }, 502);
    }
    return json({ ok: true, op, coach_id: coachId, estado_sub: cfg.estado_sub, fecha_fin_prueba: cfg.fecha_fin_prueba });
  } catch {
    return json({ error: "write_failed" }, 502);
  }
});
