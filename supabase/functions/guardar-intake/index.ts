// ===================================================================
// guardar-intake — guarda el formulario de intake del cliente SIN chocar con RLS.
//
// Problema que resuelve: con RLS estricto (rls_strict.sql), un cliente solo puede
// hacer UPDATE de su fila si el email de su JWT == candidatos.email. Si el cliente
// no tiene sesión válida, o su email de Auth no coincide EXACTO con el de la ficha
// que creó el coach, el PATCH del formulario se rechaza en silencio → el portal
// queda "en blanco" (solo el nombre que puso el alta). Pasó con los clientes de
// Charlie.
//
// Esta función corre con SERVICE ROLE (bypassa RLS) y hace un upsert por email de
// SOLO los campos del intake (whitelist). Así el formulario SIEMPRE guarda, exista
// o no la ficha y tenga o no sesión el cliente.
//
// Seguridad: solo escribe si el email pertenece a un usuario real (usuarios) o ya
// tiene ficha (candidatos) → no crea filas para emails al azar. Nunca toca
// coach_id de una ficha que ya lo tiene, ni desactiva, ni borra, ni escribe
// mensajes/notas. Mismo criterio "write-only intake" que la policy anon INSERT.
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// Deploy: supabase functions deploy guardar-intake --no-verify-jwt
// ===================================================================

const SB_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const svc = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` };

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Solo estos campos se pueden escribir desde el intake (whitelist). Nada de
// coach_id/activo/notas_coach/resena/sub_* → los maneja el coach o el sistema.
const ALLOWED = new Set([
  "nombre", "edad", "sexo", "peso", "altura", "cargo", "nivel", "dias", "lugar",
  "lesiones", "medicacion", "restricciones", "foto_perfil", "nicho",
  "situacion", "ingresos", "gastos", "objetivo", "deudas",
  "consent_at", "consent_version",
]);

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  if (!SB_URL || !SERVICE) return json({ error: "env_missing" }, 500);

  let body: { email?: string; data?: Record<string, unknown>; coach_id?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad_json" }, 400);
  }

  const email = (body.email || "").toString().trim().toLowerCase();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: "email_required" }, 400);

  // Whitelist de campos.
  const raw = body.data && typeof body.data === "object" ? body.data : {};
  const fields: Record<string, unknown> = {};
  for (const k of Object.keys(raw)) {
    if (ALLOWED.has(k) && raw[k] != null && raw[k] !== "") fields[k] = raw[k];
  }

  // ¿Existe la ficha? (y de paso su coach_id actual).
  let existing: { id: string; coach_id: string | null } | null = null;
  try {
    const r = await fetch(
      `${SB_URL}/rest/v1/candidatos?email=eq.${encodeURIComponent(email)}&select=id,coach_id&limit=1`,
      { headers: svc },
    );
    if (r.ok) {
      const rows = await r.json();
      if (Array.isArray(rows) && rows.length) existing = rows[0];
    }
  } catch {
    return json({ error: "db_unreachable" }, 502);
  }

  // Gate: solo emails de usuarios/candidatos reales (no crear filas al azar).
  if (!existing) {
    let esUsuario = false;
    try {
      const r = await fetch(
        `${SB_URL}/rest/v1/usuarios?email=eq.${encodeURIComponent(email)}&select=id&limit=1`,
        { headers: svc },
      );
      if (r.ok) {
        const rows = await r.json();
        esUsuario = Array.isArray(rows) && rows.length > 0;
      }
    } catch { /* sigue como no-usuario */ }
    if (!esUsuario) return json({ error: "unknown_email" }, 403);
  }

  const coachId = (body.coach_id || "").toString().trim();
  const validCoach = /^[0-9a-f-]{32,36}$/i.test(coachId) ? coachId : "";

  // El cliente HEREDA la red (org_id) de su coach: así un cliente que carga un
  // coach de un multicoach aparece en el panel del dueño. Coach individual (sin
  // red) → org_id queda null y nada cambia.
  let coachOrg: string | null = null;
  if (validCoach) {
    try {
      const r = await fetch(`${SB_URL}/rest/v1/usuarios?id=eq.${encodeURIComponent(validCoach)}&select=org_id&limit=1`, { headers: svc });
      if (r.ok) { const rows = await r.json(); coachOrg = (Array.isArray(rows) && rows[0] && rows[0].org_id) || null; }
    } catch { /* sin red */ }
  }

  try {
    if (existing) {
      // UPDATE de la ficha existente (service role → sin RLS). Solo whitelist.
      // Adopta coach_id si la ficha estaba huérfana y el form trae uno válido.
      const patch = { ...fields };
      if (!existing.coach_id && validCoach) { (patch as Record<string, unknown>).coach_id = validCoach; if (coachOrg) (patch as Record<string, unknown>).org_id = coachOrg; }
      if (Object.keys(patch).length === 0) return json({ ok: true, id: existing.id, noop: true });
      const r = await fetch(
        `${SB_URL}/rest/v1/candidatos?id=eq.${encodeURIComponent(existing.id)}`,
        { method: "PATCH", headers: { ...svc, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify(patch) },
      );
      if (!r.ok) return json({ error: "update_failed", status: r.status }, 502);
      return json({ ok: true, id: existing.id, mode: "update" });
    } else {
      // INSERT nuevo (cliente sin ficha: se borró o el alta no la creó).
      const ins: Record<string, unknown> = { ...fields, email, activo: true };
      if (validCoach) { ins.coach_id = validCoach; if (coachOrg) ins.org_id = coachOrg; }
      if (ins.semana_activa == null) ins.semana_activa = 1;
      const r = await fetch(
        `${SB_URL}/rest/v1/candidatos`,
        { method: "POST", headers: { ...svc, "Content-Type": "application/json", Prefer: "return=representation" }, body: JSON.stringify(ins) },
      );
      if (!r.ok) return json({ error: "insert_failed", status: r.status }, 502);
      const rows = await r.json();
      const id = Array.isArray(rows) && rows.length ? rows[0].id : null;
      return json({ ok: true, id, mode: "insert" });
    }
  } catch {
    return json({ error: "write_failed" }, 502);
  }
});
