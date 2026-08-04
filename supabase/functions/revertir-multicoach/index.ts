// ===================================================================
// revertir-multicoach — convierte un OWNER (multicoach) de vuelta a COACH.
// Admin-gated (service role). Cambia rol='owner' → 'coach', mantiene sus
// clientes en su org actual (no se pierden), pero pierde la capacidad de
// gestionar la red (solo tiene acceso como coach en su panel-v2).
//
// Body:   { owner_id }
// Header: Authorization: Bearer <JWT del admin>
// Resp:   { ok, nombre, clientes_preservados } | { error }
//
// Deploy: supabase functions deploy revertir-multicoach --no-verify-jwt
// ===================================================================

const SB_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const ANON = Deno.env.get("SUPABASE_ANON_KEY") || "";
const svc = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` };

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

async function callerIdentity(token: string): Promise<{ id: string; email: string } | null> {
  if (!token || token === ANON) return null;
  try {
    const r = await fetch(`${SB_URL}/auth/v1/user`, { headers: { apikey: ANON, Authorization: `Bearer ${token}` } });
    if (!r.ok) return null;
    const u = await r.json();
    const id = (u && u.id) ? String(u.id) : "";
    const em = (u && u.email ? String(u.email) : "").trim().toLowerCase();
    if (!id && !EMAIL_RE.test(em)) return null;
    return { id, email: EMAIL_RE.test(em) ? em : "" };
  } catch { return null; }
}

async function isAdmin(id: string, email: string): Promise<boolean> {
  const ors: string[] = [];
  if (id) ors.push(`auth_id.eq.${encodeURIComponent(id)}`);
  if (email) ors.push(`email.ilike.${encodeURIComponent(email)}`);
  if (!ors.length) return false;
  try {
    const r = await fetch(`${SB_URL}/rest/v1/usuarios?or=(${ors.join(",")})&rol=eq.admin&select=id&limit=1`, { headers: svc });
    if (!r.ok) return false;
    const rows = await r.json();
    return Array.isArray(rows) && rows.length > 0;
  } catch { return false; }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "post_only" }, 405);
  if (!SB_URL || !SERVICE || !ANON) return json({ error: "env_missing" }, 500);

  const auth = req.headers.get("Authorization") || req.headers.get("authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  const who = await callerIdentity(token);
  if (!who) return json({ error: "no_session" }, 403);
  if (!(await isAdmin(who.id, who.email))) return json({ error: "not_admin", email: who.email }, 403);

  let body: { owner_id?: string };
  try { body = await req.json(); } catch { return json({ error: "bad_json" }, 400); }
  const owner_id = (body.owner_id || "").toString().trim();
  if (!owner_id) return json({ error: "missing_id" }, 400);

  // El owner a revertir
  let owner: { id: string; email: string; nombre: string | null; rol: string; org_id: string | null; configuracion: Record<string, unknown> | null } | null = null;
  try {
    const r = await fetch(`${SB_URL}/rest/v1/usuarios?id=eq.${encodeURIComponent(owner_id)}&select=id,email,nombre,rol,org_id,configuracion&limit=1`, { headers: svc });
    if (!r.ok) return json({ error: "lookup_failed", status: r.status }, 502);
    const rows = await r.json();
    owner = (Array.isArray(rows) && rows[0]) || null;
  } catch { return json({ error: "db_unreachable" }, 502); }

  if (!owner) return json({ error: "usuario_no_existe" }, 404);
  if (owner.rol !== "owner") return json({ error: "no_es_owner", rol: owner.rol }, 409);

  // Contar clientes actuales (para confirmar que se preservarán)
  let clientCount = 0;
  try {
    const r = await fetch(`${SB_URL}/rest/v1/candidatos?coach_id=eq.${encodeURIComponent(owner_id)}&select=id`, { headers: svc });
    if (r.ok) {
      const rows = await r.json();
      clientCount = Array.isArray(rows) ? rows.length : 0;
    }
  } catch { /* ignore */ }

  // Revertir: cambiar rol a 'coach' y limpiar datos de multicoach
  const cfg = (owner.configuracion && typeof owner.configuracion === "object") ? owner.configuracion as Record<string, unknown> : {};
  const nc = { ...cfg, es_multicoach: false };
  delete (nc as Record<string, unknown>).plan;
  delete (nc as Record<string, unknown>).estado_sub;
  delete (nc as Record<string, unknown>).fecha_fin_prueba;
  delete (nc as Record<string, unknown>).convertido_por;

  try {
    const r = await fetch(`${SB_URL}/rest/v1/usuarios?id=eq.${encodeURIComponent(owner_id)}`, {
      method: "PATCH",
      headers: { ...svc, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ rol: "coach", configuracion: nc }),
    });
    if (!r.ok) return json({ error: "revert_failed", status: r.status }, 502);
  } catch { return json({ error: "revert_failed" }, 502); }

  return json({ ok: true, nombre: owner.nombre || owner.email, clientes_preservados: clientCount });
});
