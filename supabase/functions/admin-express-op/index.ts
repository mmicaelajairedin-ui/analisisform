// ===================================================================
// admin-express-op — operaciones de admin sobre el Pack Express
// (tabla `cv_express`) SIN darle a `anon` capacidad de borrado.
//
// PROBLEMA QUE RESUELVE. `admin-express.html` borraba con un DELETE directo a
// PostgREST usando la ANON KEY, y la tabla tenía una política
// `USING(true)` para `anon`. O sea que la única autorización real era el
// `if (ME.rol !== 'admin')` del navegador, leído de `localStorage.mj_user`:
// dos líneas de consola lo saltan, y el DELETE de abajo lo aceptaba el
// servidor sin preguntar nada. Las 14 filas de esa tabla tienen `paid_at`:
// son packs comprados.
//
// Retirar la política a secas habría roto el botón legítimo del admin. Por eso
// la capacidad se MUEVE aquí en vez de eliminarse: el borrado sigue existiendo,
// pero detrás de una frontera que comprueba la identidad en el servidor.
//
// GATE. Es el MISMO de `admin-coach-op`, deliberadamente: ya está desplegado,
// probado y en uso desde el panel, y duplicar una regla de autorización es
// como se desalinean (una copia se corrige y la otra no). Si algún día cambia
// quién es admin en Pathway, estas dos funciones tienen que cambiar juntas.
//
// SEGURIDAD — lo que esta función NO se cree, en ningún caso:
//   · `localStorage` — no llega al servidor y no significa nada.
//   · un `rol` que mande el cliente — no se lee. Ni siquiera se mira.
//   · un email que mande el cliente COMO IDENTIDAD — el `email` del cuerpo es
//     la CLAVE DE LA FILA a borrar (la PK de `cv_express`), nunca quién llama.
//     Son dos cosas distintas y conviene no confundirlas al leer el código.
//
// Lo único que decide quién llama es el JWT: se valida contra `/auth/v1/user`,
// que es Supabase Auth respondiendo, y de ahí salen el email y el uid reales.
// El SERVICE ROLE se usa DESPUÉS de resolver que es admin, nunca antes.
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY
// Deploy: supabase functions deploy admin-express-op --no-verify-jwt
//
//   `--no-verify-jwt` es a propósito y NO afloja nada: la verificación la hace
//   esta función, que además necesita poder responder un 403 legible en vez de
//   el 401 opaco de la plataforma. Es el mismo despliegue que admin-coach-op.
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
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const isUuid = (s: string) => /^[0-9a-f-]{32,36}$/i.test(s);

// JWT del que llama → identidad verificada por Supabase Auth (email + uid).
// La anon key NO es un usuario: se descarta ANTES de preguntar, porque
// `/auth/v1/user` con la anon key no devuelve un usuario pero tampoco hace
// falta gastar el viaje. Cualquiera de los dos campos puede venir null.
async function callerIdentity(token: string): Promise<{ email: string | null; uid: string | null }> {
  if (!token || token === ANON) return { email: null, uid: null };
  try {
    const r = await fetch(`${SB_URL}/auth/v1/user`, {
      headers: { apikey: ANON, Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return { email: null, uid: null };
    const u = await r.json();
    const em = (u && u.email ? String(u.email) : "").trim().toLowerCase();
    const uid = (u && u.id ? String(u.id) : "").trim();
    return { email: EMAIL_RE.test(em) ? em : null, uid: isUuid(uid) ? uid : null };
  } catch {
    return { email: null, uid: null };
  }
}

// Admin si el que llama coincide con una fila de `usuarios` con rol='admin',
// por EMAIL del JWT o por auth_id (= auth.uid del JWT).
//
// Las dos vías, y no una, por el mismo motivo que admin-coach-op dejó escrito:
// la coach entra con Google (su gmail) mientras su fila de admin usa el email
// de marca; su `auth_id` sí está ligado, así que pasa por ahí. Con solo email
// se quedaría fuera la persona que sí es admin. → R-24, INC-018
async function isAdmin(email: string | null, uid: string | null): Promise<boolean> {
  const ors: string[] = [];
  if (email) ors.push(`email.ilike.${email}`);
  if (uid) ors.push(`auth_id.eq.${uid}`);
  if (!ors.length) return false;
  try {
    const r = await fetch(
      `${SB_URL}/rest/v1/usuarios?or=(${encodeURIComponent(ors.join(","))})&rol=eq.admin&select=id&limit=1`,
      { headers: svc },
    );
    if (!r.ok) return false;
    const rows = await r.json();
    return Array.isArray(rows) && rows.length > 0;
  } catch {
    return false;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "post_only" }, 405);
  if (!SB_URL || !SERVICE || !ANON) return json({ error: "env_missing" }, 500);

  // ── 1 · Gate de admin. Nada de lo de abajo corre sin pasar por aquí ──
  const auth = req.headers.get("Authorization") || req.headers.get("authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  const who = await callerIdentity(token);
  if (!who.email && !who.uid) return json({ error: "no_session" }, 401);
  if (!(await isAdmin(who.email, who.uid))) return json({ error: "not_admin" }, 403);

  // ── 2 · Entrada ──────────────────────────────────────────────────────
  let body: { op?: string; email?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad_json" }, 400);
  }

  const op = (body.op || "").toString();
  // `op` se valida contra una lista blanca EXPLÍCITA. Una función de admin que
  // acepta cualquier verbo crece sola hasta que alguien mete uno sin gate.
  if (op !== "delete_pack") return json({ error: "op_invalid" }, 400);

  // El email de la FILA OBJETIVO. No es la identidad de nadie: la identidad ya
  // se resolvió arriba, y este valor no influye en ella.
  // Se normaliza igual que lo hace el resto del producto (la tabla está
  // normalizada a minúsculas y tiene índice único sobre lower(email)).
  const target = (body.email || "").toString().trim().toLowerCase();
  if (!EMAIL_RE.test(target)) return json({ error: "email_invalid" }, 400);

  // ── 3 · ¿Existe la fila? ─────────────────────────────────────────────
  // Se comprueba ANTES de borrar para poder distinguir «no existe» de «no se
  // pudo borrar», que es lo que el admin necesita saber. Sin esto, borrar algo
  // inexistente devuelve exactamente lo mismo que borrarlo con éxito.
  let existe = false;
  try {
    const r = await fetch(
      `${SB_URL}/rest/v1/cv_express?email=eq.${encodeURIComponent(target)}&select=email&limit=1`,
      { headers: svc },
    );
    if (!r.ok) return json({ error: "db_error", status: r.status }, 502);
    const rows = await r.json();
    existe = Array.isArray(rows) && rows.length > 0;
  } catch {
    return json({ error: "db_unreachable" }, 502);
  }
  if (!existe) return json({ error: "not_found", email: target }, 404);

  // ── 4 · Borrado, ya con service_role ─────────────────────────────────
  // `return=representation` y NO `return=minimal`, a propósito: un DELETE que
  // no casa ninguna fila devuelve 204 y se lee como éxito. Pidiendo la
  // representación se puede CONTAR lo que se borró de verdad. → R-23
  let borradas = 0;
  try {
    const r = await fetch(
      `${SB_URL}/rest/v1/cv_express?email=eq.${encodeURIComponent(target)}`,
      {
        method: "DELETE",
        headers: { ...svc, Prefer: "return=representation", Accept: "application/json" },
      },
    );
    if (!r.ok) return json({ error: "delete_failed", status: r.status }, 502);
    const rows = await r.json().catch(() => []);
    borradas = Array.isArray(rows) ? rows.length : 0;
  } catch {
    return json({ error: "db_unreachable" }, 502);
  }

  // La fila estaba hace un instante y ahora no se borró ninguna: alguien la
  // borró en paralelo, o algo la está reteniendo. No se miente con ok:true.
  if (borradas === 0) return json({ error: "delete_no_match", email: target }, 409);

  // Resultado explícito: cuántas y cuál. El frontend no tiene que adivinar.
  return json({ ok: true, deleted: borradas, email: target });
});
