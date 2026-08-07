// ===================================================================
// agenda-red-cliente — devuelve las CLASES / eventos grupales próximos de la RED
// a la que pertenece un cliente, para que los vea en su portal y elija a cuáles
// anotarse. Service role, pero acotado: SOLO trae las clases de la org del propio
// cliente (verificado por su email en candidatos), y SOLO eventos GRUPALES
// (clases/cursos) — nunca las sesiones 1:1 privadas de otros clientes.
//
// Body:   { email }
// Resp:   { ok, org_id, clases:[{id,inicio,tipo,nombre,coach_id,coach_nombre,modalidad,lugar}] } | { error }
//
// Deploy: supabase functions deploy agenda-red-cliente --no-verify-jwt
// ===================================================================

import { SB } from "../supabase-config.ts";

const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
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
async function q(table: string, isData: boolean = false): Promise<any[]> {
  const url = isData ? SB.DATA : SB.USERS;
  try { const r = await fetch(`${url}/rest/v1/${table}`, { headers: svc }); if (!r.ok) return []; const rows = await r.json(); return Array.isArray(rows) ? rows : []; }
  catch { return []; }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "post_only" }, 405);
  if (!SB.DATA || !SB.USERS || !SERVICE) return json({ error: "env_missing" }, 500);

  let body: { email?: string };
  try { body = await req.json(); } catch { return json({ error: "bad_json" }, 400); }
  const email = (body.email || "").toString().trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return json({ error: "email_invalid" }, 400);

  // El cliente + su org (por email). Si no tiene org, no hay red → nada que mostrar.
  const cli = await q(`candidatos?email=eq.${encodeURIComponent(email)}&select=org_id&limit=5`, false);
  const orgId = (cli.find((c) => c && c.org_id) || {}).org_id || null;
  if (!orgId) return json({ ok: true, org_id: null, clases: [] });

  // Coaches de esa org (incluye al dueño). Las clases pueden ser de cualquiera.
  const coaches = await q(`usuarios?org_id=eq.${encodeURIComponent(orgId)}&rol=in.(coach,owner)&select=id,nombre`, false);
  const nameById: Record<string, string> = {};
  const ids: string[] = [];
  for (const c of coaches) { if (c && c.id) { ids.push(String(c.id)); nameById[String(c.id)] = c.nombre || ""; } }
  if (!ids.length) return json({ ok: true, org_id: orgId, clases: [] });

  // SOLO eventos GRUPALES (clases/cursos) y futuros. Nunca 1:1 privados de otros.
  const from = new Date(Date.now() - 3600_000).toISOString(); // desde hace 1h (para las que empiezan ya)
  const inList = ids.map((id) => encodeURIComponent(id)).join(",");
  let rows: any[] = [];
  try {
    const r = await fetch(
      `${SB.DATA}/rest/v1/citas?coach_id=in.(${inList})&grupal=is.true&inicio=gte.${from}&estado=neq.cancelada&order=inicio.asc&limit=60&select=id,inicio,tipo,nombre,coach_id,modalidad,lugar`,
      { headers: svc },
    );
    if (r.status === 400) return json({ ok: true, org_id: orgId, clases: [] }); // columna grupal aún no existe
    if (r.ok) { const j = await r.json(); rows = Array.isArray(j) ? j : []; }
  } catch { /* best-effort */ }

  const clases = rows.map((c) => ({
    id: c.id, inicio: c.inicio, tipo: c.tipo || "Clase", nombre: c.nombre || "",
    coach_id: c.coach_id, coach_nombre: nameById[String(c.coach_id)] || "",
    modalidad: c.modalidad || "online", lugar: c.lugar || "",
  }));
  return json({ ok: true, org_id: orgId, clases });
});
