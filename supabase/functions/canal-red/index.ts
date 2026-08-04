// ===================================================================
// canal-red — CANALES DE EQUIPO de una red (multicoach). El dueño y sus coaches
// hablan en el canal GENERAL (toda la red) o en GRUPOS con miembros propios.
//
//   · canal_id ausente/null  → canal GENERAL de la org (toda la red).
//   · canal_id = <uuid>       → un grupo (red_canales) con sus miembros.
//
// Body (todas requieren org_id):
//   { action:'thread',       org_id, canal_id? }           → { ok, mensajes:[…] }
//   { action:'send',         org_id, canal_id?, texto }    → { ok, id }
//   { action:'groups',       org_id }                       → { ok, canales:[{id,nombre,general,miembros,ultimo_at}] }
//   { action:'group_create', org_id, nombre, miembros? }    → { ok, canal:{id,nombre,miembros} }
//   { action:'group_update', org_id, canal_id, nombre?, miembros? } → { ok }
//
// Header: Authorization: Bearer <JWT del dueño o de un coach de la red>
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

// ¿el caller puede ver/escribir en este grupo? owner siempre; miembros vacío = toda
// la red; o el id del caller está en la lista. Devuelve la fila del canal, "no"
// (existe pero sin permiso) o null (no existe / otra org).
async function canalPermitido(orgId: string, canalId: string, caller: { id: string; rol: string }): Promise<any | "no" | null> {
  const rows = await q(`red_canales?id=eq.${encodeURIComponent(canalId)}&select=id,org_id,nombre,miembros&limit=1`);
  const row = rows[0];
  if (!row || String(row.org_id) !== String(orgId)) return null;
  const miembros = Array.isArray(row.miembros) ? row.miembros.map((x: any) => String(x)) : [];
  const ok = caller.rol === "owner" || miembros.length === 0 || miembros.indexOf(String(caller.id)) >= 0;
  return ok ? row : "no";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "post_only" }, 405);
  if (!SB_URL || !SERVICE || !ANON) return json({ error: "env_missing" }, 500);

  const auth = req.headers.get("Authorization") || req.headers.get("authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  const caller = await callerRow(token);
  if (!caller) return json({ error: "no_session" }, 403);

  let body: { action?: string; org_id?: string; canal_id?: string; texto?: string; nombre?: string; miembros?: any[] };
  try { body = await req.json(); } catch { return json({ error: "bad_json" }, 400); }
  const action = (body.action || "").toString();
  const orgId = (body.org_id || "").toString().trim();
  if (!orgId) return json({ error: "missing_org" }, 400);

  // Gate base: el que llama tiene que ser miembro de ESA red (dueño o coach con ese org_id).
  const esMiembro = caller.org_id && String(caller.org_id) === String(orgId) &&
    (caller.rol === "owner" || caller.rol === "coach");
  if (!esMiembro) return json({ error: "sin_permiso" }, 403);

  const canalId = (body.canal_id || "").toString().trim();

  // ── Lista de canales visibles para el caller (General + sistema + grupos propios) ──
  if (action === "groups") {
    const all = await q(`red_canales?org_id=eq.${encodeURIComponent(orgId)}&select=id,nombre,miembros,created_at,is_system&order=is_system.desc,nombre.asc`);
    const visibles = all.filter((g: any) => {
      const m = Array.isArray(g.miembros) ? g.miembros.map((x: any) => String(x)) : [];
      return caller.rol === "owner" || m.length === 0 || m.indexOf(String(caller.id)) >= 0;
    });
    async function ultimo(cid: string | null): Promise<string | null> {
      const f = cid ? `canal_id=eq.${encodeURIComponent(cid)}` : `canal_id=is.null`;
      const r = await q(`mensajes_red_canal?org_id=eq.${encodeURIComponent(orgId)}&${f}&select=created_at&order=created_at.desc&limit=1`);
      return r[0] ? r[0].created_at : null;
    }
    const canales: any[] = [{ id: null, nombre: "General", general: true, is_system: true, miembros: [], ultimo_at: await ultimo(null) }];
    for (const g of visibles) {
      canales.push({ id: g.id, nombre: g.nombre, general: false, is_system: g.is_system || false, miembros: Array.isArray(g.miembros) ? g.miembros : [], ultimo_at: await ultimo(g.id) });
    }
    return json({ ok: true, canales });
  }

  // ── Crear un grupo ──
  if (action === "group_create") {
    const nombre = (body.nombre || "").toString().trim().slice(0, 60);
    if (!nombre) return json({ error: "nombre_vacio" }, 400);
    let miembros = Array.isArray(body.miembros) ? body.miembros.map((x) => String(x)).filter(Boolean) : [];
    if (miembros.length && miembros.indexOf(String(caller.id)) < 0) miembros.push(String(caller.id));
    miembros = Array.from(new Set(miembros));
    try {
      const r = await fetch(`${SB_URL}/rest/v1/red_canales`, {
        method: "POST", headers: { ...svc, "Content-Type": "application/json", Prefer: "return=representation" },
        body: JSON.stringify({ org_id: orgId, nombre, creado_por: caller.id, miembros }),
      });
      if (!r.ok) return json({ error: "insert_failed", status: r.status }, 502);
      const rows = await r.json();
      const row = Array.isArray(rows) ? rows[0] : null;
      return json({ ok: true, canal: row ? { id: row.id, nombre: row.nombre, miembros: row.miembros || [] } : null });
    } catch { return json({ error: "write_failed" }, 502); }
  }

  // ── Renombrar / cambiar miembros de un grupo (dueño o quien lo creó) ──
  if (action === "group_update") {
    if (!canalId) return json({ error: "missing_canal" }, 400);
    const rows = await q(`red_canales?id=eq.${encodeURIComponent(canalId)}&select=id,org_id,creado_por&limit=1`);
    const row = rows[0];
    if (!row || String(row.org_id) !== String(orgId)) return json({ error: "no_existe" }, 404);
    if (!(caller.rol === "owner" || String(row.creado_por) === String(caller.id))) return json({ error: "sin_permiso" }, 403);
    const patch: Record<string, unknown> = {};
    if (typeof body.nombre === "string" && body.nombre.trim()) patch.nombre = body.nombre.trim().slice(0, 60);
    if (Array.isArray(body.miembros)) patch.miembros = Array.from(new Set(body.miembros.map((x) => String(x)).filter(Boolean)));
    if (!Object.keys(patch).length) return json({ ok: true });
    try {
      const r = await fetch(`${SB_URL}/rest/v1/red_canales?id=eq.${encodeURIComponent(canalId)}`, {
        method: "PATCH", headers: { ...svc, "Content-Type": "application/json" }, body: JSON.stringify(patch),
      });
      if (!r.ok) return json({ error: "update_failed", status: r.status }, 502);
      return json({ ok: true });
    } catch { return json({ error: "write_failed" }, 502); }
  }

  // ── Eliminar un grupo (dueño o quien lo creó) ──
  if (action === "group_delete") {
    if (!canalId) return json({ error: "missing_canal" }, 400);
    const rows = await q(`red_canales?id=eq.${encodeURIComponent(canalId)}&select=id,org_id,creado_por&limit=1`);
    const row = rows[0];
    if (!row || String(row.org_id) !== String(orgId)) return json({ error: "no_existe" }, 404);
    if (!(caller.rol === "owner" || String(row.creado_por) === String(caller.id))) return json({ error: "sin_permiso" }, 403);
    try {
      const r = await fetch(`${SB_URL}/rest/v1/red_canales?id=eq.${encodeURIComponent(canalId)}`, {
        method: "DELETE", headers: svc,
      });
      if (!r.ok) return json({ error: "delete_failed", status: r.status }, 502);
      return json({ ok: true });
    } catch { return json({ error: "write_failed" }, 502); }
  }

  // Para thread/send con canal_id, validar pertenencia al grupo.
  if (canalId) {
    const perm = await canalPermitido(orgId, canalId, caller);
    if (perm === null) return json({ error: "canal_no_existe" }, 404);
    if (perm === "no") return json({ error: "sin_permiso" }, 403);
  }
  const canalFilter = canalId ? `canal_id=eq.${encodeURIComponent(canalId)}` : `canal_id=is.null`;

  if (action === "send") {
    const texto = (body.texto || "").toString().trim();
    if (!texto) return json({ error: "texto_vacio" }, 400);
    try {
      const r = await fetch(`${SB_URL}/rest/v1/mensajes_red_canal`, {
        method: "POST", headers: { ...svc, "Content-Type": "application/json", Prefer: "return=representation" },
        body: JSON.stringify({ org_id: orgId, canal_id: canalId || null, autor_id: caller.id, autor_nombre: caller.nombre || "", autor_rol: caller.rol, body: texto }),
      });
      if (!r.ok) return json({ error: "insert_failed", status: r.status }, 502);
      const rows = await r.json();
      return json({ ok: true, id: (Array.isArray(rows) && rows[0] && rows[0].id) || null });
    } catch { return json({ error: "write_failed" }, 502); }
  }

  // thread: todo el canal (general o grupo), del más viejo al más nuevo.
  const mensajes = await q(`mensajes_red_canal?org_id=eq.${encodeURIComponent(orgId)}&${canalFilter}&select=id,autor_id,autor_nombre,autor_rol,body,created_at&order=created_at.asc&limit=500`);
  return json({ ok: true, mensajes });
});
