// ===================================================================
// eliminar-cliente-red — el DUEÑO de una red (rol='owner') suspende, reactiva o
// quita uno de SUS clientes. Service role + gate al owner + verifica que el
// cliente es de SU empresa. Modos:
//   suspender → activo=false (pierde acceso, sigue en la red)
//   reactivar → activo=true
//   quitar    → desvincula del coach (coach_id=null) y saca de la red
//               (activo=false + org_id=null).
//               No borra la cuenta (sin pérdida de datos).
//
// Body:   { cliente_id, modo:'suspender'|'reactivar'|'quitar' }
// Header: Authorization: Bearer <JWT del owner>
// Resp:   { ok, modo } | { error }
//
// Deploy: supabase functions deploy eliminar-cliente-red --no-verify-jwt
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
    return (Array.isArray(rows) && rows[0] && rows[0].org_id) || null;
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

  let body: { cliente_id?: string; modo?: string };
  try { body = await req.json(); } catch { return json({ error: "bad_json" }, 400); }
  const cliente_id = (body.cliente_id || "").toString().trim();
  const modo = (body.modo || "").toString().trim();
  if (!cliente_id) return json({ error: "missing_id" }, 400);
  if (["suspender", "reactivar", "quitar"].indexOf(modo) < 0) return json({ error: "modo_invalido" }, 400);
  if (!(await clienteInOrg(cliente_id, orgId))) return json({ error: "cliente_ajeno" }, 403);

  async function patchCliente(fields: Record<string, unknown>): Promise<boolean> {
    try {
      const r = await fetch(
        `${SB_URL}/rest/v1/candidatos?id=eq.${encodeURIComponent(cliente_id)}&org_id=eq.${encodeURIComponent(orgId)}`,
        { method: "PATCH", headers: { ...svc, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify(fields) },
      );
      return r.ok;
    } catch { return false; }
  }

  if (modo === "suspender") return (await patchCliente({ activo: false })) ? json({ ok: true, modo }) : json({ error: "update_failed" }, 502);
  if (modo === "reactivar") return (await patchCliente({ activo: true })) ? json({ ok: true, modo }) : json({ error: "update_failed" }, 502);

  // quitar: desvincula del coach y saca de la red
  await patchCliente({ coach_id: null });
  const okc = await patchCliente({ activo: false, org_id: null });
  return okc ? json({ ok: true, modo: "quitar" }) : json({ error: "update_failed" }, 502);
});
