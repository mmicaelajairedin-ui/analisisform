// ===================================================================
// sync-cita-to-gcal — Calcula y guarda el video_url único de una cita
//
// Después de que se crea una cita en Supabase, esta función:
// 1. Obtiene los detalles de la cita
// 2. Lee la configuración del coach (zoom_url si existe)
// 3. Llama a gcal-push para crear evento en Google Calendar
// 4. Calcula video_url con prioridad:
//    - Google Meet (si gcal-push devolvió hangoutLink)
//    - Zoom del coach (si configuró zoom_url)
//    - Sala de Pathway (fallback)
// 5. Guarda video_url en citas.meet_link (única fuente de verdad)
//
// POST body:
//   { cita_id (BIGINT) }
//   → { ok:true, sync: { video_url, video_url_source, ... } } | { ok:false, sync: { reason, ... } }
//
// Env: AUTH_URL, USERS_URL, DATA_URL, SUPABASE_SERVICE_ROLE_KEY
// Deploy: supabase functions deploy sync-cita-to-gcal --no-verify-jwt

// Hybrid architecture configuration (inlined)
const AUTH_URL = Deno.env.get("AUTH_URL");
const USERS_URL = Deno.env.get("USERS_URL");
const DATA_URL = Deno.env.get("DATA_URL");
if (!AUTH_URL) throw new Error("Missing required environment variable: AUTH_URL");
if (!USERS_URL) throw new Error("Missing required environment variable: USERS_URL");
if (!DATA_URL) throw new Error("Missing required environment variable: DATA_URL");
const SB = { AUTH: AUTH_URL, USERS: USERS_URL, DATA: DATA_URL };

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

  // Objeto para rastrear cada paso del flujo
  const trace = {
    called: true,
    ok: false,
    status: null as number | null,
    reason: null as string | null,
    event_id: null as string | null,
    hangoutLink: null as string | null,
    video_url: null as string | null,
    video_url_source: null as string | null,
    patched: false,
    patch_status: null as number | null,
  };

  try {
    console.log(`[SYNC-START] cita_id=${citaId}`);

    // 1) Obtener detalles de la cita
    const cr = await fetch(`${SB.DATA}/rest/v1/citas?id=eq.${citaId}&select=*`, { headers: svc });
    if (!cr.ok) return json({ error: "cita_query_failed" }, 502);
    const citas = await cr.json();
    if (!Array.isArray(citas) || !citas.length) return json({ error: "cita_not_found" }, 404);
    const cita = citas[0];
    const { coach_id, nombre, inicio, modalidad, lugar, email, tipo } = cita;
    if (!coach_id || !inicio) return json({ error: "cita_incomplete" }, 400);

    // 1b) Leer configuración del coach (zoom_url, etc.) desde el proyecto de usuarios
    let coachConfig: any = {};
    try {
      const cfgResp = await fetch(
        `${SB.USERS}/rest/v1/usuarios?id=eq.${encodeURIComponent(coach_id)}&select=configuracion`,
        { headers: svc }
      );
      if (cfgResp.ok) {
        const cfgRows = await cfgResp.json();
        if (Array.isArray(cfgRows) && cfgRows[0] && cfgRows[0].configuracion) {
          coachConfig = cfgRows[0].configuracion;
        }
      }
    } catch (e) {
      console.error(`[SYNC-CITA] Failed to fetch coach config: ${String(e)}`);
    }
    const coachZoomUrl = (coachConfig && coachConfig.zoom_url) ? String(coachConfig.zoom_url).trim() : "";

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

    trace.status = pushResp.status;

    if (!pushResp.ok) {
      const err = await pushResp.json().catch(() => ({}));
      trace.reason = err.reason || `gcal_push_http_${pushResp.status}`;
      console.error(`[SYNC-CITA] gcal-push failed: ${trace.reason}`);

      // Si gcal-push falla por falta de conexión Google, no es error fatal
      if ((err && err.reason === "coach_no_gcal_write") || !coach_id) {
        trace.ok = true;
        trace.reason = "coach_no_gcal_write";
        console.log(`[SYNC-CITA] Google not configured, continuing`);
        return json({ ok: true, sync: trace });
      }

      // Propagar error real
      trace.ok = false;
      return json({ ok: false, sync: trace });
    }

    const pushData = await pushResp.json();
    trace.event_id = pushData.event_id || null;
    trace.hangoutLink = pushData.hangoutLink || null;
    trace.ok = pushData.ok === true;

    console.log(`[SYNC-CITA] gcal-push: event_id=${trace.event_id}, hangoutLink=${trace.hangoutLink}, ok=${trace.ok}`);

    // Calcular video_url con prioridad:
    // 1. Google Meet (si gcal-push devolvió hangoutLink)
    // 2. Zoom URL del coach (si está configurado)
    // 3. Sala de Pathway (fallback)
    const salaPathwayLink = `https://pathwaycareercoach.com/sala.html?room=Pathway-${coach_id}-${new Date(inicio).getTime()}`;
    let video_url: string;
    let video_url_source: string;

    if (trace.hangoutLink) {
      video_url = trace.hangoutLink;
      video_url_source = "google_meet";
    } else if (coachZoomUrl) {
      video_url = coachZoomUrl;
      video_url_source = "coach_zoom";
    } else {
      video_url = salaPathwayLink;
      video_url_source = "pathway_sala";
    }

    trace.video_url = video_url;
    trace.video_url_source = video_url_source;

    console.log(`[SYNC-VIDEO] coach_id=${coach_id} zoom_url=${coachZoomUrl ? "PRESENT" : "MISSING"} google_result=${trace.hangoutLink ? "PRESENT" : "MISSING"} fallback=${video_url_source}`);

    const hangoutLink = trace.hangoutLink || "";
    const eventId = trace.event_id || "";

    // 4) Guardar video_url + google_event_id en UN SOLO PATCH
    // meet_link guarda el video_url final (Google Meet, Zoom del coach, o Sala de Pathway)
    const patchPayload: Record<string, string> = {};
    if (video_url) patchPayload.meet_link = video_url;
    if (eventId) patchPayload.google_event_id = eventId;

    if (Object.keys(patchPayload).length > 0) {
      console.log(`[SYNC-PATCH] cita_id=${citaId} payload=${JSON.stringify(patchPayload)}`);

      const ur = await fetch(`${SB.DATA}/rest/v1/citas?id=eq.${citaId}`, {
        method: "PATCH",
        headers: { ...svc, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify(patchPayload),
      });

      trace.patch_status = ur.status;
      const patchResponseText = await ur.text();

      if (!ur.ok) {
        trace.patched = false;
        console.error(`[SYNC-PATCH-ERROR] HTTP ${ur.status}: ${patchResponseText}`);
      } else {
        trace.patched = true;
        console.log(`[SYNC-PATCH-SUCCESS] HTTP ${ur.status}`);
      }
    } else {
      console.log(`[SYNC-PATCH-SKIP] No data to save (no video_url, no eventId)`);
    }

    // 5) El email se envía desde panel-v2 usando video_url guardado en meet_link
    // Así el panel mantiene control de UX, plantillas y timing del email

    console.log(`[SYNC-CITA] Final: ok=${trace.ok}, event_id=${trace.event_id}, video_url_source=${trace.video_url_source}, video_url=${trace.video_url}, patched=${trace.patched}, patch_status=${trace.patch_status}`);
    return json({ ok: trace.ok && trace.patched, sync: trace });
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

