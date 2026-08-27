// ===================================================================
// registrar-coach — AUTO-registro de un coach (trial gratis) SIN chocar con RLS.
//
// Problema que resuelve: con la Fase 5 (usuarios_hardening.sql), las policies de
// INSERT de `usuarios` solo permiten a anon crear filas rol='cliente'. El
// registro por email/contraseña (registro.html) hace POST anon con rol='coach'
// → 403 → "Error al crear la cuenta". Esta función corre con SERVICE ROLE
// (bypassa RLS) y crea/activa la fila del coach de forma segura.
//
// Es PÚBLICA (no requiere sesión: quien se registra todavía no tiene cuenta).
// El anti-abuso es el MISMO que ya tenía el registro abierto: la cuenta nace
// email_verificado=false y el panel bloquea las features caras (IA) hasta que la
// persona verifica su email. La función NO abre ninguna puerta nueva respecto
// del registro anónimo que ya existía; solo lo hace compatible con RLS y encima
// SANITIZA campos peligrosos que un cliente no debería poder setear.
//
// RC-14 — quién puede reclamar un email:
// Esta función es pública, así que el guard de "email ya tomado" es lo único
// que separa un alta legítima de una toma de control. Ese guard NO puede
// deducirse de `password_hash IS NULL`: `migrate-user-to-auth` vacía ese campo
// al migrar a Auth, y desde entonces una cuenta viva parece una invitación
// pendiente. La regla vive en `_shared/auth/estado-cuenta.ts` (con el detalle
// de las tres rutas que cierra) y la señal decisiva es si YA existe una
// identidad de Auth para ese email.
//
// Body: { email, password_hash, nombre, nombre_practica?, bio?, foto_url?, configuracion? }
// Respuesta: { ok, mode:'created'|'activated', id, email, rol, nombre, activo, configuracion } | { error }
//
// Env (auto-inyectadas): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// Deploy: supabase functions deploy registrar-coach --no-verify-jwt
// ===================================================================

import { estadoCuenta } from "../_shared/auth/estado-cuenta.ts";

const SB_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const svc = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` };
const authAdmin = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" };

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// Devuelve la fila sin exponer password_hash.
function safeRow(r: Record<string, unknown>) {
  return { id: r.id, email: r.email, rol: r.rol, nombre: r.nombre, activo: r.activo, configuracion: r.configuracion };
}

// ── Event Store (Pathway OS) — emite un evento server-side (best-effort). ──
// Espejo server de pw-events.js. NUNCA rompe el flujo. Ref: eventos.sql.
async function emitEvento(ev: Record<string, unknown>): Promise<void> {
  try {
    await fetch(`${SB_URL}/rest/v1/eventos`, {
      method: "POST",
      headers: { ...svc, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ source: "server", ...ev }),
    });
  } catch { /* best-effort, jamás bloquea */ }
}

// ── RC-14 — ¿existe ya una identidad de Auth con este email? ───────────────
// Es la señal que decide si el email está tomado (ver _shared/auth/estado-cuenta.ts).
//
// FALLA CERRADO A PROPÓSITO: si el admin API no responde, lanza. Quien llama lo
// traduce en 503 y NO activa ni crea nada. Un atacante que consiga tumbar esta
// consulta no debe obtener por ello el permiso de reclamar un email ajeno; el
// coste es que un alta legítima se pospone mientras GoTrue no responda.
//
// Pagina de verdad: `migrate-user-to-auth` mira solo la primera página de 200,
// lo que a partir del usuario 201 daría un falso "no existe". Para un guard de
// seguridad eso no sirve, así que recorremos hasta agotar.
const AUTH_PAGE_SIZE = 200;
const AUTH_MAX_PAGES = 50; // 10.000 identidades; más que eso → fallamos cerrado.

async function identidadAuthExiste(email: string): Promise<boolean> {
  const buscado = email.trim().toLowerCase();
  for (let page = 1; page <= AUTH_MAX_PAGES; page++) {
    let lote: Array<{ email?: string }>;
    try {
      const r = await fetch(
        `${SB_URL}/auth/v1/admin/users?page=${page}&per_page=${AUTH_PAGE_SIZE}`,
        { headers: authAdmin },
      );
      if (!r.ok) throw new Error(`admin_users_${r.status}`);
      const data = await r.json();
      lote = (data && data.users) || [];
      if (!Array.isArray(lote)) throw new Error("admin_users_shape");
    } catch (e) {
      throw new Error(`auth_lookup_failed: ${String(e).slice(0, 120)}`);
    }
    for (const u of lote) {
      if ((u.email || "").trim().toLowerCase() === buscado) return true;
    }
    if (lote.length < AUTH_PAGE_SIZE) return false; // última página, no está
  }
  throw new Error("auth_lookup_failed: too_many_pages");
}

// Quita del configuracion que manda el cliente los campos que NO puede setear él
// (privilegios / marcas internas). El resto (plan, estado_sub, fecha_fin_prueba,
// coach_type, verification_token, referred_by, from_popup…) se conserva: es el
// mismo comportamiento que ya tenía el registro abierto, y el plan real lo fija
// el webhook de Stripe al pagar. Lo verdaderamente peligroso es es_pro_vitalicio
// (Pro gratis para siempre, ignora cancelaciones de Stripe) y las marcas de admin.
function sanitizeCfg(input: unknown): Record<string, unknown> {
  const cfg: Record<string, unknown> = (input && typeof input === "object" && !Array.isArray(input))
    ? { ...(input as Record<string, unknown>) } : {};
  delete cfg.es_pro_vitalicio;
  delete cfg.creado_por_admin;
  delete cfg.creado_por;
  // La cuenta siempre nace sin verificar (anti-abuso). Si el cliente no mandó
  // token, no pasa nada; el panel/verify.html lo maneja.
  cfg.email_verificado = false;
  return cfg;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "post_only" }, 405);
  if (!SERVICE) return json({ error: "service_key_missing" }, 500);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "bad_json" }, 400); }

  const email = (body.email || "").toString().replace(/\s+/g, "").toLowerCase();
  if (!EMAIL_RE.test(email)) return json({ error: "email_invalid" }, 400);
  const passwordHash = (body.password_hash || "").toString();
  if (!passwordHash) return json({ error: "password_required" }, 400);
  const nombre = (body.nombre || "").toString().trim();
  if (!nombre) return json({ error: "nombre_required" }, 400);
  const cfg = sanitizeCfg(body.configuracion);

  // ── ¿Ya existe ese email? ──────────────────────────────────────────────────
  type Urow = { id: string; email: string; rol: string; nombre: string | null; activo: boolean; password_hash: string | null; auth_id: string | null; configuracion: Record<string, unknown> | null };
  let rows: Urow[] = [];
  try {
    const r = await fetch(
      `${SB_URL}/rest/v1/usuarios?email=eq.${encodeURIComponent(email)}&select=id,email,rol,nombre,activo,password_hash,auth_id,configuracion`,
      { headers: svc },
    );
    if (!r.ok) return json({ error: "lookup_failed", status: r.status }, 502);
    rows = await r.json();
  } catch { return json({ error: "db_unreachable" }, 502); }

  const existing = (rows && rows[0]) || null;

  // ── RC-14 — guard de "email ya tomado" ─────────────────────────────────────
  // La pregunta NO es "¿tiene password_hash?" sino "¿ya hay una credencial
  // detrás de este email?". Incluye la identidad de Auth, porque es lo único
  // que `migrate-user-to-auth` necesita para acabar cambiando una contraseña.
  let existeEnAuth: boolean;
  try {
    existeEnAuth = await identidadAuthExiste(email);
  } catch {
    // Falla cerrado: sin poder comprobarlo, no reclamamos ningún email.
    return json({ error: "auth_lookup_failed" }, 503);
  }

  const estado = estadoCuenta(existing, existeEnAuth);
  if (estado === "provisionada") {
    return json({ error: "email_taken", rol: (existing && existing.rol) || "?" }, 409);
  }

  const commonFields = {
    email,
    password_hash: passwordHash,
    rol: "coach",
    activo: true,
    nombre,
    nombre_practica: (body.nombre_practica || nombre).toString().trim() || nombre,
    bio: body.bio != null ? String(body.bio) : null,
    foto_url: body.foto_url != null ? String(body.foto_url) : null,
  };

  // ── Activar una fila INVITADA → PATCH ──────────────────────────────────────
  // `estado === 'invitada'` garantiza: sin password_hash, sin auth_id y sin
  // identidad de Auth. Es decir, una fila que creó un alta privilegiada
  // (crear-coach / agregar-coach-red / admin) y que nadie reclamó todavía.
  if (estado === "invitada" && existing) {
    // Conservar lo que puso el admin al invitar (días de acceso, marca de origen).
    const prev = (existing.configuracion && typeof existing.configuracion === "object") ? existing.configuracion as Record<string, unknown> : {};
    const merged = { ...cfg };
    if (prev.fecha_fin_prueba) merged.fecha_fin_prueba = prev.fecha_fin_prueba;
    if (prev.creado_por_admin) merged.creado_por_admin = prev.creado_por_admin;
    try {
      const r = await fetch(
        `${SB_URL}/rest/v1/usuarios?id=eq.${encodeURIComponent(existing.id)}&select=id,email,rol,nombre,activo,configuracion`,
        { method: "PATCH", headers: { ...svc, "Content-Type": "application/json", Prefer: "return=representation" },
          body: JSON.stringify({ ...commonFields, configuracion: merged }) },
      );
      if (!r.ok) return json({ error: "activate_failed", status: r.status }, 502);
      const out = await r.json();
      return json({ ok: true, mode: "activated", ...safeRow((out && out[0]) || {}) });
    } catch { return json({ error: "write_failed" }, 502); }
  }

  // ── Coach NUEVO → INSERT ────────────────────────────────────────────────────
  // Solo se llega con estado 'libre' (sin fila y sin identidad de Auth): el
  // 'provisionada' devolvió 409 y el 'invitada' devolvió arriba. El cinturón
  // extra es para que un refactor futuro no pueda colar un INSERT sobre un
  // email que ya tiene fila.
  if (existing) return json({ error: "email_taken", rol: existing.rol || "?" }, 409);
  try {
    const r = await fetch(
      `${SB_URL}/rest/v1/usuarios?select=id,email,rol,nombre,activo,configuracion`,
      { method: "POST", headers: { ...svc, "Content-Type": "application/json", Prefer: "return=representation" },
        body: JSON.stringify({ ...commonFields, configuracion: cfg }) },
    );
    if (!r.ok) return json({ error: "insert_failed", status: r.status }, 502);
    const out = await r.json();
    const nuevo = (out && out[0]) || {};
    // Embudo: arranca la prueba del coach (auto-registro desde la web). En el
    // path 'activated' NO se emite: ese coach fue invitado y crear-coach ya
    // registró su TrialStarted — emitir de nuevo lo contaría doble.
    await emitEvento({ tipo: "TrialStarted", dominio: "Billing", actor_email: email, actor_rol: "coach", actor_id: nuevo.id ? String(nuevo.id) : null, entidad_tipo: "coach", entidad_id: email, page: "registrar-coach", payload: { via: "self" } });
    return json({ ok: true, mode: "created", ...safeRow(nuevo) });
  } catch { return json({ error: "write_failed" }, 502); }
});
