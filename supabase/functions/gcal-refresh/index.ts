// Supabase Edge Function — gcal-refresh
//
// Renueva el access_token de Google Calendar usando el refresh_token del coach.
// Así la conexión NO se cae cada 1 hora (los access_token de Google duran ~1h).
// El refresh se hace del lado del servidor porque necesita el CLIENT_SECRET, que
// nunca puede estar en el navegador.
//
// POST  body: { refresh_token }
//   → { access_token, expiry } | { error }
//
// Secrets requeridos (Supabase → Edge Functions → Secrets):
//   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET  (los saca del OAuth Client en Google Cloud)
//
// Deploy: supabase functions deploy gcal-refresh --no-verify-jwt

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, authorization, apikey, x-client-info",
};
function json(d: unknown, s = 200): Response {
  return new Response(JSON.stringify(d), { status: s, headers: { ...CORS, "content-type": "application/json; charset=utf-8" } });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const CID = Deno.env.get("GOOGLE_CLIENT_ID") || "";
  const SEC = Deno.env.get("GOOGLE_CLIENT_SECRET") || "";
  if (!CID || !SEC) return json({ error: "google_env_missing" }, 500);

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch (_e) { return json({ error: "bad_body" }, 400); }
  const refresh_token = String(body.refresh_token || "");
  if (!refresh_token) return json({ error: "no_refresh_token" }, 400);

  try {
    const r = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: CID,
        client_secret: SEC,
        refresh_token,
        grant_type: "refresh_token",
      }),
    });
    const d = await r.json();
    if (!r.ok || !d.access_token) return json({ error: "refresh_failed", detail: (d && d.error) || "" }, 502);
    return json({ access_token: d.access_token, expiry: Date.now() + ((Number(d.expires_in) || 3600) * 1000) });
  } catch (_e) {
    return json({ error: "google_unreachable" }, 502);
  }
});
