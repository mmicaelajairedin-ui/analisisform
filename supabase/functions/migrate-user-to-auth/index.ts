// Supabase Edge Function — migrate-user-to-auth
//
// Migración perezosa del auth viejo (SHA-256 custom + localStorage) al
// nuevo (Supabase Auth con JWT). La idea: cuando un usuario entra con
// email+contraseña al login viejo, login.html llama esta función en el
// fondo (best-effort). La función:
//
//   1) RE-VERIFICA las credenciales contra usuarios.password_hash. Si no
//      coinciden, devuelve 401 y no toca nada. Sin este paso, cualquiera
//      podría llamar la función con email+contraseña inventados y
//      registrar al dueño de ese email en Auth (account takeover).
//
//   2) Si no existe en auth.users → lo crea con email_confirm:true (no
//      manda email de confirmación al usuario).
//
//   3) Si ya existe (ej. lo creó el flow de Google OAuth) → actualiza la
//      contraseña para que pueda loguearse con email+password también.
//
//   4) Devuelve el auth_id. login.html lo guarda en usuarios.auth_id.
//
// Después de unos días, la mayoría de los usuarios activos van a tener
// auth_id seteado, y la Fase 2 va a poder migrar el frontend a leer la
// sesión de Supabase Auth en vez de localStorage.
//
// Desplegar:
//   supabase functions deploy migrate-user-to-auth --no-verify-jwt
//
// Env (Supabase Dashboard → Edge Functions → Secrets — auto-inyectadas):
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, authorization, apikey, x-client-info",
};

async function sha256Hex(s: string): Promise<string> {
  const enc = new TextEncoder().encode(s);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "content-type": "application/json; charset=utf-8" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad json" }, 400);
  }
  const email = (body.email || "").trim().toLowerCase();
  const password = body.password || "";
  if (!email || !password) return json({ error: "email_password_required" }, 400);

  const SB_URL = Deno.env.get("SUPABASE_URL") || "";
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!SB_URL || !SERVICE) return json({ error: "env_missing" }, 500);

  const sbHeaders = {
    apikey: SERVICE,
    Authorization: `Bearer ${SERVICE}`,
    "Content-Type": "application/json",
  };

  // 1) RE-VERIFICAR contra la tabla usuarios (legacy SHA-256). Sin esto
  //    cualquiera podría tomar el control de cualquier email.
  let hash: string;
  try {
    hash = await sha256Hex(password);
  } catch {
    return json({ error: "hash_failed" }, 500);
  }
  let legacyId: string | null = null;
  try {
    const r = await fetch(
      `${SB_URL}/rest/v1/usuarios?email=eq.${encodeURIComponent(email)}&password_hash=eq.${hash}&select=id&limit=1`,
      { headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` } },
    );
    if (!r.ok) return json({ error: "verify_failed", status: r.status }, 502);
    const rows = await r.json();
    if (!Array.isArray(rows) || rows.length === 0) {
      return json({ error: "invalid_credentials" }, 401);
    }
    legacyId = rows[0].id;
  } catch (e) {
    return json({ error: "verify_exception", detail: String(e).slice(0, 200) }, 502);
  }

  // 2) Ver si ya existe en auth.users (por email). El endpoint admin de
  //    GoTrue no soporta filtrar por email en todas las versiones, así que
  //    listamos y filtramos. Con la base de usuarios chica de hoy alcanza.
  //    Cuando crezca, conviene paginar o usar el filtro `?email=`.
  let existingAuthId: string | null = null;
  try {
    const r = await fetch(
      `${SB_URL}/auth/v1/admin/users?per_page=200`,
      { headers: sbHeaders },
    );
    if (r.ok) {
      const data = await r.json();
      const list: Array<{ id: string; email?: string }> = (data && data.users) || [];
      const found = list.find(
        (u) => (u.email || "").toLowerCase() === email,
      );
      if (found) existingAuthId = found.id;
    }
  } catch {
    // best-effort
  }

  if (existingAuthId) {
    // 3) Ya existe — setear/actualizar password así puede loguearse con
    //    email+pass (no solo con OAuth si vino de Google originalmente).
    try {
      const r = await fetch(
        `${SB_URL}/auth/v1/admin/users/${existingAuthId}`,
        {
          method: "PUT",
          headers: sbHeaders,
          body: JSON.stringify({ password, email_confirm: true }),
        },
      );
      if (!r.ok) {
        const t = await r.text();
        return json(
          { error: "update_failed", status: r.status, detail: t.slice(0, 300) },
          502,
        );
      }
    } catch (e) {
      return json({ error: "update_exception", detail: String(e).slice(0, 200) }, 502);
    }
    return json({ ok: true, auth_id: existingAuthId, action: "updated_password", legacy_id: legacyId });
  }

  // 4) No existe — crearlo. email_confirm:true evita el email de confirmación.
  try {
    const r = await fetch(`${SB_URL}/auth/v1/admin/users`, {
      method: "POST",
      headers: sbHeaders,
      body: JSON.stringify({ email, password, email_confirm: true }),
    });
    if (!r.ok) {
      const t = await r.text();
      return json(
        { error: "create_failed", status: r.status, detail: t.slice(0, 300) },
        502,
      );
    }
    const u = await r.json();
    return json({ ok: true, auth_id: u.id, action: "created", legacy_id: legacyId });
  } catch (e) {
    return json({ error: "create_exception", detail: String(e).slice(0, 200) }, 502);
  }
});
