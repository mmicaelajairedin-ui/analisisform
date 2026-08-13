// ===================================================================
// editar-cliente-red — el DUEÑO de una red edita un cliente (candidato):
// - nombre, email, estado (activo/inactivo)
// - plan, notas (campos candidatos)
//
// Service role tras verificar owner + que el cliente pertenece a SU org.
//
// Body:   { cliente_id, nombre?, email?, estado?, plan?, notas? }
// Header: Authorization: Bearer <JWT del owner logueado>
// Resp:   { ok, nombre?, email?, estado?, plan?, notas? } | { error }
//
// Deploy: supabase functions deploy editar-cliente-red --no-verify-jwt
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
async function clienteInOrg(clienteId: string, orgId: string): Promise<boolean> {
  try {
    const r = await fetch(
      `${SB_URL}/rest/v1/candidatos?id=eq.${encodeURIComponent(clienteId)}&org_id=eq.${encodeURIComponent(orgId)}&select=id&limit=1`,
      { headers: svc },
    );
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
  const email = await callerEmail(token);
  if (!email) return json({ error: "not_owner" }, 403);
  const orgId = await ownerOrg(email);
  if (!orgId) return json({ error: "not_owner" }, 403);

  let body: { cliente_id?: string; nombre?: string; email?: string; estado?: string; plan?: string; notas?: string };
  try { body = await req.json(); } catch { return json({ error: "bad_json" }, 400); }
  const clienteId = (body.cliente_id || "").toString().trim();
  if (!clienteId) return json({ error: "missing_cliente" }, 400);

  const hasNombre = typeof body.nombre === "string" && body.nombre.trim().length > 0;
  const hasEmail = typeof body.email === "string" && body.email.trim().length > 0;
  const hasEstado = typeof body.estado === "string" && body.estado.trim().length > 0;
  const hasPlan = typeof body.plan === "string" && body.plan.trim().length > 0;
  const hasNotas = typeof body.notas === "string";
  if (!hasNombre && !hasEmail && !hasEstado && !hasPlan && !hasNotas) return json({ error: "nothing_to_update" }, 400);

  // Verificar que el cliente pertenece a ESTA org
  if (!(await clienteInOrg(clienteId, orgId))) return json({ error: "cliente_ajeno" }, 403);

  // Validar inputs
  const update: Record<string, unknown> = {};
  if (hasNombre) update.nombre = body.nombre!.trim().slice(0, 200);
  if (hasEmail) {
    const em = body.email!.trim().toLowerCase();
    if (!EMAIL_RE.test(em)) return json({ error: "invalid_email" }, 400);
    update.email = em;
  }
  if (hasEstado) {
    const s = body.estado!.toLowerCase();
    if (!["activo", "inactivo"].includes(s)) return json({ error: "invalid_estado" }, 400);
    update.activo = s === "activo";
  }
  if (hasPlan) update.plan = body.plan!.trim().slice(0, 100);
  if (hasNotas) update.notas = (body.notas || "").toString().trim().slice(0, 2000);

  try {
    const r = await fetch(
      `${SB_URL}/rest/v1/candidatos?id=eq.${encodeURIComponent(clienteId)}&org_id=eq.${encodeURIComponent(orgId)}`,
      { method: "PATCH", headers: { ...svc, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify(update) },
    );
    if (!r.ok) return json({ error: "update_failed", status: r.status }, 502);
  } catch { return json({ error: "write_failed" }, 502); }

  return json({
    ok: true,
    nombre: hasNombre ? update.nombre : undefined,
    email: hasEmail ? update.email : undefined,
    estado: hasEstado ? body.estado!.toLowerCase() : undefined,
    plan: hasPlan ? update.plan : undefined,
    notas: hasNotas ? update.notas : undefined,
  });
});
