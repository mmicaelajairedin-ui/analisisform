// ===================================================================
// guardar-informe — guarda el diagnóstico/plan que el coach edita en la tabla
// `informes` SIN chocar con el RLS estricto (rls_close_informes_cv_leak.sql).
//
// Problema que resuelve: con RLS estricto, el UPDATE de `informes` exige
//   coach_id = pw_coach_id()  (el id del coach que sale de SU JWT de Supabase Auth).
// Pero muchas filas las creó `generar-informe` con SERVICE ROLE y SIN coach_id
// (quedan con coach_id = NULL). Entonces el UPDATE del coach nunca matchea la
// fila huérfana → PostgREST responde "permission denied / row-level" y el
// guardado del diagnóstico falla. Además, si el coach entró con el login viejo
// (sin sesión Supabase Auth), no viaja JWT y todo cae a la anon key → bloqueado.
//
// Esta función corre con SERVICE ROLE (bypassa RLS) y hace un upsert por email
// del diagnóstico, estampando coach_id = DUEÑO REAL del cliente
// (candidatos.coach_id). Así el guardado SIEMPRE funciona y de paso REPARA las
// filas huérfanas para que la próxima edición ya entre por el camino normal.
//
// Seguridad (aislamiento multi-tenant):
//   · Solo escribe informes de un email que YA es cliente (candidatos) o usuario
//     real (no crea filas para emails al azar).
//   · El coach_id que se estampa NO es el que manda el navegador, sino el dueño
//     del cliente (candidatos.coach_id). Si el cliente ya tiene dueño y el coach
//     que llama no es ese dueño (ni admin) → 403. Un coach no puede pisar el
//     informe del cliente de otro coach.
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// Deploy: supabase functions deploy guardar-informe --no-verify-jwt
// ===================================================================

const SB_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
  Deno.env.get("SERVICE_ROLE_KEY") || "";
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

const isUuid = (s: string) => /^[0-9a-f-]{32,36}$/i.test(s);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  if (!SB_URL || !SERVICE) return json({ error: "env_missing" }, 500);

  let body: { email?: string; data?: unknown; coach_id?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad_json" }, 400);
  }

  const email = (body.email || "").toString().trim().toLowerCase();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: "email_required" }, 400);

  // El diagnóstico viaja como objeto o como string JSON; la columna guarda string.
  if (body.data == null) return json({ error: "data_required" }, 400);
  const dataStr = typeof body.data === "string" ? body.data : JSON.stringify(body.data);

  const callerCoach = (body.coach_id || "").toString().trim();
  const validCaller = isUuid(callerCoach) ? callerCoach : "";

  // ¿El que llama es admin? (los admin pueden guardar cualquier informe).
  let callerIsAdmin = false;
  if (validCaller) {
    try {
      const r = await fetch(
        `${SB_URL}/rest/v1/usuarios?id=eq.${encodeURIComponent(validCaller)}&select=rol&limit=1`,
        { headers: svc },
      );
      if (r.ok) { const rows = await r.json(); callerIsAdmin = Array.isArray(rows) && rows[0] && rows[0].rol === "admin"; }
    } catch { /* trata como no-admin */ }
  }

  // Dueño real del cliente (fuente de verdad del coach_id del informe).
  let cand: { id: number; coach_id: string | null } | null = null;
  try {
    const r = await fetch(
      `${SB_URL}/rest/v1/candidatos?email=eq.${encodeURIComponent(email)}&select=id,coach_id&limit=1`,
      { headers: svc },
    );
    if (r.ok) { const rows = await r.json(); if (Array.isArray(rows) && rows.length) cand = rows[0]; }
  } catch {
    return json({ error: "db_unreachable" }, 502);
  }

  // Gate: el email tiene que ser un cliente o usuario real (no filas al azar).
  if (!cand) {
    let esUsuario = false;
    try {
      const r = await fetch(
        `${SB_URL}/rest/v1/usuarios?email=eq.${encodeURIComponent(email)}&select=id&limit=1`,
        { headers: svc },
      );
      if (r.ok) { const rows = await r.json(); esUsuario = Array.isArray(rows) && rows.length > 0; }
    } catch { /* sigue como no-usuario */ }
    if (!esUsuario) return json({ error: "unknown_email" }, 403);
  }

  // Aislamiento: si el cliente ya tiene dueño y quien llama no es ese dueño (ni
  // admin), no puede tocar su informe.
  const owner = (cand && cand.coach_id) || "";
  if (owner && !callerIsAdmin && validCaller && validCaller !== owner) {
    return json({ error: "not_owner" }, 403);
  }
  // coach_id a estampar: el dueño real; si el cliente es huérfano, adopta el que
  // llama (válido). Admin sin dueño conocido → deja lo que venga (o null).
  const stampCoach = owner || validCaller || "";

  const row: Record<string, unknown> = { email, data: dataStr };
  if (cand && cand.id != null) row.candidato_id = cand.id;
  if (stampCoach) row.coach_id = stampCoach;

  try {
    const r = await fetch(`${SB_URL}/rest/v1/informes?on_conflict=email`, {
      method: "POST",
      headers: { ...svc, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(row),
    });
    if (!r.ok) {
      const t = await r.text().catch(() => "");
      return json({ error: "write_failed", status: r.status, detail: t.slice(0, 200) }, 502);
    }

    // Defensive: ensure assignment exists (best-effort)
    try {
      if (stampCoach && cand && cand.id != null && email) {
        const assignmentCheck = await fetch(
          `${SB_URL}/rest/v1/coach_client_assignments?org_id=eq.${encodeURIComponent((cand as any).org_id || "")}&client_id=eq.${encodeURIComponent(cand.id)}&coach_id=eq.${encodeURIComponent(stampCoach)}&select=id`,
          { headers: svc }
        );
        if (assignmentCheck.ok) {
          const asgn = await assignmentCheck.json();
          if (!Array.isArray(asgn) || asgn.length === 0) {
            // Create assignment if missing (best-effort, log if fails)
            const createResp = await fetch(
              `${SB_URL}/rest/v1/coach_client_assignments`,
              { method: "POST", headers: { ...svc, "Content-Type": "application/json" }, body: JSON.stringify({ org_id: (cand as any).org_id, coach_id: stampCoach, client_id: cand.id, estado: "activa" }) }
            );
            if (!createResp.ok) console.error(`[guardar-informe] Failed to ensure assignment: ${createResp.status}`);
          }
        } else {
          console.error(`[guardar-informe] Failed to check assignment: ${assignmentCheck.status}`);
        }
      }
    } catch (e) {
      console.error("[guardar-informe] Failed to ensure assignment:", e);
    }

    return json({ ok: true, email, coach_id: stampCoach || null });
  } catch {
    return json({ error: "write_failed" }, 502);
  }
});
