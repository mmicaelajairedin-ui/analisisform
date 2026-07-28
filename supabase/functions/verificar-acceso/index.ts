// ===================================================================
// verificar-acceso — valida el CÓDIGO DE ACCESO del formulario de intake
// SIN que el navegador tenga que leer la configuración de todos los coaches.
//
// Antes: formulario.html bajaba `configuracion` de TODOS los coaches con la
// anon key y buscaba el que tuviera `access_code === code` en el navegador.
// Eso exponía la config completa (incluido el token de Google Calendar) a
// cualquiera. Ahora la comparación se hace en el servidor (service role) y solo
// devolvemos lo mínimo: si el código es válido y de qué coach es.
//
// POST { code }  →  { ok:true, coach_id, coach_nombre } | { ok:false }
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// Deploy: supabase functions deploy verificar-acceso --no-verify-jwt
// ===================================================================

const SB_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
  Deno.env.get("SERVICE_ROLE_KEY") || "";
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
  if (req.method !== "POST") return json({ ok: false, error: "post_only" }, 405);
  if (!SB_URL || !SERVICE) return json({ ok: false, error: "env_missing" }, 500);

  let body: { code?: string };
  try { body = await req.json(); } catch { return json({ ok: false, error: "bad_json" }, 400); }

  const code = (body.code || "").toString().trim();
  if (!code) return json({ ok: false, error: "code_required" }, 400);

  try {
    // Buscamos SOLO el/los coach cuyo access_code coincide. El filtro va en el
    // servidor (configuracion->>access_code = code) → no bajamos nada de nadie más.
    const r = await fetch(
      `${SB_URL}/rest/v1/usuarios?rol=in.(coach,admin)&configuracion->>access_code=eq.${encodeURIComponent(code)}&select=id,nombre&limit=1`,
      { headers: svc },
    );
    if (!r.ok) return json({ ok: false, error: "lookup_failed", status: r.status }, 502);
    const rows = await r.json();
    const u = Array.isArray(rows) && rows[0];
    if (!u) return json({ ok: false });
    return json({ ok: true, coach_id: u.id, coach_nombre: u.nombre || "" });
  } catch {
    return json({ ok: false, error: "db_unreachable" }, 502);
  }
});
