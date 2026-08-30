// ===================================================================
// editar-coach-red — el DUEÑO de una red edita un miembro (coach/colaborador):
// - member_role: 'coach' (da clases) ↔ 'colaborador' (sin clases)
// - nombre, email, especialidad (campos usuarios)
// - servicios, permisos (campos configuracion)
// - mc_permisos (campo configuracion, de MultiCoach — ver mas abajo)
//
// Service role tras verificar owner + que el miembro es de su org.
// La distinción vive en usuarios.configuracion.member_role. PostgREST no hace
// merge de un JSONB, así que leemos la configuracion actual, mergeamos y reescribimos.
//
// Body:   { coach_id, member_role?, nombre?, email?, especialidad?, servicios?, permisos?, mc_permisos? }
// Header: Authorization: Bearer <JWT del owner logueado>
// Resp:   { ok, member_role?, nombre?, email?, especialidad?, servicios?, mc_permisos? } | { error }
//
// Deploy: supabase functions deploy editar-coach-red --no-verify-jwt
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

async function callerEmail(token: string): Promise<string | null> {
  if (!token || token === ANON) return null;
  try {
    const r = await fetch(`${SB_URL}/auth/v1/user`, { headers: { apikey: ANON, Authorization: `Bearer ${token}` } });
    if (!r.ok) return null;
    const u = await r.json();
    const em = (u && u.email ? String(u.email) : "").trim().toLowerCase();
    return EMAIL_RE.test(em) ? em : null;
  } catch { return null; }
}
async function ownerOrg(email: string): Promise<string | null> {
  try {
    const r = await fetch(
      `${SB_URL}/rest/v1/usuarios?email=eq.${encodeURIComponent(email)}&rol=eq.owner&select=org_id&limit=1`,
      { headers: svc },
    );
    if (!r.ok) return null;
    const rows = await r.json();
    return (Array.isArray(rows) && rows[0] ? rows[0].org_id : null) || null;
  } catch { return null; }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "post_only" }, 405);
  if (!SB_URL || !SERVICE || !ANON) return json({ error: "env_missing" }, 500);

  const auth = req.headers.get("Authorization") || req.headers.get("authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  const email = await callerEmail(token);
  if (!email) return json({ error: "not_owner" }, 403);
  const orgId = await ownerOrg(email);
  if (!orgId) return json({ error: "not_owner" }, 403);

  let body: { coach_id?: string; member_role?: string; nombre?: string; email?: string; especialidad?: string; servicios?: unknown; permisos?: unknown; mc_permisos?: unknown };
  try { body = await req.json(); } catch { return json({ error: "bad_json" }, 400); }
  const coachId = (body.coach_id || "").toString().trim();
  if (!coachId) return json({ error: "missing_coach" }, 400);

  const hasRole = typeof body.member_role === "string" && body.member_role.length > 0;
  const hasNombre = typeof body.nombre === "string" && body.nombre.trim().length > 0;
  const hasEmail = typeof body.email === "string" && body.email.trim().length > 0;
  const hasEsp = typeof body.especialidad === "string" && body.especialidad.trim().length > 0;
  const hasSvcs = Array.isArray(body.servicios);
  const hasPerms = !!body.permisos && typeof body.permisos === "object" && !Array.isArray(body.permisos);
  const hasMcPerms = body.mc_permisos !== undefined;
  if (!hasRole && !hasNombre && !hasEmail && !hasEsp && !hasSvcs && !hasPerms && !hasMcPerms) return json({ error: "nothing_to_update" }, 400);

  // El target tiene que ser de ESTA org, o el propio dueño (que también ofrece
  // servicios). Leemos su configuracion para mergear.
  let cfg: Record<string, unknown> = {};
  try {
    const r = await fetch(
      `${SB_URL}/rest/v1/usuarios?id=eq.${encodeURIComponent(coachId)}&select=configuracion,org_id,email&limit=1`,
      { headers: svc },
    );
    if (!r.ok) return json({ error: "lookup_failed", status: r.status }, 502);
    const rows = await r.json();
    if (!Array.isArray(rows) || !rows.length) return json({ error: "coach_ajeno" }, 403);
    const t = rows[0] || {};
    const belongs = (String(t.org_id || "") === String(orgId)) || (String(t.email || "").toLowerCase() === email);
    if (!belongs) return json({ error: "coach_ajeno" }, 403);
    cfg = (t.configuracion && typeof t.configuracion === "object") ? t.configuracion : {};
  } catch { return json({ error: "db_unreachable" }, 502); }

  let memberRole = "";
  if (hasRole) {
    memberRole = String(body.member_role).toLowerCase() === "colaborador" ? "colaborador" : "coach";
    cfg.member_role = memberRole;
    cfg.no_da_clases = memberRole === "colaborador";
  }

  // Aranceles del coach: lista de servicios {name, desc, price, moneda, recurrente}.
  // Es lo que alimenta la landing de la red y el checkout (red-checkout).
  if (hasSvcs) {
    const MONEDAS_OK = new Set(["eur","usd","gbp","mxn","ars","cop","clp","pen","brl","uyu","cad","chf"]);
    const clean = (body.servicios as unknown[]).slice(0, 30).map((s) => {
      const o = (s && typeof s === "object") ? s as Record<string, unknown> : {};
      const price = Number(o.price ?? o.precio ?? 0);
      const rawMon = String(o.moneda ?? "eur").toLowerCase();
      return {
        name: String(o.name ?? o.nombre ?? "Servicio").trim().slice(0, 120) || "Servicio",
        desc: String(o.desc ?? o.descripcion ?? "").trim().slice(0, 240),
        price: (Number.isFinite(price) && price > 0) ? price : 0,
        moneda: MONEDAS_OK.has(rawMon) ? rawMon : "eur",
        recurrente: o.recurrente === true || o.suscripcion === true,
      };
    }).filter((s) => s.price > 0);
    cfg.servicios = clean;
  }

  // Permisos por miembro que decide el DUEÑO de la red: a qué superficies del
  // panel accede cada persona (negocio, perfil_publico, marketplace). Merge
  // sobre lo que ya tenía, solo claves conocidas y booleanas.
  if (hasPerms) {
    const inp = body.permisos as Record<string, unknown>;
    const cur = (cfg.permisos && typeof cfg.permisos === "object") ? cfg.permisos as Record<string, unknown> : {};
    const out: Record<string, boolean> = {};
    for (const k of ["negocio", "perfil_publico", "marketplace"]) {
      if (typeof inp[k] === "boolean") out[k] = inp[k] as boolean;
      else if (typeof cur[k] === "boolean") out[k] = cur[k] as boolean;
    }
    cfg.permisos = out;
  }

  // El recuento se guarda AQUI, no se relee de `cfg` al responder: MultiCoach
  // lo compara con lo que envio para saber si se guardo de verdad (R-23), y una
  // respuesta que relee el objeto se cae si alguna edicion futura hace que la
  // asignacion sea condicional. Lo encontro el canario del banco de pruebas.
  let mcGrants: number | undefined = undefined;

  // MultiCoach: permisos por miembro de SU producto, en SU clave.
  //
  // Deliberadamente APARTE de `permisos`, que son los tres de este panel
  // (negocio, perfil_publico, marketplace) y se siguen tratando arriba sin
  // cambio ninguno. Son dos vocabularios distintos y no se mezclan: el bloque
  // de arriba reconstruye su objeto desde cero, asi que una clave ajena metida
  // ahi se perderia en la primera edicion.
  //
  // Aqui NO hay lista blanca de permisos a proposito: el vocabulario es de
  // MultiCoach y va a cambiar, y validarlo aqui convertiria cada permiso nuevo
  // suyo en un despliegue de esta funcion. Lo que si se valida es la FORMA y el
  // tamano, para que la clave no acabe siendo almacenamiento libre.
  //
  // Contrato completo: docs/CONTRATO-MC-PERMISOS.md, del repositorio multicoach.
  if (hasMcPerms) {
    const mc = body.mc_permisos;
    if (!mc || typeof mc !== "object" || Array.isArray(mc)) return json({ error: "mc_permisos_invalido" }, 400);
    const o = mc as Record<string, unknown>;
    const grants = o.grants;
    if (typeof o.v !== "number" || typeof o.org_id !== "string" || !o.org_id) {
      return json({ error: "mc_permisos_invalido" }, 400);
    }
    if (!Array.isArray(grants) || grants.length > 32) return json({ error: "mc_permisos_invalido" }, 400);
    if (grants.some((g) => typeof g !== "string" || (g as string).length > 64)) {
      return json({ error: "mc_permisos_invalido" }, 400);
    }
    // Reemplazo ENTERO del objeto: `grants` es una lista completa, no un
    // incremento, y por eso retirar un permiso es mandar la lista sin el.
    cfg.mc_permisos = { v: o.v, org_id: o.org_id, grants: grants as string[] };
    mcGrants = (grants as string[]).length;
  }

  // Preparar cambios de usuarios (nombre, email) y configuracion
  const usuariosUpdate: Record<string, unknown> = { configuracion: cfg };
  if (hasNombre) usuariosUpdate.nombre = body.nombre!.trim().slice(0, 200);
  if (hasEmail) {
    const em = body.email!.trim().toLowerCase();
    if (!EMAIL_RE.test(em)) return json({ error: "invalid_email" }, 400);
    usuariosUpdate.email = em;
  }
  if (hasEsp) cfg.especialidad = body.especialidad!.trim().slice(0, 200);

  try {
    const r = await fetch(
      `${SB_URL}/rest/v1/usuarios?id=eq.${encodeURIComponent(coachId)}`,
      { method: "PATCH", headers: { ...svc, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify(usuariosUpdate) },
    );
    if (!r.ok) return json({ error: "update_failed", status: r.status }, 502);
  } catch { return json({ error: "write_failed" }, 502); }

  return json({
    ok: true,
    member_role: memberRole || undefined,
    nombre: hasNombre ? usuariosUpdate.nombre : undefined,
    email: hasEmail ? usuariosUpdate.email : undefined,
    especialidad: hasEsp ? cfg.especialidad : undefined,
    servicios: hasSvcs ? (cfg.servicios as unknown[]).length : undefined,
    mc_permisos: mcGrants
  });
});
