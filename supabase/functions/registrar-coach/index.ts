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
// Body: { email, password_hash, nombre, nombre_practica?, bio?, foto_url?, configuracion? }
// Respuesta: { ok, mode:'created'|'activated', id, email, rol, nombre, activo, configuracion } | { error }
//
// Env (auto-inyectadas): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// Deploy: supabase functions deploy registrar-coach --no-verify-jwt
// ===================================================================

const SB_URL = Deno.env.get("SUPABASE_URL") || "";
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

// Devuelve la fila sin exponer password_hash.
function safeRow(r: Record<string, unknown>) {
  return { id: r.id, email: r.email, rol: r.rol, nombre: r.nombre, activo: r.activo, configuracion: r.configuracion };
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
  type Urow = { id: string; email: string; rol: string; nombre: string | null; activo: boolean; password_hash: string | null; configuracion: Record<string, unknown> | null };
  let rows: Urow[] = [];
  try {
    const r = await fetch(
      `${SB_URL}/rest/v1/usuarios?email=eq.${encodeURIComponent(email)}&select=id,email,rol,nombre,activo,password_hash,configuracion`,
      { headers: svc },
    );
    if (!r.ok) return json({ error: "lookup_failed", status: r.status }, 502);
    rows = await r.json();
  } catch { return json({ error: "db_unreachable" }, 502); }

  const existing = (rows && rows[0]) || null;

  // Email ya en uso por una cuenta CON contraseña (coach activo o cliente) → no pisar.
  if (existing && existing.password_hash) {
    return json({ error: "email_taken", rol: existing.rol || "?" }, 409);
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

  // ── Activar una fila INVITADA (existe sin contraseña) → PATCH ───────────────
  if (existing && !existing.password_hash) {
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
  try {
    const r = await fetch(
      `${SB_URL}/rest/v1/usuarios?select=id,email,rol,nombre,activo,configuracion`,
      { method: "POST", headers: { ...svc, "Content-Type": "application/json", Prefer: "return=representation" },
        body: JSON.stringify({ ...commonFields, configuracion: cfg }) },
    );
    if (!r.ok) return json({ error: "insert_failed", status: r.status }, 502);
    const out = await r.json();
    return json({ ok: true, mode: "created", ...safeRow((out && out[0]) || {}) });
  } catch { return json({ error: "write_failed" }, 502); }
});
