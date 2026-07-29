// ===================================================================
// comunidad-red — la REVISTA / novedades de una red (multicoach). El DUEÑO
// publica; sus coaches y clientes la leen en su portal. Service role + gate por
// identidad para que nadie vea/publique en una red ajena.
//
// Body:
//   { action:'publish', titulo?, body, foto?, emo?, para? }   → owner (por JWT)
//   { action:'list', org_id? }                                → owner/coach (JWT)
//   { action:'list', email }                                  → cliente (por email)
//   { action:'react', post_id, emoji }                        → cualquier miembro
//
// Header: Authorization: Bearer <JWT> (publish/list-staff/react). Para el cliente
//         se puede listar por { email } sin JWT (mismo criterio que agenda-red-cliente).
//
// Resp:   publish → { ok, post }
//         list    → { ok, org_id, posts:[...] }
//         react   → { ok, reacts }
//
// Deploy: supabase functions deploy comunidad-red --no-verify-jwt
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
  try { const r = await fetch(`${SB_URL}/rest/v1/${path}`, { headers: svc }); if (!r.ok) return []; const rows = await r.json(); return Array.isArray(rows) ? rows : []; }
  catch { return []; }
}
// La ficha usuarios del que llama (owner/coach), por auth_id (link estable) O email.
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
// La org del cliente (por su email en candidatos).
async function clienteOrg(email: string): Promise<string | null> {
  const cli = await q(`candidatos?email=eq.${encodeURIComponent(email)}&select=org_id&limit=5`);
  return (cli.find((c) => c && c.org_id) || {}).org_id || null;
}

const PUB_SELECT = "id,autor_nombre,titulo,body,foto,emo,para,reacts,created_at";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "post_only" }, 405);
  if (!SB_URL || !SERVICE || !ANON) return json({ error: "env_missing" }, 500);

  const auth = req.headers.get("Authorization") || req.headers.get("authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();

  let body: { action?: string; org_id?: string; email?: string; titulo?: string; body?: string; foto?: string; emo?: string; para?: string; post_id?: string; emoji?: string };
  try { body = await req.json(); } catch { return json({ error: "bad_json" }, 400); }
  const action = (body.action || "list").toString();

  // ---- PUBLISH: solo el DUEÑO de la red ----
  if (action === "publish") {
    const caller = await callerRow(token);
    if (!caller || caller.rol !== "owner" || !caller.org_id) return json({ error: "solo_owner" }, 403);
    const txt = (body.body || "").toString().trim();
    const titulo = (body.titulo || "").toString().trim().slice(0, 160);
    if (!txt && !titulo) return json({ error: "vacio" }, 400);
    const para = ["todos", "clientes", "coaches"].includes(String(body.para)) ? String(body.para) : "todos";
    // La foto NO se trunca: cortar un data: URL a la mitad lo corrompe (imagen
    // rota). Si viene enorme (no comprimida), se descarta y el post queda sin
    // foto en vez de con una imagen rota. El cliente ya la comprime (~200KB).
    const fotoRaw = (body.foto || "").toString();
    const foto = (fotoRaw && fotoRaw.length <= 1_800_000) ? fotoRaw : null;
    const row: Record<string, unknown> = {
      org_id: caller.org_id, autor_id: caller.id, autor_nombre: caller.nombre || "",
      titulo: titulo || null, body: txt.slice(0, 4000), foto,
      emo: (body.emo || "📸").toString().slice(0, 8), para, reacts: {},
    };
    try {
      const r = await fetch(`${SB_URL}/rest/v1/posts_red`, {
        method: "POST", headers: { ...svc, "Content-Type": "application/json", Prefer: "return=representation" },
        body: JSON.stringify(row),
      });
      if (!r.ok) return json({ error: "insert_failed", status: r.status }, 502);
      const rows = await r.json();
      return json({ ok: true, post: (Array.isArray(rows) ? rows[0] : rows) || null });
    } catch { return json({ error: "write_failed" }, 502); }
  }

  // ---- REACT: cualquier miembro de la red incrementa un contador (best-effort) ----
  if (action === "react") {
    const postId = (body.post_id || "").toString().trim();
    const emoji = (body.emoji || "").toString().trim().slice(0, 8);
    if (!postId || !emoji) return json({ error: "faltan_datos" }, 400);
    // Verificamos que el post exista y que el que llama pertenezca a esa org.
    const rows = await q(`posts_red?id=eq.${encodeURIComponent(postId)}&select=org_id,reacts&limit=1`);
    if (!rows.length) return json({ error: "post_no_existe" }, 404);
    const orgId = String(rows[0].org_id || "");
    const caller = await callerRow(token);
    const clientOrg = !caller && EMAIL_RE.test(String(body.email || "").toLowerCase())
      ? await clienteOrg(String(body.email).toLowerCase()) : null;
    const memberOrg = caller ? String(caller.org_id || "") : (clientOrg || "");
    if (!memberOrg || memberOrg !== orgId) return json({ error: "sin_permiso" }, 403);
    const reacts = (rows[0].reacts && typeof rows[0].reacts === "object") ? rows[0].reacts as Record<string, number> : {};
    reacts[emoji] = (Number(reacts[emoji]) || 0) + 1;
    try {
      const r = await fetch(`${SB_URL}/rest/v1/posts_red?id=eq.${encodeURIComponent(postId)}`, {
        method: "PATCH", headers: { ...svc, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ reacts }),
      });
      if (!r.ok) return json({ error: "react_failed", status: r.status }, 502);
    } catch { return json({ error: "react_failed" }, 502); }
    return json({ ok: true, reacts });
  }

  // ---- LIST: owner/coach (por JWT) ven todo; cliente (por email) solo todos+clientes ----
  const caller = await callerRow(token);
  let orgId = "";
  let esStaff = false;
  if (caller && (caller.rol === "owner" || caller.rol === "coach") && caller.org_id) {
    orgId = String(caller.org_id); esStaff = true;
  } else {
    const em = (body.email || "").toString().trim().toLowerCase();
    if (!EMAIL_RE.test(em)) return json({ error: "sin_identidad" }, 403);
    orgId = String((await clienteOrg(em)) || "");
  }
  if (!orgId) return json({ ok: true, org_id: null, posts: [] });

  const paraFilter = esStaff ? "" : "&para=in.(todos,clientes)";
  const posts = await q(`posts_red?org_id=eq.${encodeURIComponent(orgId)}${paraFilter}&select=${PUB_SELECT}&order=created_at.desc&limit=60`);
  return json({ ok: true, org_id: orgId, posts });
});
