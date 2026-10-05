// ===================================================================
// eliminar-cuenta.ts — borrar una cuenta DE VERDAD, desde un solo sitio.
//
// LO QUE HABÍA, Y POR QUÉ NO FUNCIONABA (2026-10-02)
// ---------------------------------------------------
// «Eliminar mi cuenta» de panel-v2 llamaba a `schedule-account-deletion`, que
// no podía funcionar por tres motivos independientes:
//   1. el panel comprobaba la contraseña contra `usuarios.password_hash`, que
//      está vacío para quien entró con Google o Apple → «Contraseña incorrecta»;
//   2. la función llamaba al RPC con la SERVICE ROLE y el RPC exigía
//      `auth_id = auth.uid()`, que con service role es NULL → nunca encontraba
//      a nadie;
//   3. aunque programara el borrado, ningún cron ejecuta
//      `execute_account_deletions()`: la cuenta no se borraba nunca.
// Y el borrado de ADMIN (`admin-coach-op` · delete_coach) solo borraba la fila
// de `usuarios`: la identidad de Supabase Auth seguía viva, así que la persona
// podía volver a iniciar sesión y `auth-callback` le recreaba la fila.
//
// LO QUE HACE ESTE MÓDULO
// -----------------------
// Una sola regla de borrado para los dos caminos (la propia persona y el admin):
//   1. PRIMERO la identidad de Auth — todas las que tengan ese email. Es lo que
//      garantiza que no se puede volver a entrar sin registrarse de nuevo. Si
//      no se puede borrar, se ABORTA sin tocar ningún dato (falla cerrado).
//   2. Después los datos, igual que hacía delete_coach.
//   3. La fila de `usuarios`, al final, pidiendo la representación: un DELETE
//      que no borra nada devuelve 2xx igual (R-23 de MultiCoach).
//
// Las funciones puras (decidir, validar el motivo, componer los correos) no
// tocan red: `scripts/probar-eliminar-mi-cuenta.mjs` las ejercita desde node.
// ===================================================================

export type FilaUsuario = {
  id: string;
  email: string | null;
  nombre?: string | null;
  rol?: string | null;
  org_id?: string | null;
  auth_id?: string | null;
  configuracion?: Record<string, unknown> | null;
  created_at?: string | null;
};

export type Deps = {
  sbUrl: string;
  service: string;
  fetch?: typeof fetch;
};

export const SELECT_FILA = "id,email,nombre,rol,org_id,auth_id,configuracion,created_at";

export const WHATSAPP = "34623816019";
export const CORREO_SOPORTE = "hi@pathwaycareercoach.com";

// Las mismas claves que pinta el panel. Lo que no esté aquí se guarda como "otro".
export const MOTIVOS: Record<string, string> = {
  solo_probaba: "Solo estaba probando",
  no_lo_necesito: "Ya no lo necesito",
  muy_caro: "Es muy caro para mí",
  falta_funcion: "Me falta alguna función",
  dificil: "Me resultó difícil de usar",
  otra_herramienta: "Uso otra herramienta",
  otro: "Otro motivo",
};

export function normalizarMotivo(m: unknown): string {
  const k = String(m ?? "").trim();
  return Object.prototype.hasOwnProperty.call(MOTIVOS, k) ? k : "otro";
}

export function normalizarDetalle(d: unknown): string {
  return String(d ?? "").replace(/\s+/g, " ").trim().slice(0, 500);
}

export type Decision =
  | { ok: true; wipe: boolean }
  | { ok: false; error: "cannot_delete_admin" | "es_duena_de_organizacion" };

// Quién puede borrarse a sí mismo, y qué se lleva consigo.
//  · admin → nunca desde aquí: lo hace otra persona admin a mano.
//  · dueña de una organización → no: borrarla deja a su equipo sin dueña. Tiene
//    que transferir la organización o escribirnos.
//  · coach DENTRO de una organización → se borra su cuenta y sus clientes quedan
//    en la organización, sin coach, para que la dueña los reasigne.
//  · coach individual → se borra su cuenta Y sus clientes, informes y CVs: son
//    suyos y no hay nadie más a quien dejárselos.
export function decidirAutoborrado(fila: FilaUsuario, esDuenaDeOrg: boolean): Decision {
  if ((fila.rol || "") === "admin") return { ok: false, error: "cannot_delete_admin" };
  if (esDuenaDeOrg) return { ok: false, error: "es_duena_de_organizacion" };
  return { ok: true, wipe: !fila.org_id };
}

function esc(s: unknown): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function primerNombre(fila: FilaUsuario): string {
  const n = String(fila.nombre || "").trim().split(/\s+/)[0] || "";
  return n;
}

function fechaLarga(d: Date): string {
  const meses = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  return `${d.getUTCDate()} de ${meses[d.getUTCMonth()]} de ${d.getUTCFullYear()}`;
}

// El correo que recibe la persona. Dice tres cosas y ninguna más: que se borró,
// que para volver hay que registrarse de cero, y por dónde hablar si no fue ella.
export function correoDespedida(fila: FilaUsuario, cuando: Date): { subject: string; html: string } {
  const nombre = primerNombre(fila);
  const wa = `https://wa.me/${WHATSAPP}`;
  const html =
    `<!DOCTYPE html><html><body style="font-family:Inter,-apple-system,sans-serif;font-size:14px;line-height:1.6;color:#1B4332;max-width:600px;margin:0 auto;padding:24px;background:#FCFDFC;">` +
    `<h2 style="font-family:Fraunces,Georgia,serif;color:#1B4332;margin:0 0 14px;">Hola${nombre ? " " + esc(nombre) : ""},</h2>` +
    `<p>Te confirmamos que el <strong>${fechaLarga(cuando)}</strong> eliminamos tu cuenta de Pathway y los datos asociados.</p>` +
    `<p>Ya no puedes iniciar sesión con este correo. Si algún día quieres volver, tendrás que <strong>registrarte de nuevo</strong> y empezarás desde cero.</p>` +
    `<p>Gracias por haber probado Pathway. Si no fuiste tú quien pidió esto, o quieres contarnos algo, escríbenos por <a href="${wa}" style="color:#2D6A4F;">WhatsApp</a> o responde a este correo.</p>`
    + `</body></html>`;
  return { subject: "Tu cuenta de Pathway fue eliminada", html };
}

// El aviso interno, para saber quién se fue y por qué.
export function correoAvisoInterno(
  fila: FilaUsuario,
  via: "self" | "admin",
  motivo: string,
  detalle: string,
  wipe: boolean,
): { subject: string; html: string } {
  const cfg = (fila.configuracion || {}) as Record<string, unknown>;
  const filas: Array<[string, string]> = [
    ["Quién", `${fila.nombre || "(sin nombre)"} · ${fila.email || "(sin email)"}`],
    ["Cómo", via === "self" ? "Lo pidió desde su panel" : "Lo eliminó un admin"],
    ["Motivo", MOTIVOS[motivo] || motivo],
    ["Comentario", detalle || "—"],
    ["Plan / estado", `${String(cfg.plan ?? "—")} · ${String(cfg.estado_sub ?? "—")}`],
    ["Organización", fila.org_id ? "pertenecía a una (sus clientes quedaron en ella)" : "ninguna"],
    ["Datos de clientes", wipe ? "borrados" : "conservados sin coach"],
    ["Alta", String(fila.created_at || "—").slice(0, 10)],
  ];
  const html = `<div style="font-family:Inter,sans-serif;font-size:14px;color:#1B2E26"><p><strong>Una cuenta se dio de baja.</strong></p><table style="border-collapse:collapse">` +
    filas.map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#5A6A60">${esc(k)}</td><td style="padding:4px 0">${esc(v)}</td></tr>`).join("") +
    `</table></div>`;
  return { subject: `Baja de cuenta · ${fila.nombre || fila.email || fila.id}`, html };
}

// ── Lo que toca red ─────────────────────────────────────────────────

function hdr(d: Deps): Record<string, string> {
  return { apikey: d.service, Authorization: `Bearer ${d.service}` };
}

function f(d: Deps): typeof fetch {
  return d.fetch || fetch;
}

const PAGINA = 200;
const MAX_PAGINAS = 50;

// Todas las identidades de Auth de esta persona: la ligada a la fila, la del JWT
// y cualquiera con el mismo email (Google y contraseña pueden ser dos). Recorre
// todas las páginas; si no puede consultar, LANZA: sin saber qué identidades hay
// no se puede prometer que no vuelva a entrar.
export async function identidadesDeAuth(d: Deps, fila: FilaUsuario, uidJwt: string | null): Promise<string[]> {
  const ids = new Set<string>();
  if (fila.auth_id) ids.add(String(fila.auth_id));
  if (uidJwt) ids.add(uidJwt);
  const buscado = String(fila.email || "").trim().toLowerCase();
  if (!buscado) return [...ids];
  for (let page = 1; page <= MAX_PAGINAS; page++) {
    const r = await f(d)(`${d.sbUrl}/auth/v1/admin/users?page=${page}&per_page=${PAGINA}`, { headers: hdr(d) });
    if (!r.ok) throw new Error(`auth_lookup_failed_${r.status}`);
    const data = await r.json();
    const lote = (data && data.users) || [];
    if (!Array.isArray(lote)) throw new Error("auth_lookup_shape");
    for (const u of lote) {
      if (String(u.email || "").trim().toLowerCase() === buscado && u.id) ids.add(String(u.id));
    }
    if (lote.length < PAGINA) return [...ids];
  }
  throw new Error("auth_lookup_too_many_pages");
}

export type Resultado =
  | { ok: true; identidades: number }
  | { ok: false; error: string; status?: number };

export async function borrarCuenta(
  d: Deps,
  fila: FilaUsuario,
  opts: { wipe: boolean; uidJwt: string | null },
): Promise<Resultado> {
  // 1 · La identidad de Auth, primero. Si esto falla, no se toca nada más.
  let ids: string[];
  try {
    ids = await identidadesDeAuth(d, fila, opts.uidJwt);
  } catch (e) {
    return { ok: false, error: "auth_lookup_failed", status: 502 };
  }
  for (const id of ids) {
    const r = await f(d)(`${d.sbUrl}/auth/v1/admin/users/${encodeURIComponent(id)}`, { method: "DELETE", headers: hdr(d) })
      .catch(() => null);
    // 404 = ya no existía: es el resultado que queremos.
    if (!r || (!r.ok && r.status !== 404)) return { ok: false, error: "auth_delete_failed", status: 502 };
  }

  // 2 · Los datos, igual que hacía delete_coach (best-effort en los rastros).
  const idq = `coach_id=eq.${encodeURIComponent(fila.id)}`;
  const del = (path: string) =>
    f(d)(`${d.sbUrl}/rest/v1/${path}`, { method: "DELETE", headers: { ...hdr(d), Prefer: "return=minimal" } }).catch(() => null);
  const nullify = (table: string) =>
    f(d)(`${d.sbUrl}/rest/v1/${table}?${idq}`, {
      method: "PATCH",
      headers: { ...hdr(d), "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ coach_id: null }),
    }).catch(() => null);
  await del(`coach_nudges?${idq}`);
  await del(`solicitudes?${idq}`);
  await del(`mensajes_admin_coach?${idq}`);
  if (opts.wipe) {
    await del(`informes?${idq}`);
    await del(`cv_publicados?${idq}`);
    await del(`candidatos?${idq}`);
  } else {
    await nullify("candidatos");
    await nullify("informes");
    await nullify("cv_publicados");
  }

  // 3 · La fila, al final, comprobando que de verdad se fue.
  try {
    const r = await f(d)(`${d.sbUrl}/rest/v1/usuarios?id=eq.${encodeURIComponent(fila.id)}`, {
      method: "DELETE",
      headers: { ...hdr(d), Prefer: "return=representation" },
    });
    if (!r.ok) return { ok: false, error: "delete_failed", status: 502 };
    const rows = await r.json().catch(() => null);
    if (!Array.isArray(rows) || rows.length !== 1) return { ok: false, error: "delete_failed", status: 502 };
  } catch {
    return { ok: false, error: "delete_failed", status: 502 };
  }
  return { ok: true, identidades: ids.length };
}

// Correo vía la función de siempre (Brevo). Best-effort: el borrado ya ocurrió.
export async function enviarCorreo(d: Deps, to: string, toName: string, c: { subject: string; html: string }, firma: "pathway" | "none" = "pathway"): Promise<boolean> {
  if (!to) return false;
  try {
    const r = await f(d)(`${d.sbUrl}/functions/v1/send-email`, {
      method: "POST",
      headers: { ...hdr(d), "Content-Type": "application/json" },
      body: JSON.stringify({ to, to_name: toName, subject: c.subject, html: c.html, reply_to: CORREO_SOPORTE, signature: firma }),
    });
    return r.ok;
  } catch {
    return false;
  }
}

// La baja queda en `eventos` SIN el email: la persona pidió que la borráramos.
export async function registrarBaja(
  d: Deps,
  fila: FilaUsuario,
  datos: { via: "self" | "admin"; motivo: string; detalle: string; wipe: boolean; correo: boolean },
): Promise<void> {
  const cfg = (fila.configuracion || {}) as Record<string, unknown>;
  const alta = fila.created_at ? new Date(fila.created_at) : null;
  const dias = alta && !isNaN(alta.getTime()) ? Math.floor((Date.now() - alta.getTime()) / 86400000) : null;
  await f(d)(`${d.sbUrl}/rest/v1/eventos`, {
    method: "POST",
    headers: { ...hdr(d), "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({
      tipo: "AccountDeleted",
      dominio: "Account",
      actor_rol: fila.rol || null,
      actor_id: fila.id,
      entidad_tipo: "cuenta",
      entidad_id: fila.id,
      payload: {
        via: datos.via,
        motivo: datos.motivo,
        detalle: datos.detalle || null,
        datos_borrados: datos.wipe,
        en_organizacion: !!fila.org_id,
        plan: cfg.plan ?? null,
        estado_sub: cfg.estado_sub ?? null,
        dias_desde_alta: dias,
        correo_enviado: datos.correo,
      },
      source: `server:${datos.via === "self" ? "eliminar-mi-cuenta" : "admin-coach-op"}`,
    }),
  }).catch(() => null);
}
