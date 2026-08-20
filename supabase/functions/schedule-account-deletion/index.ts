// ===================================================================
// schedule-account-deletion — permite que un usuario solicite la eliminación
// de su propia cuenta con un cooldown de 24 horas para cancelar
//
// POST { usuario_id }  →  { success: true, scheduled_at, delete_at, message } | { success: false, error }
//
// RLS: El usuario solo puede solicitar la eliminación de su propia cuenta
// (verificado en el SQL con auth.uid())
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// Deploy: supabase functions deploy schedule-account-deletion --no-verify-jwt
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
    // Llamar a la función SQL schedule_account_deletion con service role
    // La función valida que el usuario coincida con auth.uid()
    const r = await fetch(
      `${SB_URL}/rest/v1/rpc/schedule_account_deletion`,
      {
        method: "POST",
        headers: { ...svc, "Content-Type": "application/json" },
        body: JSON.stringify({ p_usuario_id: usuario_id }),
      },
    );

    if (!r.ok) {
      const errText = await r.text();
      console.error("schedule_account_deletion error:", r.status, errText);
      return json({ success: false, error: "deletion_failed", status: r.status }, 502);
    }

    const result = await r.json();

    // La función SQL devuelve JSON con { success, error, scheduled_at, delete_at, message }
    if (result && result.success) {
      return json({
        success: true,
        scheduled_at: result.scheduled_at,
        delete_at: result.delete_at,
        message: result.message || "Tu cuenta será eliminada en 24 horas.",
      });
    } else {
      return json({ success: false, error: result?.error || "unknown_error" });
    }
  } catch (e) {
    console.error("schedule-account-deletion error:", e);
    return json({ success: false, error: "db_unreachable" }, 502);
  }
});
