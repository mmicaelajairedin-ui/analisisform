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

import { modalidadCumplible, modalidadDeCita, modalidadElegida, videoDeCita, zoomEsSala } from "../_shared/agenda/modalidad.ts";
import type { ProveedorVideo } from "../_shared/agenda/tipos.ts";

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
/** F2.5 — Resuelve el CLIENTE de la red a partir del correo, para poder guardar
 *  `citas.client_id`. Hoy ninguna escritura la rellena y por eso las 66 citas de
 *  produccion la tienen NULL: la relacion cita->cliente se resolvia por string
 *  de correo, que se rompe en cuanto el cliente cambia de email.
 *
 *  Solo devuelve id cuando la resolucion es INEQUIVOCA: un unico candidato con
 *  ese correo DENTRO de la organizacion. Si hay cero (alguien que todavia no es
 *  cliente) o mas de uno, devuelve null — NULL es un estado legitimo, no un
 *  hueco, y es preferible a inventar una relacion falsa.
 *
 *  El correo se compara en minusculas y se re-verifica exacto: PostgREST no
 *  escapa `_`, que en LIKE es comodin de un caracter (mismo motivo por el que
 *  `_shared/agenda/identidad.ts` tiene `soloCorreoExacto`). */
async function clienteDeLaRed(email: string, orgId: string): Promise<number | null> {
  const buscado = (email || "").trim().toLowerCase();
  if (!buscado) return null;
  try {
    const r = await fetch(
      `${SB_URL}/rest/v1/candidatos?email=eq.${encodeURIComponent(buscado)}&org_id=eq.${encodeURIComponent(orgId)}&select=id,email&limit=2`,
      { headers: svc },
    );
    if (!r.ok) return null;
    const rows = await r.json();
    if (!Array.isArray(rows)) return null;
    const exactos = rows.filter(
      (c: { email?: string }) => (c.email || "").trim().toLowerCase() === buscado,
    );
    return exactos.length === 1 ? (exactos[0] as { id: number }).id : null;
  } catch { return null; }
}
/** `usuarios.configuracion` del coach: su eleccion de modalidad y lo que tiene
 *  conectado. Best-effort — si no se puede leer, la regla cae a Sala, que es su
 *  valor seguro, y no se promete ningun enlace que dependa de un tercero. */
async function configuracionDeCoach(
  coachId: string,
): Promise<{ video: unknown; gcal: boolean; zoomUrl: boolean }> {
  const VACIA = { video: null, gcal: false, zoomUrl: false };
  try {
    const r = await fetch(
      `${SB_URL}/rest/v1/usuarios?id=eq.${encodeURIComponent(coachId)}&select=configuracion&limit=1`,
      { headers: svc },
    );
    if (!r.ok) return VACIA;
    const rows = await r.json();
    const cfg = (Array.isArray(rows) && rows[0] && rows[0].configuracion) || null;
    if (!cfg) return VACIA;
    const g = cfg.gcal || {};
    return {
      video: cfg.video,
      gcal: !!(g.refresh_token || g.access_token || g.conectado === true),
      // Utilizable = es una SALA, no cualquier URL: un chat no abre reunion.
      zoomUrl: zoomEsSala(cfg.zoom_url),
    };
  } catch { return VACIA; }
}
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

  // ── Modalidad ────────────────────────────────────────────────────
  // MISMA regla que la reserva del cliente y que el alta desde el panel: el
  // proveedor sale de `usuarios.configuracion.video` del coach. Antes esta
  // funcion no escribia `video_proveedor` en absoluto, asi que aguas abajo cada
  // superficie volvia a adivinar — y adivinaba distinto.
  //
  // Quien llama puede forzar `presencial` para ESTA cita; es una excepcion por
  // cita, no un cambio de la modalidad del coach. Una cita online no puede
  // quedarse con proveedor 'presencial', asi que en ese cruce cae a Sala.
  // `modalidad` se DERIVA del proveedor: las dos columnas no pueden discrepar.
  const cfgCoach = await configuracionDeCoach(coach_id);
  const elegido = modalidadCumplible(modalidadElegida(cfgCoach.video), cfgCoach);
  const proveedor: ProveedorVideo = body.modalidad === "presencial"
    ? "presencial"
    : (elegido === "presencial" ? "sala" : elegido);
  const modalidad = modalidadDeCita(proveedor);

  // ── Crear la cita ────────────────────────────────────────────────
  // F2.5 — `client_id` obligatorio CUANDO la cita representa a un cliente ya
  // existente de la red. Si no resuelve de forma inequivoca queda NULL, que es
  // el estado correcto para quien todavia no es cliente. Va en `base` (no en el
  // objeto opcional) porque la columna existe desde la migracion de `citas` y
  // tiene FK a candidatos(id): no participa del reintento por columna ausente.
  const clientId = await clienteDeLaRed(cliEmail, orgId);
  const base: Record<string, unknown> = { coach_id, nombre, email: cliEmail, tipo, inicio, estado: "confirmada", origen: "red", ...(clientId !== null ? { client_id: clientId } : {}) };
  // `video_proveedor` viaja con `modalidad` en el mismo objeto opcional: si el
  // reintento por columna inexistente se dispara, caen las dos juntas y la fila
  // nunca queda con una sin la otra.
  const full = { ...base, modalidad, video_proveedor: proveedor, grupal, ...(modalidad === "presencial" && lugar ? { lugar } : {}) };
  async function insert(payload: Record<string, unknown>) {
    return await fetch(`${SB_URL}/rest/v1/citas`, {
      method: "POST",
      headers: { ...svc, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify(payload),
    });
  }
  try {
    let r = await insert(full);
    // Reintento sin las columnas realmente opcionales. `modalidad` y
    // `video_proveedor` SE CONSERVAN: existen desde hace meses, y soltarlas hacia
    // nacer una cita con proveedor NULL — la rama que `recordatorios-citas`
    // reserva para las citas anteriores al selector.
    if (r.status === 400) r = await insert({ ...base, modalidad, video_proveedor: proveedor });
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
      try { await notificarCita(cliEmail, tipo, inicio, modalidad, lugar, cita.meet_link || "", proveedor); } catch { /* ignore */ }
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
async function notificarCita(
  to: string, tipo: string, inicio: string, modalidad: string, lugar: string,
  meetLink: string, proveedor: string,
): Promise<void> {
  const cuando = fmtFecha(inicio);
  // La ETIQUETA sale del proveedor persistido y el ENLACE de la cita. Antes decia
  // "Entrar a Google Meet" para cualquier enlace —tambien Sala y Zoom— y, sin
  // enlace, prometia un Meet en el calendario que podia no existir.
  const v = videoDeCita({ video_proveedor: proveedor, meet_link: meetLink, modalidad });
  const donde = v.proveedor === "presencial"
    ? `<p style='font-size:15px'>📍 <b>Presencial:</b> ${lugar || "te confirmamos el lugar"}</p>`
    : v.url
      ? `<p style='margin:20px 0'><a href='${v.url}' target='_blank' rel='noopener' style='background:#1F5740;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:15px;font-weight:600;display:inline-block'>${v.etiqueta} →</a></p>`
      : `<p style='margin:20px 0;color:#8A968E'>Te enviaremos el enlace de la sesión.</p>`;
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
