// Supabase Edge Function — gcal-connect
//
// Guarda el token de Google Calendar del coach después de que conecta con
// "Conectar Google Calendar". SEGURIDAD: verifica el JWT de Supabase del usuario
// (el que volvió del OAuth de Google) para saber QUIÉN es, y guarda el token
// SOLO en su propia fila (matcheando por su email verificado). Nadie puede
// guardar tokens en la fila de otro.
//
// POST  headers: Authorization: Bearer <user session JWT>, apikey
//       body: { access_token, refresh_token, expiry }
//   → { ok:true, email } | { error }
//
// Deploy: supabase functions deploy gcal-connect --no-verify-jwt

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

  const SB_URL = (Deno.env.get("SUPABASE_URL") || "").replace(/\/+$/, "");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || SERVICE_KEY;
  if (!SB_URL || !SERVICE_KEY) return json({ error: "supabase_env_missing" }, 500);

  // 1) Verificar el JWT del usuario → obtener su email (quién está conectando).
  const auth = req.headers.get("authorization") || "";
  const jwt = auth.replace(/^Bearer\s+/i, "").trim();
  if (!jwt) return json({ error: "no_auth" }, 401);
  let email = "";
  try {
    const ur = await fetch(`${SB_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${jwt}`, apikey: ANON_KEY },
    });
    if (!ur.ok) return json({ error: "invalid_session" }, 401);
    const u = await ur.json();
    email = String(u.email || "").trim().toLowerCase();
    if (!email) return json({ error: "no_email" }, 401);
  } catch (_e) {
    return json({ error: "auth_unreachable" }, 502);
  }

  // 2) Leer el token de Google del body.
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch (_e) { return json({ error: "bad_body" }, 400); }
  const access_token = String(body.access_token || "");
  const refresh_token = String(body.refresh_token || "");
  const expiry = Number(body.expiry || (Date.now() + 3600000));
  if (!access_token) return json({ error: "no_access_token" }, 400);

  const sbHeaders = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` };

  // 3) Buscar la fila del coach por su email verificado y mergear gcal.
  try {
    const r = await fetch(
      `${SB_URL}/rest/v1/usuarios?email=eq.${encodeURIComponent(email)}&select=id,configuracion&limit=1`,
      { headers: sbHeaders },
    );
    const rows = r.ok ? await r.json() : [];
    if (!rows.length) return json({ error: "coach_not_found", email }, 404);
    const id = rows[0].id;
    const cfg = (rows[0].configuracion as Record<string, unknown>) || {};
    const newCfg = { ...cfg, gcal: { access_token, refresh_token, expiry, connected_at: new Date().toISOString() } };
    const pr = await fetch(`${SB_URL}/rest/v1/usuarios?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { ...sbHeaders, "content-type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ configuracion: newCfg }),
    });
    if (!pr.ok) return json({ error: "save_failed", status: pr.status }, 502);
    return json({ ok: true, email });
  } catch (_e) {
    return json({ error: "supabase_unreachable" }, 502);
  }
});
