// ===================================================================
// editar-cita-red — el DUEÑO de una red edita o cancela una cita de su red
// (cambiar hora/tipo/modalidad, o cancelarla). Service role tras verificar que
// quien llama es el owner y que la cita pertenece a un coach de SU org.
//
// La RLS de citas es por coach → el owner no puede editar la cita de otro por
// PATCH directo. Va por acá, verificada.
//
// Body:   { cita_id, action:'update'|'cancel', inicio?, tipo?, modalidad?, lugar?, grupal? }
// Header: Authorization: Bearer <JWT del owner logueado>
// Resp:   { ok } | { error }
//
// Deploy: supabase functions deploy editar-cita-red --no-verify-jwt
// ===================================================================

import { SB } from "../supabase-config.ts";

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
    const r = await fetch(`${SB.AUTH}/auth/v1/user`, { headers: { apikey: ANON, Authorization: `Bearer ${token}` } });
    if (!r.ok) return null;
    const u = await r.json();
    const em = (u && u.email ? String(u.email) : "").trim().toLowerCase();
    return EMAIL_RE.test(em) ? em : null;
  } catch { return null; }
}
async function ownerOrg(email: string): Promise<string | null> {
  try {
    const r = await fetch(`${SB.USERS}/rest/v1/usuarios?email=eq.${encodeURIComponent(email)}&rol=eq.owner&select=org_id&limit=1`, { headers: svc });
    if (!r.ok) return null;
    const rows = await r.json();
    return (Array.isArray(rows) && rows[0] ? rows[0].org_id : null) || null;
  } catch { return null; }
}
async function coachInOrg(coachId: string, orgId: string): Promise<boolean> {
  try {
    const r = await fetch(`${SB.USERS}/rest/v1/usuarios?id=eq.${encodeURIComponent(coachId)}&org_id=eq.${encodeURIComponent(orgId)}&rol=in.(coach,owner)&select=id&limit=1`, { headers: svc });
    if (!r.ok) return false;
    const rows = await r.json();
    return Array.isArray(rows) && rows.length > 0;
  } catch { return false; }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "post_only" }, 405);
  if (!SB.DATA || !SB.USERS || !SERVICE || !ANON) return json({ error: "env_missing" }, 500);

  const auth = req.headers.get("Authorization") || req.headers.get("authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  const email = await callerEmail(token);
  if (!email) return json({ error: "not_owner" }, 403);
  const orgId = await ownerOrg(email);
  if (!orgId) return json({ error: "not_owner" }, 403);

  let body: { cita_id?: string; action?: string; inicio?: string; tipo?: string; modalidad?: string; lugar?: string; grupal?: boolean };
  try { body = await req.json(); } catch { return json({ error: "bad_json" }, 400); }
  const citaId = (body.cita_id || "").toString().trim();
  const action = body.action === "cancel" ? "cancel" : "update";
  if (!citaId) return json({ error: "missing_cita" }, 400);

  // La cita tiene que ser de un coach de ESTA org.
  let coachId = "";
  let citaEmail = "";
  let citaTipo = "Sesión";
  try {
    const r = await fetch(`${SB.DATA}/rest/v1/citas?id=eq.${encodeURIComponent(citaId)}&select=coach_id,email,tipo&limit=1`, { headers: svc });
    if (!r.ok) return json({ error: "lookup_failed", status: r.status }, 502);
    const rows = await r.json();
    if (!Array.isArray(rows) || !rows.length) return json({ error: "cita_no_existe" }, 404);
    coachId = String(rows[0].coach_id || "");
    citaEmail = String(rows[0].email || "").trim().toLowerCase();
    citaTipo = String(rows[0].tipo || "Sesión");
  } catch { return json({ error: "db_unreachable" }, 502); }
  if (!coachId || !(await coachInOrg(coachId, orgId))) return json({ error: "cita_ajena" }, 403);

  // Armar el patch.
  const patch: Record<string, unknown> = {};
  if (action === "cancel") {
    patch.estado = "cancelada";
  } else {
    if (typeof body.inicio === "string" && body.inicio && !isNaN(new Date(body.inicio).getTime())) patch.inicio = body.inicio;
    if (typeof body.tipo === "string") patch.tipo = body.tipo.slice(0, 80);
    if (typeof body.modalidad === "string") patch.modalidad = body.modalidad === "presencial" ? "presencial" : "online";
    if (typeof body.lugar === "string") patch.lugar = body.lugar.slice(0, 200);
    if (typeof body.grupal === "boolean") patch.grupal = body.grupal;
    if (!Object.keys(patch).length) return json({ error: "nada_que_editar" }, 400);
  }

  async function doPatch(p: Record<string, unknown>) {
    return await fetch(`${SB.DATA}/rest/v1/citas?id=eq.${encodeURIComponent(citaId)}`, {
      method: "PATCH", headers: { ...svc, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify(p),
    });
  }
  try {
    let r = await doPatch(patch);
    // Reintento sin columnas opcionales si aún no existen (modalidad/lugar/grupal).
    if (r.status === 400 && action === "update") {
      const p2: Record<string, unknown> = {}; if (patch.inicio) p2.inicio = patch.inicio; if (patch.tipo) p2.tipo = patch.tipo;
      if (Object.keys(p2).length) r = await doPatch(p2);
    }
    if (!r.ok) return json({ error: "update_failed", status: r.status }, 502);
  } catch { return json({ error: "write_failed" }, 502); }
  // Email al cliente avisando el cambio (best-effort, no bloquea).
  const EMAIL_OK = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(citaEmail);
  if (EMAIL_OK) {
    try {
      if (action === "cancel") {
        await notificarCambio(citaEmail, "Tu sesión fue cancelada", "<p style='font-size:15px'>Tu sesión <b>" + citaTipo + "</b> fue cancelada. Si necesitás reprogramar, respondé este correo.</p>");
      } else if (typeof patch.inicio === "string" && patch.inicio) {
        await notificarCambio(citaEmail, "Tu sesión se reprogramó 🗓️", "<p style='font-size:15px'>Tu sesión <b>" + citaTipo + "</b> se reprogramó para el <b>" + fmtFecha(String(patch.inicio)) + "</b>. ¡Te esperamos!</p>");
      }
    } catch { /* ignore */ }
  }
  return json({ ok: true });
});

function fmtFecha(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]} · ${m[4]}:${m[5]}` : iso;
}
async function notificarCambio(to: string, subject: string, inner: string): Promise<void> {
  const html = "<p style='font-size:15px'>¡Hola!</p>" + inner + "<p style='font-size:13px;color:#777'>Cualquier duda, respondé este correo.</p>";
  try {
    await fetch(`${SB.DATA}/functions/v1/send-email`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to, subject, html, reply_to: "hi@pathwaycareercoach.com", signature: "pathway" }),
    });
  } catch { /* best-effort */ }
}
