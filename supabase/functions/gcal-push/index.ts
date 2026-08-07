// ===================================================================
// gcal-push — crea / actualiza / borra un evento en el Google Calendar DEL COACH
// cuando hay una reserva en Pathway. Así la cita aparece SOLA en su Google (no
// depende del "Agregar a Google" manual).
//
// El refresh_token del coach vive en usuarios.configuracion.gcal (lo dejó la
// conexión de Google). Se lee del lado SERVIDOR con service role (nunca sale al
// navegador). Requiere que el coach haya conectado Google con permiso de
// ESCRITURA (scope calendar.events) — conectar-calendar.html ya lo pide.
//
// POST body:
//   { coach_id, op?: "create"|"update"|"cancel",
//     event_id?,                              // para update/cancel
//     event: { summary, description?, location?, startISO, endISO, attendeeEmail? } }
//   → create/update: { ok:true, event_id }
//   → cancel:        { ok:true }
//   → sin conexión de escritura: { ok:false, reason:"coach_no_gcal_write" }  (no rompe la reserva)
//
// Env (Secrets): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
// Deploy: se auto-deploya al pushear a main (está en deploy-functions.yml).
// ===================================================================

const SB_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const G_ID = Deno.env.get("GOOGLE_CLIENT_ID") || "";
const G_SEC = Deno.env.get("GOOGLE_CLIENT_SECRET") || "";
const svc = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` };

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}
const isUuid = (s: string) => /^[0-9a-f-]{32,36}$/i.test(s);

// refresh_token del coach → access_token de Google (dura ~1h).
async function accessToken(refresh_token: string): Promise<string | null> {
  try {
    const r = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: G_ID, client_secret: G_SEC, refresh_token, grant_type: "refresh_token" }),
    });
    const d = await r.json();
    if (!r.ok) {
      console.error(`accessToken: OAuth refresh failed status=${r.status}, error=${d.error}, error_description=${d.error_description}`);
      return null;
    }
    if (!d.access_token) {
      console.error(`accessToken: OAuth response ok but no access_token, response keys=${Object.keys(d).join(",")}`);
      return null;
    }
    console.log(`accessToken: successfully got token (expires_in=${d.expires_in}s)`);
    return String(d.access_token);
  } catch (e) {
    console.error(`accessToken: exception: ${String(e)}`);
    return null;
  }
}

Deno.serve(async (req: Request) => {
  console.log(`[GCAL-PUSH START]`);
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "post_only" }, 405);
  if (!SB_URL || !SERVICE || !G_ID || !G_SEC) return json({ error: "env_missing" }, 500);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "bad_json" }, 400); }

  const coachId = String(body.coach_id || "").trim();
  const op = String(body.op || "create");
  const eventId = String(body.event_id || "").trim();
  const ev = (body.event && typeof body.event === "object") ? body.event as Record<string, unknown> : {};
  if (!isUuid(coachId)) return json({ error: "coach_id_invalid" }, 400);

  // 1) Token del coach desde la CAJA FUERTE (gcal_tokens, service role).
  // El token es un objeto JSONB con { refresh_token, access_token?, ... }
  let refresh = "";
  try {
    const tr = await fetch(`${SB_URL}/rest/v1/gcal_tokens?coach_id=eq.${encodeURIComponent(coachId)}&select=token&limit=1`, { headers: svc });
    if (tr.ok) {
      const trows = await tr.json();
      if (Array.isArray(trows) && trows[0] && trows[0].token) {
        const tokenObj = trows[0].token;
        refresh = String((tokenObj && tokenObj.refresh_token) || "");
      }
    }
  } catch (e) {
    console.error("Failed to fetch gcal token:", e);
    return json({ error: "db_unreachable" }, 502);
  }
  // Sin conexión de escritura: NO es un error fatal — la reserva ya se guardó en
  // Pathway; solo no se replica a Google. El caller lo ignora.
  if (!refresh) {
    console.warn(`No Google Calendar token found for coach ${coachId}`);
    return json({ ok: false, reason: "coach_no_gcal_write" });
  }

  const at = await accessToken(refresh);
  if (!at) {
    console.error(`gcal-push: accessToken() returned null for coach ${coachId}`);
    return json({ ok: false, reason: "token_failed" });
  }
  console.log(`gcal-push: got access token for coach ${coachId}, op=${op}`);
  const auth = { Authorization: `Bearer ${at}`, "Content-Type": "application/json" };
  const base = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

  // 2) cancel → borrar el evento
  if (op === "cancel") {
    if (!eventId) return json({ ok: false, reason: "no_event_id" });
    try {
      const r = await fetch(`${base}/${encodeURIComponent(eventId)}`, { method: "DELETE", headers: auth });
      return json({ ok: r.ok || r.status === 410 }); // 410 = ya no existe
    } catch { return json({ ok: false, reason: "google_unreachable" }); }
  }

  // 3) create / update → armar el evento
  const startISO = String(ev.startISO || "");
  const endISO = String(ev.endISO || "");
  if (!startISO || !endISO) return json({ ok: false, reason: "no_dates" });
  const requestId = `pathway-${crypto.randomUUID()}`;
  const gev: Record<string, unknown> = {
    summary: String(ev.summary || "Sesión · Pathway"),
    description: String(ev.description || ""),
    location: String(ev.location || ""),
    start: { dateTime: startISO },
    end: { dateTime: endISO },
    conferenceData: {
      createRequest: {
        requestId,
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    },
    conferenceDataVersion: 1,
  };
  const att = String(ev.attendeeEmail || "").trim();
  if (att) gev.attendees = [{ email: att }];

  try {
    const url = (op === "update" && eventId) ? `${base}/${encodeURIComponent(eventId)}` : base;
    const method = (op === "update" && eventId) ? "PATCH" : "POST";
    const eventIdShort = eventId ? eventId.substring(eventId.length - 8) : "new";

    // Log request body (sanitized, no tokens)
    const bodyStr = JSON.stringify(gev);
    console.log(`[REQUEST] method=${method}, op=${op}, eventIdShort=${eventIdShort}`);
    console.log(`[REQUEST] conferenceData present: ${!!gev.conferenceData}`);
    if (gev.conferenceData) {
      console.log(`[REQUEST] conferenceData.createRequest present: ${!!(gev.conferenceData as any).createRequest}`);
      console.log(`[REQUEST] conferenceDataVersion: ${gev.conferenceDataVersion}`);
    }

    const r = await fetch(url, {
      method,
      headers: auth,
      body: bodyStr,
    });

    const d = await r.json().catch(() => ({}));

    // Log response metadata
    console.log(`[RESPONSE] HTTP status: ${r.status}, ok: ${r.ok}`);

    if (!r.ok) {
      console.error(`[ERROR] Google returned ${r.status}`);
      console.error(`[ERROR] error.code: ${d.error?.code || "N/A"}`);
      console.error(`[ERROR] error.message: ${d.error?.message || "N/A"}`);
      console.error(`[ERROR] error.errors: ${JSON.stringify(d.error?.errors || [])}`);
      return json({ ok: false, reason: "write_failed", status: r.status, detail: (d && d.error && d.error.message) || "" });
    }

    // Success response
    console.log(`[RESPONSE] event id: ${d.id ? d.id.substring(d.id.length - 8) : "MISSING"}`);
    console.log(`[RESPONSE] conferenceData present: ${!!d.conferenceData}`);

    if (d.conferenceData) {
      console.log(`[RESPONSE] conferenceData.entryPoints count: ${Array.isArray(d.conferenceData.entryPoints) ? d.conferenceData.entryPoints.length : "N/A"}`);
      if (Array.isArray(d.conferenceData.entryPoints) && d.conferenceData.entryPoints.length > 0) {
        const videoEp = d.conferenceData.entryPoints.find((ep: any) => ep.entryPointType === "video");
        if (videoEp?.uri) {
          console.log(`[RESPONSE] video entryPoint found: ${videoEp.uri.substring(0, 50)}...`);
        }
      }
    } else {
      console.log(`[RESPONSE] conferenceData: MISSING (event created without Meet)`);
    }

    // Extract Google Meet link
    let hangoutLink = "";
    if (d.conferenceData && Array.isArray(d.conferenceData.entryPoints)) {
      for (const ep of d.conferenceData.entryPoints) {
        if (ep.entryPointType === "video" && ep.uri) {
          hangoutLink = ep.uri;
          break;
        }
      }
    }

    console.log(`[FINAL] status=success, event_id_short=${d.id ? d.id.substring(d.id.length - 8) : "new"}, hangoutLink=${hangoutLink ? "FOUND" : "NOT_FOUND"}`);
    console.log(`[GCAL-PUSH END] returning ok=true`);
    return json({ ok: true, event_id: d.id || eventId, hangoutLink });
  } catch (e) {
    console.error(`[EXCEPTION] ${String(e)}`);
    console.log(`[GCAL-PUSH END] returning error: google_unreachable`);
    return json({ ok: false, reason: "google_unreachable" });
  }
});
