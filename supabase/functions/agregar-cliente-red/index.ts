// ===================================================================
// agregar-cliente-red — el DUEÑO de una red suma un cliente a SU empresa,
// asignado a un coach (o a él mismo). Service role + gate al owner. Respeta el
// tope de clientes del plan (organizaciones.max_clientes; null = ilimitado).
// El coach destino debe ser de la red (rol coach u owner). Si el email ya es un
// cliente, lo adopta a esta red; si no, lo crea.
//
// Body:   { nombre, email, coach_id }
// Header: Authorization: Bearer <JWT del owner>
// Resp:   { ok, id, mode:'created'|'adopted' } | { error, max?, count? }
//
// Deploy: supabase functions deploy agregar-cliente-red --no-verify-jwt
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
async function ownerOrg(email: string): Promise<{ id: string; max_clientes: number | null } | null> {
  try {
    const ur = await fetch(`${SB_URL}/rest/v1/usuarios?email=eq.${encodeURIComponent(email)}&rol=eq.owner&select=org_id&limit=1`, { headers: svc });
    if (!ur.ok) return null;
    const urows = await ur.json();
    const orgId = Array.isArray(urows) && urows[0] ? urows[0].org_id : null;
    if (!orgId) return null;
    const or = await fetch(`${SB_URL}/rest/v1/organizaciones?id=eq.${encodeURIComponent(orgId)}&select=id,max_clientes&limit=1`, { headers: svc });
    if (!or.ok) return null;
    const orows = await or.json();
    const org = Array.isArray(orows) && orows[0] ? orows[0] : null;
    return org ? { id: org.id, max_clientes: (org.max_clientes ?? null) } : null;
  } catch { return null; }
}
async function coachInOrg(coachId: string, orgId: string): Promise<boolean> {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/usuarios?id=eq.${encodeURIComponent(coachId)}&org_id=eq.${encodeURIComponent(orgId)}&rol=in.(coach,owner)&select=id&limit=1`, { headers: svc });
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
  console.log("[agregar-cliente-red] token present:", !!token, "url:", SB_URL);
  const email = await callerEmail(token);
  console.log("[agregar-cliente-red] caller email:", email);
  if (!email) return json({ error: "not_owner" }, 403);
  const org = await ownerOrg(email);
  console.log("[agregar-cliente-red] org found:", !!org, org?.id);
  if (!org) return json({ error: "not_owner" }, 403);

  let body: { nombre?: string; email?: string; coach_id?: string };
  try { body = await req.json(); } catch { return json({ error: "bad_json" }, 400); }
  const nombre = (body.nombre || "").toString().trim();
  const cliEmail = (body.email || "").toString().replace(/\s+/g, "").toLowerCase();
  const coach_id = (body.coach_id || "").toString().trim();
  console.log("[agregar-cliente-red] body:", {nombre, cliEmail, coach_id});
  if (!nombre) return json({ error: "nombre_required" }, 400);
  if (!EMAIL_RE.test(cliEmail)) return json({ error: "email_invalid" }, 400);
  const coachValid = await coachInOrg(coach_id, org.id);
  console.log("[agregar-cliente-red] coach valid:", coachValid, "coach_id:", coach_id, "org_id:", org.id);
  if (!coach_id || !coachValid) return json({ error: "coach_ajeno" }, 403);

  // Tope de clientes del plan.
  if (org.max_clientes != null) {
    try {
      const r = await fetch(`${SB_URL}/rest/v1/candidatos?org_id=eq.${encodeURIComponent(org.id)}&select=id`, { headers: { ...svc, Prefer: "count=exact" } });
      let count = 0;
      const cr = r.headers.get("content-range");
      if (cr && cr.indexOf("/") >= 0) count = parseInt(cr.split("/")[1], 10) || 0;
      else { const rows = await r.json(); count = Array.isArray(rows) ? rows.length : 0; }
      if (count >= org.max_clientes) return json({ error: "cap_reached", max: org.max_clientes, count }, 409);
    } catch { /* si el conteo falla, seguimos */ }
  }

  // ¿Ya existe un candidato con ese email? → lo adoptamos a esta red.
  try {
    const r = await fetch(`${SB_URL}/rest/v1/candidatos?email=eq.${encodeURIComponent(cliEmail)}&select=id&limit=1`, { headers: svc });
    console.log("[agregar-cliente-red] existing client check:", r.status);
    if (r.ok) {
      const rows = await r.json();
      if (Array.isArray(rows) && rows[0]) {
        const id = rows[0].id;
        console.log("[agregar-cliente-red] adopting existing client:", id);
        const up = await fetch(`${SB_URL}/rest/v1/candidatos?id=eq.${encodeURIComponent(id)}`, {
          method: "PATCH", headers: { ...svc, "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify({ org_id: org.id, coach_id, activo: true }),
        });
        console.log("[agregar-cliente-red] adopt update status:", up.status);
        if (!up.ok) return json({ error: "update_failed", status: up.status }, 502);
        return json({ ok: true, id, mode: "adopted" });
      }
    }
  } catch (e) {
    console.log("[agregar-cliente-red] adopt check error:", e);
    /* seguimos a crear */
  }

  // Crear el candidato en la red.
  try {
    console.log("[agregar-cliente-red] creating new client");
    const payload = { nombre, email: cliEmail, org_id: org.id, coach_id, activo: true, semana_activa: 1 };
    console.log("[agregar-cliente-red] payload:", payload);
    const r = await fetch(`${SB_URL}/rest/v1/candidatos`, {
      method: "POST", headers: { ...svc, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify(payload),
    });
    console.log("[agregar-cliente-red] create response status:", r.status);
    if (!r.ok) {
      const errText = await r.text();
      console.log("[agregar-cliente-red] create error response:", errText);
      return json({ error: "insert_failed", status: r.status }, 502);
    }
    const rows = await r.json();
    console.log("[agregar-cliente-red] create response rows:", rows);
    const id = Array.isArray(rows) && rows[0] ? rows[0].id : null;
    console.log("[agregar-cliente-red] ✓ client created:", id);
    return json({ ok: true, id, mode: "created" });
  } catch (e) {
    console.log("[agregar-cliente-red] write error:", e);
    return json({ error: "write_failed" }, 502);
  }
});
