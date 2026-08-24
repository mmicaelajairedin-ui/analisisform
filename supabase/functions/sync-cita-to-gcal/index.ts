// ===================================================================
// sync-cita-to-gcal — lleva una cita al Google Calendar del coach.
//
// RESPETA `citas.video_proveedor`. No lo decide, no lo cambia salvo en la caída
// contractual de Meet, y NUNCA pisa un enlace que el cliente ya recibió.
//
// Antes hacía esto, y era INC-2: pedía un Google Meet en TODA cita y después
// escribía ese `hangoutLink` en `citas.meet_link` sin mirar nada. Una cita de
// Sala o de Zoom perdía su enlace, sustituido por un Meet que nadie eligió y
// que el cliente no tenía en su correo.
//
// Lo que hace ahora, por modalidad:
//   meet        pide conferencia. Con `hangoutLink` → lo guarda. Sin él, NO
//               finge: cae a Sala y persiste el proveedor FINAL, para que no
//               pueda quedar `video_proveedor='meet'` sin enlace de Meet.
//   sala        no pide conferencia. Si la fila aún no tiene enlace, escribe el
//               canónico; si ya lo tiene, no lo toca.
//   zoom        no pide conferencia. Conserva el enlace tal cual.
//   presencial  no pide conferencia, no hay enlace, y el `lugar` va como
//               `location` del evento.
//
// Y en los cuatro casos persiste `google_event_id`, que hasta ahora no escribía
// NADIE: sin él no se puede actualizar ni cancelar el evento en Google, así que
// cancelar una cita dejaba el evento vivo en el calendario del coach.
//
// POST body:
//   { cita_id (BIGINT) }
//   → { ok:true, proveedor, url, event_id } | { ok:false, reason }
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// Deploy: supabase functions deploy sync-cita-to-gcal --no-verify-jwt

import { urlSala } from "../_shared/agenda/video.ts";

const SB_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const svc = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` };

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

/**
 * Deja la fila coherente con lo que REALMENTE pasó, y es el UNICO sitio de esta
 * funcion que escribe en `citas`.
 *
 * Las dos invariantes que hacen imposible el estado que veniamos arrastrando:
 *
 *  1. `meet_link` solo se escribe cuando hay algo mejor que lo que ya hay. Un
 *     enlace ya guardado es el que el cliente recibio por correo: sustituirlo lo
 *     manda a un sitio distinto del que tiene delante. Zoom no se toca NUNCA.
 *
 *  2. `video_proveedor` y `meet_link` se escriben JUNTOS. Si Meet no devuelve
 *     conferencia, no se finge: baja a Sala y las dos columnas viajan en el
 *     mismo PATCH, asi que la fila no puede quedar en `meet` sin enlace de Meet
 *     ni en `meet` con enlace de Sala.
 */
async function cerrarModalidad(
  citaId: number,
  proveedor: string,
  quiereMeet: boolean,
  hangoutLink: string,
  meetLinkActual: string | null,
  salaUrl: string,
  eventId: string,
): Promise<{ proveedor: string; url: string }> {
  const patch: Record<string, unknown> = {};
  let final = proveedor;
  let url = String(meetLinkActual || "");

  if (proveedor === "presencial") {
    // Sin videollamada, y punto. No se limpia `meet_link` por si acaso: si algo
    // le puso un valor, borrarlo aqui seria otra escritura a ciegas.
    url = "";
  } else if (quiereMeet) {
    if (hangoutLink) {
      final = "meet";
      url = hangoutLink;
      patch.video_proveedor = "meet";
      patch.meet_link = hangoutLink;
    } else {
      // Google no dio conferencia. NO se finge que se creo un Meet.
      // Caida contractual a Sala, con el proveedor FINAL persistido.
      final = "sala";
      url = salaUrl;
      patch.video_proveedor = "sala";
      patch.meet_link = salaUrl;
    }
  } else if (proveedor === "sala") {
    // Se genera solo si falta. Las citas de `reservar.html` ya lo traen; las que
    // crea el panel o `crear-cita-red`, no.
    if (!url) { url = salaUrl; patch.meet_link = salaUrl; }
  }
  // `zoom`: no entra en ninguna rama que escriba. Su enlace es del coach.

  // `google_event_id` no lo escribia NADIE (0 de 66 filas). Sin el no se puede
  // actualizar ni cancelar el evento en Google: cancelar una cita dejaba el
  // evento vivo en el calendario del coach. Solo se escribe si Google dio uno.
  if (eventId) patch.google_event_id = eventId;

  if (Object.keys(patch).length) {
    try {
      const r = await fetch(`${SB_URL}/rest/v1/citas?id=eq.${citaId}`, {
        method: "PATCH",
        headers: { ...svc, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify(patch),
      });
      if (!r.ok) console.error(`sync-cita-to-gcal: PATCH cita ${citaId} fallo`, r.status);
    } catch (e) {
      console.error(`sync-cita-to-gcal: PATCH cita ${citaId} lanzo`, e);
    }
  }

  return { proveedor: final, url };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "post_only" }, 405);
  if (!SB_URL || !SERVICE) return json({ error: "env_missing" }, 500);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "bad_json" }, 400); }

  const citaId = Number(body.cita_id || 0);
  if (!citaId) return json({ error: "no_cita_id" }, 400);

  try {
    // 1) Obtener detalles de la cita
    const cr = await fetch(`${SB_URL}/rest/v1/citas?id=eq.${citaId}&select=*`, { headers: svc });
    if (!cr.ok) return json({ error: "cita_query_failed" }, 502);
    const citas = await cr.json();
    if (!Array.isArray(citas) || !citas.length) return json({ error: "cita_not_found" }, 404);
    const cita = citas[0];
    const { coach_id, nombre, inicio, modalidad, lugar } = cita;
    if (!coach_id || !inicio) return json({ error: "cita_incomplete" }, 400);

    // La decision de modalidad ya esta tomada (paso 2). Aqui SOLO se obedece.
    // Sin proveedor declarado —citas anteriores al selector— se trata como Sala,
    // que es el valor seguro del contrato; lo que NO se hace es pedir un Meet
    // "por si acaso", que es como se pisaban los enlaces.
    const proveedor: string = String(cita.video_proveedor || "sala").toLowerCase();
    const esPresencial = modalidad === "presencial" || proveedor === "presencial";
    const quiereMeet = proveedor === "meet";
    const salaUrl = urlSala(citaId, String(coach_id), cita.grupal === true);

    // `location` del evento de Google: lo que sirva para llegar a la sesion.
    const location = esPresencial
      ? String(lugar || "")
      : (quiereMeet ? "" : String(cita.meet_link || (proveedor === "sala" ? salaUrl : "")));

    // 2) Calcular hora fin (asumimos 1h de duración)
    const startMs = new Date(inicio).getTime();
    const endMs = startMs + 3600000;
    const endISO = new Date(endMs).toISOString();

    // 3) Llamar a gcal-push para crear evento en Google Calendar
    const pushResp = await fetch(`${SB_URL}/functions/v1/gcal-push`, {
      method: "POST",
      headers: { ...svc, "Content-Type": "application/json" },
      body: JSON.stringify({
        coach_id,
        op: "create",
        event: {
          summary: nombre || "Sesión · Pathway",
          description: "",
          location,
          startISO: inicio,
          endISO,
          // Opt-in. Solo Meet pide conferencia; Sala, Zoom y Presencial NO.
          conferencia: quiereMeet,
        },
      }),
    });

    if (!pushResp.ok) {
      const err = await pushResp.json().catch(() => ({}));
      // Si gcal-push falla por falta de conexión Google, no es error fatal
      if ((err && err.reason === "coach_no_gcal_write") || !coach_id) {
        // Sin Google no hay evento, pero la cita sigue siendo valida: se cierra
        // igual la modalidad para que no quede a medias.
        const cierre = await cerrarModalidad(citaId, proveedor, quiereMeet, "", cita.meet_link, salaUrl, "");
        return json({ ok: true, reason: "no_gcal", ...cierre });
      }
      return json({ error: "gcal_push_failed", detail: err }, 502);
    }

    const pushData = await pushResp.json();
    const hangoutLink = String(pushData.hangoutLink || "");
    const eventId = String(pushData.event_id || "");

    const cierre = await cerrarModalidad(citaId, proveedor, quiereMeet, hangoutLink, cita.meet_link, salaUrl, eventId);
    return json({ ok: true, event_id: eventId, ...cierre });
  } catch (e) {
    console.error("sync-cita-to-gcal error:", e);
    return json({ error: "internal_error", detail: String(e) }, 500);
  }
});
