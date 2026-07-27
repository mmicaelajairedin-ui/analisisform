// ===================================================================
// coach-self-save — deja que un coach guarde SU PROPIA fila de `usuarios`
// (configuración, perfil, gamificación) SIN chocar con el RLS estricto de la
// Fase 5 (usuarios_hardening.sql).
//
// Problema que resuelve: `usuarios_self_update` exige TO authenticated con
//   lower(email) = pw_email()  (el email del JWT de Supabase Auth). Pero si el
//   coach entró con el login viejo, o su sesión de Supabase venció / no quedó
//   linkeada, NO viaja JWT → el PATCH cae a la anon key → RLS lo RECHAZA y el
//   guardado de su config/perfil se perdía EN SILENCIO (observado en
//   client_errors: PATCH /rest/v1/usuarios rechazado para coaches reales).
//
// Esta función corre con SERVICE ROLE (bypassa RLS) y actualiza SOLO la fila del
// coach, con una LISTA BLANCA de campos NO sensibles. Nunca toca password_hash,
// rol, activo ni auth_id → aunque alguien la llame con otro id, no hay takeover
// ni escalada de privilegios (a lo sumo pisar la config de otro, no su cuenta).
//
// Identidad (barrera razonable para campos no privilegiados): hay que conocer el
// `id` (UUID, no público) Y el `email` de la MISMA fila; si no coinciden → 403.
// Solo aplica a filas de rol coach/admin/empleado (no clientes).
//
// POST body: { id, email, fields: { configuracion?, foto_url?, nombre?, slug?,
//              xp?, badges?, game_pts?, game_medal?, disponibilidad? } }
//   → { ok:true }  |  { ok:false, error }
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// Deploy: supabase functions deploy coach-self-save --no-verify-jwt
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
const isUuid = (s: string) => /^[0-9a-f-]{32,36}$/i.test(s);

// Campos que un coach puede guardar de su propia fila. NADA sensible.
const ALLOWED = new Set([
  "configuracion", "foto_url", "nombre", "slug",
  "xp", "badges", "game_pts", "game_medal", "disponibilidad",
]);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "post_only" }, 405);
  if (!SB_URL || !SERVICE) return json({ ok: false, error: "env_missing" }, 500);

  let body: { id?: string; email?: string; fields?: Record<string, unknown> };
  try { body = await req.json(); } catch { return json({ ok: false, error: "bad_json" }, 400); }

  const id = (body.id || "").toString().trim();
  const email = (body.email || "").toString().trim().toLowerCase();
  if (!isUuid(id)) return json({ ok: false, error: "id_invalid" }, 400);
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ ok: false, error: "email_required" }, 400);

  // Solo los campos de la lista blanca. Se ignora todo lo demás (rol, password_hash…).
  const raw = (body.fields && typeof body.fields === "object") ? body.fields : {};
  const patch: Record<string, unknown> = {};
  for (const k of Object.keys(raw)) { if (ALLOWED.has(k)) patch[k] = (raw as Record<string, unknown>)[k]; }
  if (!Object.keys(patch).length) return json({ ok: false, error: "no_allowed_fields" }, 400);

  // La fila tiene que existir, ser coach/admin/empleado, y que el id Y el email
  // coincidan en la MISMA fila (prueba mínima de identidad para campos no sensibles).
  try {
    const r = await fetch(
      `${SB_URL}/rest/v1/usuarios?id=eq.${encodeURIComponent(id)}&select=id,email,rol&limit=1`,
      { headers: svc },
    );
    if (!r.ok) return json({ ok: false, error: "lookup_failed", status: r.status }, 502);
    const rows = await r.json();
    const u = Array.isArray(rows) && rows[0];
    if (!u) return json({ ok: false, error: "not_found" }, 404);
    if ((u.email || "").toString().trim().toLowerCase() !== email) return json({ ok: false, error: "identity_mismatch" }, 403);
    if (!["coach", "admin", "empleado"].includes((u.rol || "").toString())) return json({ ok: false, error: "not_a_coach" }, 403);
  } catch { return json({ ok: false, error: "db_unreachable" }, 502); }

  try {
    const r = await fetch(`${SB_URL}/rest/v1/usuarios?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { ...svc, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify(patch),
    });
    if (!r.ok) { const t = await r.text().catch(() => ""); return json({ ok: false, error: "write_failed", status: r.status, detail: t.slice(0, 200) }, 502); }
    return json({ ok: true, saved: Object.keys(patch) });
  } catch { return json({ ok: false, error: "write_failed" }, 502); }
});
