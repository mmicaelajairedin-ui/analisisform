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
    const r = await fetch(
      `${SB.USERS}/rest/v1/usuarios?email=eq.${encodeURIComponent(email)}&rol=eq.owner&select=org_id&limit=1`,
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
      `${SB.USERS}/rest/v1/usuarios?id=eq.${encodeURIComponent(coachId)}&org_id=eq.${encodeURIComponent(orgId)}&rol=in.(coach,owner)&select=id&limit=1`,
      { headers: svc },
    );
    if (!r.ok) return false;
    const rows = await r.json();
    return Array.isArray(rows) && rows.length > 0;
  } catch { return false; }
}
async function hasConflict(coachId: string, inicio: string): Promise<boolean> {
  try {
    const inicioMs = new Date(inicio).getTime();
    if (isNaN(inicioMs)) return false;
    const r = await fetch(
      `${SB.DATA}/rest/v1/citas?coach_id=eq.${encodeURIComponent(coachId)}&estado=neq.cancelada&select=inicio`,
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

  // ── Verificar conflictos (mismo coach, ±59 min) ──────────────────
  if (await hasConflict(coach_id, inicio)) {
    return json({ error: "coach_conflict", message: "El coach ya tiene una cita en ese horario." }, 409);
  }

  // ── Crear la cita ────────────────────────────────────────────────
  const base: Record<string, unknown> = { coach_id, nombre, email: cliEmail, tipo, inicio, estado: "confirmada", origen: "red" };
  const full = { ...base, modalidad, grupal, ...(modalidad === "presencial" && lugar ? { lugar } : {}) };
  async function insert(payload: Record<string, unknown>) {
    return await fetch(`${SB.DATA}/rest/v1/citas`, {
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
        await fetch(`${SB.DATA}/functions/v1/sync-cita-to-gcal`, {
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
    await fetch(`${SB.DATA}/functions/v1/send-email`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to, subject: "Tu sesión quedó agendada 🗓️", html, reply_to: "hi@pathwaycareercoach.com", signature: "pathway" }),
    });
  } catch { /* best-effort */ }
}
