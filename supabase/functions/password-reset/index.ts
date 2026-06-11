// Supabase Edge Function — password-reset
//
// Recuperación de contraseña para coaches y clientes. NO depende del SMTP de
// Supabase Auth (poco confiable / rate-limited): manda el email vía Brevo
// reutilizando la function `send-email`.
//
// Detalle clave: el login (login.html) valida contra `usuarios.password_hash`
// (SHA-256 custom), y Supabase Auth corre en paralelo. Por eso el "confirm"
// actualiza AMBOS: usuarios.password_hash (fuente de verdad del login viejo) y,
// best-effort, la contraseña en auth.users (para la migración a Supabase Auth).
//
// Dos acciones (POST JSON):
//   { action:"request", email }                  → manda el email con el link
//   { action:"confirm", email, token, password } → setea la nueva contraseña
//
// "request" siempre responde { ok:true } aunque el email no exista, para no
// filtrar qué emails están registrados (email enumeration).
//
// Desplegar:
//   supabase functions deploy password-reset --no-verify-jwt
//
// Env (auto-inyectadas + Brevo, ya configurada para send-email):
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, authorization, apikey, x-client-info",
};

const BASE = "https://pathwaycareercoach.com";
const TOKEN_TTL_MIN = 60; // el link vale 1 hora

async function sha256Hex(s: string): Promise<string> {
  const enc = new TextEncoder().encode(s);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "content-type": "application/json; charset=utf-8" },
  });
}

const SB_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const svcHeaders = {
  apikey: SERVICE,
  Authorization: `Bearer ${SERVICE}`,
  "Content-Type": "application/json",
};

// ── Email de recuperación (Brevo vía send-email) ────────────────────────────
async function sendResetEmail(to: string, toName: string, link: string) {
  const html = `
    <p>Hola${toName ? " " + toName : ""},</p>
    <p>Recibimos un pedido para restablecer la contraseña de tu cuenta en Pathway.</p>
    <p style="margin:24px 0;">
      <a href="${link}" style="display:inline-block;background:#1F5740;color:#fff;
         text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;">
        Crear nueva contraseña
      </a>
    </p>
    <p style="font-size:13px;color:#5A5A55;">
      Este enlace vence en ${TOKEN_TTL_MIN} minutos. Si no pediste esto,
      ignora este email — tu contraseña no cambia.
    </p>
    <p style="font-size:13px;color:#5A5A55;">
      Si el botón no funciona, copia y pega este enlace en tu navegador:<br>
      <span style="word-break:break-all;">${link}</span>
    </p>`;
  await fetch(`${SB_URL}/functions/v1/send-email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      to,
      to_name: toName || undefined,
      subject: "Restablecer tu contraseña — Pathway",
      html,
      signature: "pathway",
    }),
  });
}

// ── Sincronizar la contraseña en auth.users (best-effort) ───────────────────
// Si el usuario ya está en Supabase Auth, le actualizamos la contraseña; si no
// existe, lo creamos. No es crítico: el login viejo usa usuarios.password_hash.
async function syncAuthPassword(email: string, password: string) {
  try {
    let authId: string | null = null;
    const r = await fetch(`${SB_URL}/auth/v1/admin/users?per_page=200`, {
      headers: svcHeaders,
    });
    if (r.ok) {
      const data = await r.json();
      const list: Array<{ id: string; email?: string }> = (data && data.users) || [];
      const found = list.find((u) => (u.email || "").toLowerCase() === email);
      if (found) authId = found.id;
    }
    if (authId) {
      await fetch(`${SB_URL}/auth/v1/admin/users/${authId}`, {
        method: "PUT",
        headers: svcHeaders,
        body: JSON.stringify({ password, email_confirm: true }),
      });
    } else {
      await fetch(`${SB_URL}/auth/v1/admin/users`, {
        method: "POST",
        headers: svcHeaders,
        body: JSON.stringify({ email, password, email_confirm: true }),
      });
    }
  } catch {
    // best-effort
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  if (!SB_URL || !SERVICE) return json({ error: "env_missing" }, 500);

  let body: { action?: string; email?: string; token?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad_json" }, 400);
  }

  const action = body.action || "";
  const email = (body.email || "").trim().toLowerCase();
  if (!email) return json({ error: "email_required" }, 400);

  // ── REQUEST ───────────────────────────────────────────────────────────────
  if (action === "request") {
    // Buscar el usuario. Si no existe, igual devolvemos ok (no revelar).
    let user: { nombre?: string } | null = null;
    try {
      const r = await fetch(
        `${SB_URL}/rest/v1/usuarios?email=eq.${encodeURIComponent(email)}&select=id,nombre&limit=1`,
        { headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` } },
      );
      if (r.ok) {
        const rows = await r.json();
        if (Array.isArray(rows) && rows.length) user = rows[0];
      }
    } catch {
      // best-effort
    }

    if (user) {
      const token = randomToken();
      const tokenHash = await sha256Hex(token);
      const expiresAt = new Date(Date.now() + TOKEN_TTL_MIN * 60 * 1000).toISOString();
      try {
        await fetch(`${SB_URL}/rest/v1/password_resets`, {
          method: "POST",
          headers: { ...svcHeaders, Prefer: "return=minimal" },
          body: JSON.stringify({ email, token_hash: tokenHash, expires_at: expiresAt }),
        });
        const link = `${BASE}/recuperar-password.html?token=${token}&email=${encodeURIComponent(email)}`;
        await sendResetEmail(email, user.nombre || "", link);
      } catch {
        // best-effort — no revelamos el fallo
      }
    }
    return json({ ok: true });
  }

  // ── CONFIRM ─────────────────────────────────────────────────────────────────
  if (action === "confirm") {
    const token = body.token || "";
    const password = body.password || "";
    if (!token || !password) return json({ error: "token_password_required" }, 400);
    if (password.length < 6) return json({ error: "password_too_short" }, 400);

    const tokenHash = await sha256Hex(token);
    const nowIso = new Date().toISOString();

    // Validar token: existe, mismo email, no usado, no vencido.
    let resetRow: { id: number } | null = null;
    try {
      const r = await fetch(
        `${SB_URL}/rest/v1/password_resets?email=eq.${encodeURIComponent(email)}` +
          `&token_hash=eq.${tokenHash}&used=eq.false&expires_at=gt.${encodeURIComponent(nowIso)}` +
          `&select=id&order=id.desc&limit=1`,
        { headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` } },
      );
      if (r.ok) {
        const rows = await r.json();
        if (Array.isArray(rows) && rows.length) resetRow = rows[0];
      }
    } catch {
      // cae al invalid de abajo
    }
    if (!resetRow) return json({ error: "invalid_or_expired" }, 400);

    // 1) Actualizar usuarios.password_hash (fuente de verdad del login viejo).
    try {
      const newHash = await sha256Hex(password);
      const r = await fetch(
        `${SB_URL}/rest/v1/usuarios?email=eq.${encodeURIComponent(email)}`,
        {
          method: "PATCH",
          headers: { ...svcHeaders, Prefer: "return=minimal" },
          body: JSON.stringify({ password_hash: newHash }),
        },
      );
      if (!r.ok) {
        const t = await r.text();
        return json({ error: "update_failed", detail: t.slice(0, 200) }, 502);
      }
    } catch (e) {
      return json({ error: "update_exception", detail: String(e).slice(0, 200) }, 502);
    }

    // 2) Sincronizar Supabase Auth (best-effort, no bloquea).
    await syncAuthPassword(email, password);

    // 3) Quemar el token (one-time use).
    try {
      await fetch(
        `${SB_URL}/rest/v1/password_resets?id=eq.${resetRow.id}`,
        {
          method: "PATCH",
          headers: { ...svcHeaders, Prefer: "return=minimal" },
          body: JSON.stringify({ used: true }),
        },
      );
    } catch {
      // best-effort
    }

    return json({ ok: true });
  }

  return json({ error: "unknown_action" }, 400);
});
