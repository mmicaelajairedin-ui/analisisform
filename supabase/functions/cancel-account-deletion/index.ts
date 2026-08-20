// ===================================================================
// cancel-account-deletion — permite que un usuario cancele su solicitud
// de eliminación de cuenta dentro del período de 24 horas
//
// POST { usuario_id }  →  { success: true, message } | { success: false, error }
//
// RLS: El usuario solo puede cancelar su propia eliminación
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// Deploy: supabase functions deploy cancel-account-deletion --no-verify-jwt
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
  if (req.method !== "POST") return json({ success: false, error: "post_only" }, 405);
  if (!SB_URL || !SERVICE) return json({ success: false, error: "env_missing" }, 500);

  let body: { usuario_id?: string };
  try { body = await req.json(); } catch { return json({ success: false, error: "bad_json" }, 400); }

  const usuario_id = (body.usuario_id || "").toString().trim();
  if (!usuario_id) return json({ success: false, error: "usuario_id_required" }, 400);

  try {
    // Llamar a la función SQL cancel_account_deletion con service role
    const r = await fetch(
      `${SB_URL}/rest/v1/rpc/cancel_account_deletion`,
      {
        method: "POST",
        headers: { ...svc, "Content-Type": "application/json" },
        body: JSON.stringify({ p_usuario_id: usuario_id }),
      },
    );

    if (!r.ok) {
      const errText = await r.text();
      console.error("cancel_account_deletion error:", r.status, errText);
      return json({ success: false, error: "cancellation_failed", status: r.status }, 502);
    }

    const result = await r.json();

    // La función SQL devuelve JSON con { success, error, message }
    if (result && result.success) {
      return json({
        success: true,
        message: result.message || "Eliminación cancelada. Tu cuenta se mantiene activa.",
      });
    } else {
      return json({ success: false, error: result?.error || "unknown_error" });
    }
  } catch (e) {
    console.error("cancel-account-deletion error:", e);
    return json({ success: false, error: "db_unreachable" }, 502);
  }
});
