// ===================================================================
// sync-cita-to-gcal — Sincroniza una cita a Google Calendar y guarda el Meet link
//
// Después de que se crea una cita en Supabase, esta función:
// 1. Obtiene los detalles de la cita (nombre, inicio, fin, modalidad, lugar)
// 2. Llama a gcal-push para crear el evento en Google Calendar
// 3. Extrae el hangoutLink (Google Meet)
// 4. Guarda el link en citas.meet_link
//
// POST body:
//   { cita_id (BIGINT) }
//   → { ok:true, hangoutLink } | { ok:false, reason }
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// Deploy: supabase functions deploy sync-cita-to-gcal --no-verify-jwt

import { SB } from "../supabase-config.ts";

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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "post_only" }, 405);
  if (!SB.DATA || !SERVICE) return json({ error: "env_missing" }, 500);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "bad_json" }, 400); }

  const citaId = Number(body.cita_id || 0);
  if (!citaId) return json({ error: "no_cita_id" }, 400);

  try {
    // 1) Obtener detalles de la cita
    const cr = await fetch(`${SB.DATA}/rest/v1/citas?id=eq.${citaId}&select=*`, { headers: svc });
    if (!cr.ok) return json({ error: "cita_query_failed" }, 502);
    const citas = await cr.json();
    if (!Array.isArray(citas) || !citas.length) return json({ error: "cita_not_found" }, 404);
    const cita = citas[0];
    const { coach_id, nombre, inicio, modalidad, lugar, email, tipo } = cita;
    if (!coach_id || !inicio) return json({ error: "cita_incomplete" }, 400);

    // 2) Calcular hora fin (asumimos 1h de duración)
    const startMs = new Date(inicio).getTime();
    const endMs = startMs + 3600000;
    const endISO = new Date(endMs).toISOString();

    // 3) Llamar a gcal-push para crear evento en Google Calendar
    const pushResp = await fetch(`${SB.DATA}/functions/v1/gcal-push`, {
      method: "POST",
      headers: { ...svc, "Content-Type": "application/json" },
      body: JSON.stringify({
        coach_id,
        op: "create",
        event: {
          summary: nombre || "Sesión · Pathway",
          description: "", // JULIO 2026: Empty description; Google Meet is auto-generated in conferenceData
          location: modalidad === "presencial" ? (lugar || "") : "",
          startISO: inicio,
          endISO,
        },
      }),
    });

    if (!pushResp.ok) {
      const err = await pushResp.json().catch(() => ({}));
      // Si gcal-push falla por falta de conexión Google, no es error fatal
      if ((err && err.reason === "coach_no_gcal_write") || !coach_id) {
        return json({ ok: true, hangoutLink: "", reason: "no_gcal" });
      }
      return json({ error: "gcal_push_failed", detail: err }, 502);
    }

    const pushData = await pushResp.json();
    console.log(`[SYNC-CITA] gcal-push response: ok=${pushData.ok}, event_id=${pushData.event_id || "MISSING"}, hangoutLink=${pushData.hangoutLink ? "FOUND" : "MISSING"}`);

    const hangoutLink = pushData.hangoutLink || "";
    const eventId = pushData.event_id || "";

    // 4) Guardar ambos campos en UN SOLO PATCH (meet_link + google_event_id)
    const patchPayload: Record<string, string> = {};
    if (hangoutLink) patchPayload.meet_link = hangoutLink;
    if (eventId) patchPayload.google_event_id = eventId;

    if (Object.keys(patchPayload).length > 0) {
      console.log(`[PATCH] Payload: ${JSON.stringify(patchPayload)}`);
      console.log(`[PATCH] URL: ${SB.DATA}/rest/v1/citas?id=eq.${citaId}`);

      const ur = await fetch(`${SB.DATA}/rest/v1/citas?id=eq.${citaId}`, {
        method: "PATCH",
        headers: { ...svc, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify(patchPayload),
      });

      const patchResponseText = await ur.text();
      console.log(`[PATCH] HTTP Status: ${ur.status}`);
      console.log(`[PATCH] Response body: ${patchResponseText}`);

      if (!ur.ok) {
        console.error(`[PATCH-ERROR] Failed to save for cita ${citaId}, status ${ur.status}, body: ${patchResponseText}`);
      } else {
        console.log(`[PATCH-SUCCESS] meet_link=${hangoutLink ? "SAVED" : "EMPTY"}, google_event_id=${eventId ? "SAVED" : "EMPTY"}`);
      }
    } else {
      console.log(`[PATCH-SKIP] No data to save (no hangoutLink, no eventId)`);
    }

    // 5) Enviar email de confirmación (SIEMPRE, con o sin meet_link)
    // Si hay hangoutLink, lo incluye. Si no, dice "el link aparecerá pronto"
    if (email) {
      try {
        await enviarEmailConMeetLink(email, tipo || "Sesión", inicio, modalidad, lugar, hangoutLink);
        console.log(`[EMAIL-SENT] Confirmation email sent to ${email}, hangoutLink=${hangoutLink ? "INCLUDED" : "MISSING"}`);
      } catch (e) {
        console.error(`[EMAIL-ERROR] Failed to send email: ${String(e)}`);
      }
    }

    console.log(`[SYNC-CITA] Returning: ok=true, event_id=${eventId}, hangoutLink=${hangoutLink ? "FOUND" : "MISSING"}`);
    return json({ ok: true, hangoutLink, event_id: eventId });
  } catch (e) {
    console.error("sync-cita-to-gcal error:", e);
    return json({ error: "internal_error", detail: String(e) }, 500);
  }
});

// Formato de fecha legible
function fmtFecha(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]} · ${m[4]}:${m[5]}` : iso;
}

// Enviar email de confirmación con Meet link
async function enviarEmailConMeetLink(to: string, tipo: string, inicio: string, modalidad: string, lugar: string, meetLink: string): Promise<void> {
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
  } catch (e) {
    console.error(`[EMAIL-FETCH-ERROR] ${String(e)}`);
  }
}
