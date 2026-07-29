// ===================================================================
// guardar-red — el DUEÑO (rol='owner') guarda la config de SU red: la marca
// white-label (logo, colores, fondo, letra, tipografía, nombre público,
// descripción, link de agendar, disponibilidad…), el nombre y el slug.
//
// Corre con SERVICE ROLE tras verificar por JWT que quien llama es el owner de
// esa organización. Así el guardado PERSISTE siempre, sin depender de RLS/GRANT
// sobre `organizaciones` (que antes hacía que "no se guardara" en silencio).
// Misma lección que coach-self-save en el panel del coach.
//
// Body:   { marca?, nombre?, slug? }
// Header: Authorization: Bearer <JWT del owner logueado>
// Resp:   { ok, org_id } | { error }
//
// Deploy: supabase functions deploy guardar-red --no-verify-jwt
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
// La org de la que el que llama es DUEÑO (por email O auth_id — el email del login
// puede no coincidir con el de la ficha, igual que en el resto de la red).
async function ownerOrg(token: string, email: string): Promise<string | null> {
  const ors: string[] = [];
  if (email) ors.push(`email.ilike.${encodeURIComponent(email)}`);
  try {
    const r = await fetch(`${SB_URL}/auth/v1/user`, { headers: { apikey: ANON, Authorization: `Bearer ${token}` } });
    if (r.ok) { const u = await r.json(); if (u && u.id) ors.push(`auth_id.eq.${encodeURIComponent(String(u.id))}`); }
  } catch { /* ignore */ }
  if (!ors.length) return null;
  try {
    const r = await fetch(`${SB_URL}/rest/v1/usuarios?or=(${ors.join(",")})&rol=eq.owner&select=org_id&limit=1`, { headers: svc });
    if (!r.ok) return null;
    const rows = await r.json();
    return (Array.isArray(rows) && rows[0] ? rows[0].org_id : null) || null;
  } catch { return null; }
}

// ¿El que llama es admin de Pathway? (por email de la ficha usuarios).
async function isAdmin(email: string): Promise<boolean> {
  if (!email) return false;
  try {
    const r = await fetch(`${SB_URL}/rest/v1/usuarios?email=ilike.${encodeURIComponent(email)}&rol=eq.admin&select=id&limit=1`, { headers: svc });
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

  let body: { marca?: Record<string, unknown>; nombre?: string; slug?: string; org_id?: string };
  try { body = await req.json(); } catch { return json({ error: "bad_json" }, 400); }

  // El DUEÑO guarda SU red. El ADMIN (Pathway) puede guardar CUALQUIER red
  // (onboarding white-glove: dejarle el logo/marca listo al cliente sin su clave).
  let orgId = await ownerOrg(token, email);
  if (!orgId) {
    if (await isAdmin(email) && body.org_id) orgId = String(body.org_id).trim();
  }
  if (!orgId) return json({ error: "not_owner" }, 403);

  const patch: Record<string, unknown> = {};
  if (body.marca && typeof body.marca === "object") {
    // Merge sobre la marca actual → un guardado parcial (ej. solo el logo) NO pisa
    // el resto (colores, fuente, nombre público…).
    let cur: Record<string, unknown> = {};
    try {
      const rc = await fetch(`${SB_URL}/rest/v1/organizaciones?id=eq.${encodeURIComponent(orgId)}&select=marca&limit=1`, { headers: svc });
      if (rc.ok) { const rows = await rc.json(); if (Array.isArray(rows) && rows[0] && rows[0].marca && typeof rows[0].marca === "object") cur = rows[0].marca; }
    } catch { /* si falla la lectura, guardamos lo que vino */ }
    patch.marca = { ...cur, ...body.marca };
  }
  if (typeof body.nombre === "string" && body.nombre.trim()) patch.nombre = body.nombre.trim().slice(0, 120);
  if (typeof body.slug === "string" && body.slug.trim()) patch.slug = body.slug.trim().toLowerCase().slice(0, 80);
  if (!Object.keys(patch).length) return json({ error: "nada_que_guardar" }, 400);

  async function doPatch(p: Record<string, unknown>) {
    return await fetch(`${SB_URL}/rest/v1/organizaciones?id=eq.${encodeURIComponent(orgId)}&select=id`, {
      method: "PATCH", headers: { ...svc, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify(p),
    });
  }
  try {
    let r = await doPatch(patch);
    // El slug es UNIQUE: si choca con otra red, reintentamos SIN slug (guardamos el resto).
    if ((r.status === 409 || r.status === 400) && patch.slug) {
      const p2 = { ...patch }; delete p2.slug;
      if (Object.keys(p2).length) r = await doPatch(p2);
    }
    if (!r.ok) return json({ error: "save_failed", status: r.status }, 502);
  } catch { return json({ error: "write_failed" }, 502); }
  return json({ ok: true, org_id: orgId });
});
