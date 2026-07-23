// ===================================================================
// canal-red — CANAL DE EQUIPO de una red (multicoach). Un hilo grupal por org:
// el dueño y TODOS sus coaches escriben/leen en el mismo lugar. Service role +
// gate por identidad: solo el dueño de esa org O un coach de esa org.
//
// Body:   { action:'thread'|'send', org_id, texto? }
// Header: Authorization: Bearer <JWT del dueño o de un coach de la red>
// Resp:   send   → { ok, id }
//         thread → { ok, mensajes:[{id,autor_id,autor_nombre,autor_rol,body,created_at}] }
//
// Deploy: supabase functions deploy canal-red --no-verify-jwt
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
async function callerRow(token: string): Promise<{ id: string; nombre: string; rol: string; org_id: string | null } | null> {
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
    const rows = await q(`usuarios?or=(${ors.join(",")})&select=id,nombre,rol,org_id&limit=1`);
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

  let body: { action?: string; org_id?: string; texto?: string };
  try { body = await req.json(); } catch { return json({ error: "bad_json" }, 400); }
  const action = (body.action || "").toString();
  const orgId = (body.org_id || "").toString().trim();
  if (!orgId) return json({ error: "missing_org" }, 400);

  // Gate: el que llama tiene que ser miembro de ESA red (dueño o coach con ese org_id).
  const esMiembro = caller.org_id && String(caller.org_id) === String(orgId) &&
    (caller.rol === "owner" || caller.rol === "coach");
  if (!esMiembro) return json({ error: "sin_permiso" }, 403);

  if (action === "send") {
    const texto = (body.texto || "").toString().trim();
    if (!texto) return json({ error: "texto_vacio" }, 400);
    try {
      const r = await fetch(`${SB_URL}/rest/v1/mensajes_red_canal`, {
        method: "POST", headers: { ...svc, "Content-Type": "application/json", Prefer: "return=representation" },
        body: JSON.stringify({ org_id: orgId, autor_id: caller.id, autor_nombre: caller.nombre || "", autor_rol: caller.rol, body: texto }),
      });
      if (!r.ok) return json({ error: "insert_failed", status: r.status }, 502);
      const rows = await r.json();
      return json({ ok: true, id: (Array.isArray(rows) && rows[0] && rows[0].id) || null });
    } catch { return json({ error: "write_failed" }, 502); }
  }

  // thread: todo el canal de esa org, del más viejo al más nuevo.
  const mensajes = await q(`mensajes_red_canal?org_id=eq.${encodeURIComponent(orgId)}&select=id,autor_id,autor_nombre,autor_rol,body,created_at&order=created_at.asc&limit=500`);
  return json({ ok: true, mensajes });
});
