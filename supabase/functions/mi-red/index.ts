// ===================================================================
// mi-red — devuelve la RED del dueño logueado (rol='owner'): su organización,
// sus coaches y sus clientes. Service role + gate al owner. Es el read
// contraparte de asignar/agregar/eliminar: la RLS de candidatos NO deja que el
// owner lea a los clientes de sus coaches (la policy es coach_id=pw_coach_id()),
// así que la lectura tiene que pasar por acá para que el dueño vea su red
// completa. Filtra SIEMPRE por su org_id: nunca ve otra empresa.
//
// Header: Authorization: Bearer <JWT del owner>
// Resp:   { ok, org, coaches:[...], clientes:[...] } | { error }
//
// Deploy: supabase functions deploy mi-red --no-verify-jwt
// ===================================================================

const SB_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const ANON = Deno.env.get("SUPABASE_ANON_KEY") || "";
const svc = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` };

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
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
async function q(path: string): Promise<any[]> {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/${path}`, { headers: svc });
    if (!r.ok) {
      console.error(`Query failed: ${path} (${r.status})`);
      return [];
    }
    const rows = await r.json();
    return Array.isArray(rows) ? rows : [];
  } catch (e) {
    console.error(`Query error: ${path}`, e);
    return [];
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (!SB_URL || !SERVICE || !ANON) return json({ error: "env_missing" }, 500);

  const auth = req.headers.get("Authorization") || req.headers.get("authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  const email = await callerEmail(token);
  if (!email) return json({ error: "auth_invalid", detail: "Token inválido o no autenticado" }, 401);

  // Owner + su org.
  const owners = await q(`usuarios?email=eq.${encodeURIComponent(email)}&rol=eq.owner&select=id,nombre,email,activo,foto_url,configuracion,org_id&limit=1`);
  const owner = owners[0];
  if (!owner) return json({ error: "auth_not_owner", detail: "Tu cuenta no tiene el rol de Administrador" }, 403);
  const orgId = owner && owner.org_id;
  if (!orgId) return json({ error: "org_missing", detail: "Tu cuenta no tiene una organización asignada" }, 403);

  const orgs = await q(`organizaciones?id=eq.${encodeURIComponent(orgId)}&select=*&limit=1`);
  const org = orgs[0] || null;

  // order estable → el color por coach en la agenda del panel no baila entre recargas.
  const coaches = await q(`usuarios?org_id=eq.${encodeURIComponent(orgId)}&rol=eq.coach&order=created_at.asc&select=id,nombre,email,activo,foto_url,configuracion`);
  const clientes = await q(`candidatos?org_id=eq.${encodeURIComponent(orgId)}&select=id,nombre,email,activo,coach_id,semana_activa,foto_perfil,created_at,updated_at&order=created_at.desc`);

  // Citas de TODA la red (agenda del owner + historial de sesiones por cliente).
  // La RLS de citas es por coach → el owner no las lee directo; acá con service
  // role las trae de todos sus coaches (+ las suyas) en una sola llamada. Ventana:
  // últimos 120 días + todo lo futuro (mirror de _calLoad en el panel).
  // INCLUSIÓN: también trae los eventos de GRUPO (grupal=true) de la red.
  const coachIds = [owner.id, ...coaches.map((c: any) => c.id)].filter(Boolean);
  let citas: any[] = [];
  if (coachIds.length) {
    const from = new Date(Date.now() - 120 * 86400000).toISOString();
    const inList = coachIds.map((id) => String(id)).join(",");
    // Personal citas: coach_id en el team
    const personal = await q(`citas?coach_id=in.(${inList})&inicio=gte.${from}&order=inicio.desc&select=id,nombre,email,tipo,inicio,estado,coach_id,telefono,origen,resultado,notas_llamada,grupal,modalidad,lugar`);
    // Group events: org_id match y grupal=true
    const grupal = await q(`citas?org_id=eq.${encodeURIComponent(orgId)}&grupal=eq.true&inicio=gte.${from}&order=inicio.desc&select=id,nombre,email,tipo,inicio,estado,coach_id,telefono,origen,resultado,notas_llamada,grupal,modalidad,lugar`);
    // Deduplication: avoid showing the same cita twice (personal + grupal filters can overlap)
    const seen = new Set<string>();
    citas = [...personal, ...grupal].filter((c) => {
      const key = `${c.id}-${c.inicio}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  // owner también es un coach asignable ("el owner es coach aunque luego no
  // quiera atender"). Se devuelve aparte para marcarlo como "Vos".
  return json({ ok: true, org, owner, coaches, clientes, citas });
});
