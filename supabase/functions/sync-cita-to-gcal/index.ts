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
    const { coach_id, nombre, inicio, modalidad, lugar } = cita;
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
    const hangoutLink = pushData.hangoutLink || "";

    // 4) Si hay hangoutLink, guardar en citas.meet_link
    if (hangoutLink) {
      const ur = await fetch(`${SB.DATA}/rest/v1/citas?id=eq.${citaId}`, {
        method: "PATCH",
        headers: { ...svc, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ meet_link: hangoutLink }),
      });
      if (!ur.ok) {
        console.error(`Failed to save meet_link for cita ${citaId}`, ur.status);
        // No es error fatal — el link se generó pero no se guardó en BD
      }
    }

    return json({ ok: true, hangoutLink, event_id: pushData.event_id || "" });
  } catch (e) {
    console.error("sync-cita-to-gcal error:", e);
    return json({ error: "internal_error", detail: String(e) }, 500);
  }
});
