// ===================================================================
// crear-cita-red — el DUEÑO de una red (rol='owner') agenda una cita/sesión
// para UNO DE SUS coaches. Corre con SERVICE ROLE (bypassa RLS) SOLO tras
// verificar que quien llama es el owner de esa organización y que el coach
// destino pertenece a su empresa (mismo org_id).
//
// La RLS de citas es por coach → el owner no puede insertar una cita con el
// coach_id de otro por PATCH/POST directo del navegador. Va por acá, verificada
// (misma lección que asignar-cliente / agregar-cliente-red).
//
// El room de la Sala se deriva luego en el front como Pathway-<coach_id>-<ms>,
// así que la cita solo necesita coach_id + inicio para que el link salga solo.
//
// Body:   { coach_id, nombre, email?, tipo, inicio (ISO), modalidad?, lugar?, grupal? }
// Header: Authorization: Bearer <JWT del owner logueado>
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
async function ownerOrg(email: string): Promise<string | null> {
  try {
    const r = await fetch(
      `${SB_URL}/rest/v1/usuarios?email=eq.${encodeURIComponent(email)}&rol=eq.owner&select=org_id&limit=1`,
      { headers: svc },
    );
    if (!r.ok) return null;
    const rows = await r.json();
    return (Array.isArray(rows) && rows[0] ? rows[0].org_id : null) || null;
  } catch { return null; }
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

  // ── El coach destino debe ser de ESTA empresa ───────────────────
  if (!(await coachInOrg(coach_id, orgId))) return json({ error: "coach_ajeno" }, 403);

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
    return json({ ok: true, cita });
  } catch { return json({ error: "write_failed" }, 502); }
});
