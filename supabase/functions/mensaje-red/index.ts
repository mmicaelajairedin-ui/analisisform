// ===================================================================
// mensaje-red — chat dueño↔coach de una red. Service role + gate por identidad.
// Puede llamar EL DUEÑO de la org del coach (from_owner=true) o EL PROPIO coach
// (from_owner=false). Nadie más.
//
// Body:   { action:'send'|'thread', coach_id, texto? }
// Header: Authorization: Bearer <JWT del dueño o del coach>
// Resp:   send   → { ok, id }
//         thread → { ok, mensajes:[{id,from_owner,body,created_at,leido_en}] }
//
// Deploy: supabase functions deploy mensaje-red --no-verify-jwt
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

async function q(path: string): Promise<any[]> {
  try { const r = await fetch(`${SB_URL}/rest/v1/${path}`, { headers: svc }); if (!r.ok) return []; const rows = await r.json(); return Array.isArray(rows) ? rows : []; } catch { return []; }
}

// La ficha usuarios del que llama, por auth_id (link estable) O email.
async function callerRow(token: string): Promise<{ id: string; rol: string; org_id: string | null } | null> {
  if (!token || token === ANON) return null;
  try {
    const r = await fetch(`${SB_URL}/auth/v1/user`, { headers: { apikey: ANON, Authorization: `Bearer ${token}` } });
    if (!r.ok) return null;
    const u = await r.json();
    const id = (u && u.id) ? String(u.id) : "";
    const em = (u && u.email ? String(u.email) : "").trim().toLowerCase();
    const ors: string[] = [];
    if (id) ors.push(`auth_id.eq.${encodeURIComponent(id)}`);
    if (EMAIL_RE.test(em)) ors.push(`email.ilike.${encodeURIComponent(em)}`);
    if (!ors.length) return null;
    const rows = await q(`usuarios?or=(${ors.join(",")})&select=id,rol,org_id&limit=1`);
    return rows[0] || null;
  } catch { return null; }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "post_only" }, 405);
  if (!SB_URL || !SERVICE || !ANON) return json({ error: "env_missing" }, 500);

  const auth = req.headers.get("Authorization") || req.headers.get("authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  const caller = await callerRow(token);
  if (!caller) return json({ error: "no_session" }, 403);

  let body: { action?: string; coach_id?: string; texto?: string };
  try { body = await req.json(); } catch { return json({ error: "bad_json" }, 400); }
  const action = (body.action || "").toString();
  const coach_id = (body.coach_id || "").toString().trim();
  if (!coach_id) return json({ error: "missing_coach" }, 400);

  // El coach del hilo (para saber su org).
  const coach = (await q(`usuarios?id=eq.${encodeURIComponent(coach_id)}&select=id,org_id,rol&limit=1`))[0];
  if (!coach) return json({ error: "coach_no_existe" }, 404);
  const orgId = coach.org_id;
  if (!orgId) return json({ error: "coach_sin_red" }, 409);

  // Relación: dueño de esa red, o el propio coach.
  const isOwner = caller.rol === "owner" && caller.org_id && String(caller.org_id) === String(orgId);
  const isSelf = String(caller.id) === String(coach_id);
  if (!isOwner && !isSelf) return json({ error: "sin_permiso" }, 403);

  if (action === "send") {
    const texto = (body.texto || "").toString().trim();
    if (!texto) return json({ error: "texto_vacio" }, 400);
    try {
      const r = await fetch(`${SB_URL}/rest/v1/mensajes_owner_coach`, {
        method: "POST", headers: { ...svc, "Content-Type": "application/json", Prefer: "return=representation" },
        body: JSON.stringify({ org_id: orgId, coach_id, from_owner: isOwner, body: texto }),
      });
      if (!r.ok) return json({ error: "insert_failed", status: r.status }, 502);
      const rows = await r.json();
      return json({ ok: true, id: (Array.isArray(rows) && rows[0] && rows[0].id) || null });
    } catch { return json({ error: "write_failed" }, 502); }
  }

  // thread: traer el hilo + marcar leídos los del OTRO lado.
  const mensajes = await q(`mensajes_owner_coach?org_id=eq.${encodeURIComponent(orgId)}&coach_id=eq.${encodeURIComponent(coach_id)}&select=id,from_owner,body,created_at,leido_en&order=created_at.asc`);
  try {
    // Si lee el dueño → marca leídos los del coach (from_owner=false). Si lee el coach → los del dueño.
    const otherFrom = isOwner ? "false" : "true";
    await fetch(`${SB_URL}/rest/v1/mensajes_owner_coach?org_id=eq.${encodeURIComponent(orgId)}&coach_id=eq.${encodeURIComponent(coach_id)}&from_owner=eq.${otherFrom}&leido_en=is.null`, {
      method: "PATCH", headers: { ...svc, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ leido_en: new Date().toISOString() }),
    });
  } catch { /* leer igual funciona */ }
  return json({ ok: true, mensajes });
});
