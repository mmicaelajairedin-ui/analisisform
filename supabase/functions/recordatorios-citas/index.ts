// Supabase Edge Function — recordatorios-citas
//
// Manda por EMAIL los recordatorios de las próximas sesiones reservadas por el
// link (tabla `citas`). Lo dispara un cron (GitHub Actions) cada ~15 min.
//
// - 24 h antes: recordatorio "es mañana".
// - 1 h antes:  recordatorio "es en un rato".
// Idempotente: marca rem_24h_at / rem_1h_at para no repetir aunque el cron corra
// muchas veces o se atrase. La hora se muestra en la zona de QUIEN reservó
// (cliente_tz), cayendo a la del coach o Europe/Madrid.
//
// Desplegar:  supabase functions deploy recordatorios-citas --no-verify-jwt
// Secrets (Supabase → Edge Functions → Secrets): ya existen para otros agentes
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, AGENT_TRIGGER_SECRET, BREVO_API_KEY

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, authorization, x-trigger-secret",
};

const DEFAULT_TZ = "Europe/Madrid";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const SB_URL = Deno.env.get("SUPABASE_URL") || "";
  const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const TRIGGER = Deno.env.get("AGENT_TRIGGER_SECRET") || "";
  if (!SB_URL || !SB_KEY) return json({ error: "supabase_env_missing" }, 500);

  // Auth: solo el cron con el secreto puede disparar.
  const got = req.headers.get("x-trigger-secret") || "";
  if (!TRIGGER || got !== TRIGGER) return json({ error: "unauthorized" }, 401);

  const now = Date.now();
  const inWin = new Date(now + 25 * 3600_000).toISOString(); // próximas 25 h

  // Citas próximas (las 25 h que vienen). Filtramos por estado en el código
  // (abajo) para incluir también las que aún no tienen estado seteado.
  // El select incluye las columnas nuevas (modalidad/lugar/grupal). Si todavía no
  // existen en la base (migración sin aplicar), PostgREST devuelve 400 → reintentamos
  // con el select base para NO romper TODOS los recordatorios por columnas opcionales.
  const baseSel = `id,nombre,email,tipo,inicio,estado,coach_id,cliente_tz,token,rem_24h_at,rem_1h_at`;
  const winQ = `&inicio=gte.${new Date(now).toISOString()}&inicio=lte.${inWin}&order=inicio.asc&limit=200`;
  const qFull = `${SB_URL}/rest/v1/citas?select=${baseSel},modalidad,lugar,grupal,lang,meet_link${winQ}`;
  const qBase = `${SB_URL}/rest/v1/citas?select=${baseSel}${winQ}`;
  let citas: Cita[] = [];
  try {
    let r = await fetch(qFull, { headers: sbH(SB_KEY) });
    if (r.status === 400) r = await fetch(qBase, { headers: sbH(SB_KEY) }); // columnas nuevas aún no existen
    if (!r.ok) return json({ error: "citas_query_failed", status: r.status }, 502);
    citas = await r.json();
  } catch (_e) { return json({ error: "citas_unreachable" }, 502); }

  if (!citas.length) return json({ ok: true, enviados: 0, revisadas: 0 });

  // Nombre + zona de los coaches involucrados (para personalizar y formatear hora).
  const coachIds = [...new Set(citas.map((c) => c.coach_id).filter(Boolean))];
  const coaches = await loadCoaches(SB_URL, SB_KEY, coachIds as string[]);

  // Estados "terminales" que NO reciben recordatorio (ya pasó o se cerró).
  const TERMINAL = ["cancelada", "asistio", "no_asistio", "gano", "perdio", "reprogramada"];

  let enviados = 0;
  for (const c of citas) {
    if (TERMINAL.indexOf(c.estado || "") >= 0) continue;
    if (!c.email || (c.email + "").indexOf("@") < 0) continue;
    const startMs = new Date(c.inicio).getTime();
    if (isNaN(startMs)) continue;
    const hUntil = (startMs - now) / 3600_000;
    const coach = coaches[c.coach_id || ""] || {};
    const tz = c.cliente_tz || coach.tz || DEFAULT_TZ;

    let kind: "1h" | "24h" | null = null;
    // 1 h primero: si aplica, apaga también el de 24 h (no mandamos dos juntos).
    if (!c.rem_1h_at && hUntil <= 1.5 && hUntil > -0.25) kind = "1h";
    else if (!c.rem_24h_at && hUntil <= 24 && hUntil > 1.5) kind = "24h";
    if (!kind) continue;

    // Obtener zoom_url del coach si está configurado
    let zoomUrl = "";
    try {
      const coachCfg = (coaches[c.coach_id || ""] || {}) as any;
      if (coachCfg.configuracion && coachCfg.configuracion.zoom_url) {
        zoomUrl = String(coachCfg.configuracion.zoom_url);
      }
    } catch (_e) { /* best-effort */ }

    const ok = await sendReminder(SB_URL, SB_KEY, c, coach, tz, kind, zoomUrl);
    if (!ok) continue;

    const patch: Record<string, string> = {};
    patch.rem_1h_at = kind === "1h" ? new Date(now).toISOString() : (c.rem_1h_at || "");
    if (kind === "1h") patch.rem_24h_at = c.rem_24h_at || new Date(now).toISOString();
    if (kind === "24h") patch.rem_24h_at = new Date(now).toISOString();
    // Limpiar claves vacías (no pisar con "").
    for (const k of Object.keys(patch)) if (!patch[k]) delete patch[k];
    try {
      await fetch(`${SB_URL}/rest/v1/citas?id=eq.${encodeURIComponent(c.id)}`, {
        method: "PATCH",
        headers: { ...sbH(SB_KEY), "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify(patch),
      });
    } catch (_e) { /* si falla el marcado, el próximo cron podría reintentar */ }
    enviados++;
  }

  return json({ ok: true, enviados, revisadas: citas.length });
});

interface Cita {
  id: string; nombre?: string; email?: string; tipo?: string; inicio: string;
  estado?: string; coach_id?: string; cliente_tz?: string; token?: string;
  rem_24h_at?: string | null; rem_1h_at?: string | null;
  modalidad?: string | null; lugar?: string | null; grupal?: boolean | null;
  lang?: string | null; meet_link?: string | null;
}
interface Coach { nombre?: string; email?: string; tz?: string; }

function sbH(key: string) { return { apikey: key, Authorization: `Bearer ${key}` }; }

async function loadCoaches(url: string, key: string, ids: string[]): Promise<Record<string, Coach & { configuracion?: Record<string, unknown> }>> {
  const out: Record<string, Coach & { configuracion?: Record<string, unknown> }> = {};
  if (!ids.length) return out;
  try {
    const list = ids.map((i) => `"${i}"`).join(",");
    const r = await fetch(
      `${url}/rest/v1/usuarios?id=in.(${list})&select=id,nombre,email,configuracion`,
      { headers: sbH(key) },
    );
    if (!r.ok) return out;
    const rows = await r.json();
    for (const u of rows) {
      const cfg = u.configuracion || {};
      const tz = (cfg.disponibilidad && cfg.disponibilidad.tz) || "";
      out[u.id] = { nombre: u.nombre, email: u.email, tz, configuracion: cfg };
    }
  } catch (_e) { /* best-effort */ }
  return out;
}

async function sendReminder(
  url: string, key: string, c: Cita, coach: Coach, tz: string, kind: "1h" | "24h", zoomUrl: string = "",
): Promise<boolean> {
  // Idioma del cliente (guardado en la reserva). Si no hay, español por defecto.
  const EN = String(c.lang || "").toLowerCase().slice(0, 2) === "en";
  const loc = EN ? "en-US" : "es-ES";
  const first = (c.nombre || "").split(" ")[0] || "";
  const coachName = coach.nombre || (EN ? "your coach" : "tu coach");
  const cuando = fmtFecha(c.inicio, tz, loc);
  const hora = fmtHora(c.inicio, tz, loc);
  const tipo = c.tipo || (EN ? "session" : "sesión");
  const subject = kind === "1h"
    ? (EN ? `⏰ Your ${tipo} with ${coachName} is soon (${hora})` : `⏰ Tu ${tipo} con ${coachName} es en un rato (${hora})`)
    : (EN ? `📅 Reminder: your ${tipo} with ${coachName} is tomorrow (${cuando})` : `📅 Recordatorio: tu ${tipo} con ${coachName} es mañana (${cuando})`);
  const intro = kind === "1h"
    ? (EN ? `Your <strong>${esc(tipo)}</strong> with ${esc(coachName)} is <strong>today at ${esc(hora)}</strong>. See you there!` : `Tu <strong>${esc(tipo)}</strong> con ${esc(coachName)} es <strong>hoy a las ${esc(hora)}</strong>. ¡Te esperamos!`)
    : (EN ? `A reminder about your <strong>${esc(tipo)}</strong> with ${esc(coachName)}: <strong>${esc(cuando)} at ${esc(hora)}</strong>.` : `Te recordamos tu <strong>${esc(tipo)}</strong> con ${esc(coachName)}: <strong>${esc(cuando)} a las ${esc(hora)}</strong>.`);

  // Determinar qué link usar: Zoom → Google Meet → Pathway Sala
  const esPresencial = String(c.modalidad || "online") === "presencial";
  const startMs = new Date(c.inicio).getTime();
  const salaRoom = "Pathway-" + (c.coach_id || "x") + "-" + startMs;
  const salaLink = "https://pathwaycareercoach.com/sala.html?room=" + encodeURIComponent(salaRoom);

  // Priority: Zoom → Google Meet → Pathway Sala
  let videoLink = "";
  let videoLabel = "";
  if (!esPresencial) {
    if (zoomUrl) {
      videoLink = zoomUrl;
      videoLabel = EN ? "Video call" : "Videollamada";
    } else if (c.meet_link) {
      videoLink = c.meet_link;
      videoLabel = EN ? "Google Meet" : "Google Meet";
    } else {
      videoLink = salaLink;
      videoLabel = EN ? "Pathway video call" : "Videollamada de Pathway";
    }
  }

  const lineaModo = esPresencial
    ? `<div style="margin-top:4px">📍 <strong>${EN ? "In person" : "Presencial"}</strong>${c.lugar ? ` · ${esc(String(c.lugar))}` : ""}</div>`
    : `<div style="margin-top:4px">💻 ${esc(videoLabel)}</div>`;
  const botonModo = esPresencial || !videoLink
    ? ``
    : `<a href="${esc(videoLink)}" target="_blank" rel="noopener" style="display:inline-block;background:#1B4332;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:700;font-size:14px;margin:2px 0 12px">📹 ${EN ? "Join video call" : "Entrar a la videollamada"}</a>`;

  const html =
    `<div style="font-family:Inter,-apple-system,'Segoe UI',sans-serif;max-width:480px;margin:0 auto">` +
    `<p style="font-size:15px;color:#1B2E26">${EN ? "Hi" : "Hola"} ${esc(first)},</p>` +
    `<p style="font-size:14px;line-height:1.6;color:#42504A">${intro}</p>` +
    `<div style="background:#F0F5EF;border-radius:12px;padding:14px 16px;margin:14px 0;font-size:14px;color:#1B2E26">` +
    `<div>📅 <strong>${esc(cuando)}</strong></div>` +
    `<div style="margin-top:4px">⏰ <strong>${esc(hora)}</strong> <span style="color:#5A6A60;font-size:12px">(${esc(tz)})</span></div>` +
    lineaModo +
    `</div>` +
    botonModo +
    (c.token
      ? `<p style="font-size:12.5px;color:#8A968E;line-height:1.5">${EN ? "Can't make that time?" : "¿No podés en ese horario?"} <a href="https://pathwaycareercoach.com/gestionar-cita.html?t=${esc(c.token)}" style="color:#2D6A4F;font-weight:700">${EN ? "Cancel or reschedule" : "Cancelar o reprogramar"}</a>.</p>`
      : `<p style="font-size:12.5px;color:#8A968E;line-height:1.5">${EN ? "If that time doesn't work, reply to this email and we'll reschedule." : "Si no podés en ese horario, respondé este email y lo reprogramamos."}</p>`) +
    `</div>`;

  try {
    const r = await fetch(`${url}/functions/v1/send-email`, {
      method: "POST",
      headers: { ...sbH(key), "Content-Type": "application/json" },
      body: JSON.stringify({
        to: c.email, to_name: c.nombre || "", subject, html,
        reply_to: coach.email || "hi@pathwaycareercoach.com", signature: "pathway",
      }),
    });
    return r.ok;
  } catch (_e) { return false; }
}

function fmtFecha(iso: string, tz: string, loc = "es-ES"): string {
  try {
    return new Date(iso).toLocaleDateString(loc, {
      timeZone: tz, weekday: "long", day: "numeric", month: "long",
    });
  } catch (_e) { return new Date(iso).toLocaleDateString(loc); }
}
function fmtHora(iso: string, tz: string, loc = "es-ES"): string {
  try {
    return new Date(iso).toLocaleTimeString(loc, {
      timeZone: tz, hour: "2-digit", minute: "2-digit",
    });
  } catch (_e) { return ""; }
}
function esc(s: unknown): string {
  return ("" + (s == null ? "" : s)).replace(/[&<>"']/g, (ch) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]!));
}
function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status, headers: { ...CORS, "content-type": "application/json; charset=utf-8" },
  });
}
