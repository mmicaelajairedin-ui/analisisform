// Supabase Edge Function — gcal
//
// Lee el Google Calendar del coach usando su TOKEN OAuth (el que se guarda al
// conectar con "Continuar con Google", con el permiso de Calendar). Devuelve los
// próximos eventos en el MISMO formato que la function `calendar`, para que la
// agenda del panel funcione sin cambios (solo cambia de dónde saca los datos:
// de la API de Google en vez del iCal — sin links).
//
// Token guardado en usuarios.configuracion.gcal = {
//   access_token, refresh_token, expiry (ms epoch)
// }
// Si el access_token venció, se refresca con el refresh_token (offline access).
//
// Secrets (Supabase → Edge Functions → Secrets):
//   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET  (el mismo OAuth client del login)
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (auto-inyectadas)
//
// Deploy: supabase functions deploy gcal --no-verify-jwt
//
// Uso desde el panel:
//   fetch(SB+'/functions/v1/gcal?email='+encodeURIComponent(email), {headers:{apikey,Authorization}})
//   → { events:[{title,start,end,location}], count } | { events:[], unconfigured:true }

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, authorization, apikey, x-client-info",
};
const DAYS_AHEAD = 14;
const MAX_EVENTS = 30;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, "content-type": "application/json; charset=utf-8" },
  });
}

// Refresca el access_token con el refresh_token (Google OAuth offline).
async function refreshAccessToken(refreshToken: string): Promise<{ token: string; expiry: number } | null> {
  const CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID") || "";
  const CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET") || "";
  if (!CLIENT_ID || !CLIENT_SECRET || !refreshToken) return null;
  try {
    const r = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });
    if (!r.ok) return null;
    const d = await r.json();
    if (!d.access_token) return null;
    return { token: d.access_token, expiry: Date.now() + ((d.expires_in || 3600) * 1000) };
  } catch (_e) {
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "GET") return json({ error: "GET only" }, 405);

  const url = new URL(req.url);
  const email = (url.searchParams.get("email") || "").trim().toLowerCase();
  if (!email || !email.includes("@")) return json({ error: "invalid_email" }, 400);

  const SB_URL = (Deno.env.get("SUPABASE_URL") || "").replace(/\/+$/, "");
  const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || "";
  if (!SB_URL || !SB_KEY) return json({ error: "supabase_env_missing" }, 500);
  const sbHeaders = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` };

  // 1) Traer el coach y su token de Google guardado.
  let cfg: Record<string, unknown> = {};
  let coachId = "";
  try {
    const r = await fetch(
      `${SB_URL}/rest/v1/usuarios?email=eq.${encodeURIComponent(email)}&select=id,configuracion&limit=1`,
      { headers: sbHeaders },
    );
    if (!r.ok) return json({ error: "supabase_error", status: r.status }, 502);
    const rows = await r.json();
    if (!rows.length) return json({ error: "coach_not_found" }, 404);
    coachId = String(rows[0].id || "");
    cfg = (rows[0].configuracion as Record<string, unknown>) || {};
  } catch (_e) {
    return json({ error: "supabase_unreachable" }, 502);
  }

  const gcal = (cfg.gcal as { access_token?: string; refresh_token?: string; expiry?: number }) || {};
  if (!gcal.access_token && !gcal.refresh_token) {
    return json({ events: [], unconfigured: true });
  }

  // 2) Access token vigente (refrescar si venció y guardar el nuevo).
  let accessToken = gcal.access_token || "";
  const expiry = Number(gcal.expiry || 0);
  if (!accessToken || Date.now() > expiry - 60000) {
    const refreshed = gcal.refresh_token ? await refreshAccessToken(gcal.refresh_token) : null;
    if (!refreshed) return json({ error: "token_refresh_failed", events: [] });
    accessToken = refreshed.token;
    // Persistir el token nuevo (best-effort) para no refrescar en cada llamada.
    try {
      const newGcal = { ...gcal, access_token: refreshed.token, expiry: refreshed.expiry };
      await fetch(`${SB_URL}/rest/v1/usuarios?id=eq.${encodeURIComponent(coachId)}`, {
        method: "PATCH",
        headers: { ...sbHeaders, "content-type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ configuracion: { ...cfg, gcal: newGcal } }),
      });
    } catch (_e) { /* no romper por el guardado */ }
  }

  // 3) Leer los próximos eventos del calendario primario.
  try {
    const now = new Date();
    const timeMin = now.toISOString();
    const timeMax = new Date(now.getTime() + DAYS_AHEAD * 86400000).toISOString();
    const q = new URLSearchParams({
      timeMin, timeMax,
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: String(MAX_EVENTS),
    });
    const r = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?${q.toString()}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (r.status === 401) return json({ error: "token_invalid", events: [] });
    if (!r.ok) return json({ error: "gcal_fetch_failed", status: r.status, events: [] });
    const data = await r.json();
    const items = Array.isArray(data.items) ? data.items : [];
    const events = items
      .map((e: Record<string, any>) => {
        const s = e.start && (e.start.dateTime || e.start.date);
        const en = e.end && (e.end.dateTime || e.end.date);
        if (!s) return null;
        return {
          title: e.summary || "Sesión",
          start: +new Date(s),
          end: en ? +new Date(en) : null,
          location: e.hangoutLink || e.location || null,
        };
      })
      .filter((e: unknown) => !!e);
    return json({ events, count: events.length });
  } catch (_e) {
    return json({ error: "gcal_unreachable", events: [] });
  }
});
