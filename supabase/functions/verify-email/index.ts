// ===================================================================
// verify-email — confirma el email del coach validando el token EN EL SERVIDOR.
//
// Antes: verify.html leía `configuracion` del usuario con la anon key y comparaba
// `configuracion.verification_token` en el navegador. Eso significaba que el token
// de verificación (y toda la config) era LEGIBLE por cualquiera con la anon key —
// alguien podía leer el token de otro y confirmarle el email. Ahora la validación
// y la actualización ocurren server-side (service role); el navegador nunca ve el
// token ni la config.
//
// POST { email, token }
//   → { ok:true, status:'verified'|'already', nombre } | { ok:false, error }
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// Deploy: supabase functions deploy verify-email --no-verify-jwt
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

  let body: { email?: string; token?: string };
  try { body = await req.json(); } catch { return json({ ok: false, error: "bad_json" }, 400); }

  const email = (body.email || "").toString().trim().toLowerCase();
  const token = (body.token || "").toString().trim();
  if (!email || !token) return json({ ok: false, error: "missing_params" }, 400);

  try {
    const r = await fetch(
      `${SB_URL}/rest/v1/usuarios?email=eq.${encodeURIComponent(email)}&select=id,nombre,configuracion&limit=1`,
      { headers: svc },
    );
    if (!r.ok) return json({ ok: false, error: "lookup_failed", status: r.status }, 502);
    const rows = await r.json();
    const u = Array.isArray(rows) && rows[0];
    if (!u) return json({ ok: false, error: "not_found" }, 404);

    const cfg = (u.configuracion && typeof u.configuracion === "object") ? u.configuracion as Record<string, unknown> : {};

    // Ya confirmado → idempotente (el link se pudo clickear dos veces).
    if (cfg.email_verificado === true) return json({ ok: true, status: "already", nombre: u.nombre || "" });

    // Token equivocado o ausente → no confirmamos.
    if (!cfg.verification_token || cfg.verification_token !== token) {
      return json({ ok: false, error: "bad_token" }, 403);
    }

    // Token OK → marcar verificado y quemar el token (no se reusa).
    const merged: Record<string, unknown> = {};
    for (const k of Object.keys(cfg)) merged[k] = cfg[k];
    merged.email_verificado = true;
    merged.verification_verified_at = new Date().toISOString();
    delete merged.verification_token;

    const up = await fetch(`${SB_URL}/rest/v1/usuarios?id=eq.${encodeURIComponent(String(u.id))}`, {
      method: "PATCH",
      headers: { ...svc, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ configuracion: merged }),
    });
    if (!up.ok) return json({ ok: false, error: "update_failed", status: up.status }, 502);
    return json({ ok: true, status: "verified", nombre: u.nombre || "" });
  } catch {
    return json({ ok: false, error: "db_unreachable" }, 502);
  }
});
