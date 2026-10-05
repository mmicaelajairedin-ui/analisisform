// ===================================================================
// eliminar-mi-cuenta — la propia persona borra su cuenta, al momento.
//
// POST { confirmacion: "ELIMINAR", motivo?, detalle? }
//   200 { ok: true, correo_enviado }
//   400 confirmacion_requerida · 401 no_session · 404 usuario_no_encontrado
//   403 cannot_delete_admin | es_duena_de_organizacion
//   502 auth_lookup_failed | auth_delete_failed | delete_failed
//
// Sustituye a `schedule-account-deletion`, que no podía funcionar (ver
// _shared/cuenta/eliminar-cuenta.ts). La identidad sale SOLO del JWT: el cuerpo
// no dice a quién borrar, así que nadie puede borrar la cuenta de otra persona.
// No pide contraseña: quien entró con Google no tiene, y la sesión ya prueba
// quién es. La confirmación es escribir ELIMINAR, también comprobada aquí.
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY
// Deploy: supabase functions deploy eliminar-mi-cuenta --no-verify-jwt
// ===================================================================

import {
  borrarCuenta, correoAvisoInterno, correoDespedida, CORREO_SOPORTE, decidirAutoborrado,
  enviarCorreo, type FilaUsuario, normalizarDetalle, normalizarMotivo, registrarBaja, SELECT_FILA,
} from "../_shared/cuenta/eliminar-cuenta.ts";

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

async function quienLlama(token: string): Promise<{ email: string | null; uid: string | null }> {
  if (!token || token === ANON) return { email: null, uid: null };
  try {
    const r = await fetch(`${SB_URL}/auth/v1/user`, { headers: { apikey: ANON, Authorization: `Bearer ${token}` } });
    if (!r.ok) return { email: null, uid: null };
    const u = await r.json();
    const em = String(u?.email || "").trim().toLowerCase();
    const uid = String(u?.id || "").trim();
    return { email: EMAIL_RE.test(em) ? em : null, uid: uid || null };
  } catch {
    return { email: null, uid: null };
  }
}

// R-24: por auth_id con respaldo por email. El email se compara EXACTO en código:
// `ilike` trata `_` y `%` como comodines y podría casar con otra persona.
async function filaPropia(uid: string | null, email: string | null): Promise<FilaUsuario | null> {
  const ors: string[] = [];
  if (uid) ors.push(`auth_id.eq.${uid}`);
  if (email) ors.push(`email.ilike.${email}`);
  if (!ors.length) return null;
  const r = await fetch(
    `${SB_URL}/rest/v1/usuarios?or=(${encodeURIComponent(ors.join(","))})&select=${SELECT_FILA}&limit=10`,
    { headers: svc },
  );
  if (!r.ok) throw new Error(`usuarios_${r.status}`);
  const rows = (await r.json()) as FilaUsuario[];
  if (!Array.isArray(rows)) return null;
  const porAuth = uid ? rows.find((x) => x.auth_id === uid) : undefined;
  if (porAuth) return porAuth;
  const porEmail = rows.filter((x) => String(x.email || "").trim().toLowerCase() === email);
  return porEmail.length === 1 ? porEmail[0] : null;
}

async function esDuenaDeOrg(fila: FilaUsuario): Promise<boolean> {
  if ((fila.rol || "") === "owner" && fila.org_id) return true;
  const r = await fetch(
    `${SB_URL}/rest/v1/organizaciones?owner_id=eq.${encodeURIComponent(fila.id)}&select=id,activo&limit=5`,
    { headers: svc },
  );
  if (!r.ok) throw new Error(`organizaciones_${r.status}`);
  const rows = await r.json();
  return Array.isArray(rows) && rows.some((o: { activo?: boolean }) => o.activo !== false);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "post_only" }, 405);
  if (!SB_URL || !SERVICE || !ANON) return json({ error: "env_missing" }, 500);

  let body: { confirmacion?: string; motivo?: string; detalle?: string };
  try { body = await req.json(); } catch { return json({ error: "bad_json" }, 400); }
  if (String(body.confirmacion || "").trim().toUpperCase() !== "ELIMINAR") {
    return json({ error: "confirmacion_requerida" }, 400);
  }

  const auth = req.headers.get("Authorization") || req.headers.get("authorization") || "";
  const who = await quienLlama(auth.replace(/^Bearer\s+/i, "").trim());
  if (!who.uid && !who.email) return json({ error: "no_session" }, 401);

  let fila: FilaUsuario | null;
  let duena: boolean;
  try {
    fila = await filaPropia(who.uid, who.email);
    if (!fila) return json({ error: "usuario_no_encontrado" }, 404);
    duena = await esDuenaDeOrg(fila);
  } catch {
    return json({ error: "db_unreachable" }, 502);
  }

  const decision = decidirAutoborrado(fila, duena);
  if (!decision.ok) return json({ error: decision.error }, 403);

  const deps = { sbUrl: SB_URL, service: SERVICE };
  const res = await borrarCuenta(deps, fila, { wipe: decision.wipe, uidJwt: who.uid });
  if (!res.ok) return json({ error: res.error }, res.status || 502);

  const motivo = normalizarMotivo(body.motivo);
  const detalle = normalizarDetalle(body.detalle);
  const correo = await enviarCorreo(deps, String(fila.email || ""), String(fila.nombre || ""), correoDespedida(fila, new Date()));
  await enviarCorreo(deps, CORREO_SOPORTE, "Pathway", correoAvisoInterno(fila, "self", motivo, detalle, decision.wipe), "none");
  await registrarBaja(deps, fila, { via: "self", motivo, detalle, wipe: decision.wipe, correo });

  return json({ ok: true, correo_enviado: correo });
});
