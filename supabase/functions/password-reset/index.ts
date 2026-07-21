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

// ── Email de bienvenida (alta de cliente: "creá tu contraseña y entrá") ──────
// Mismo mecanismo de token que el reset, pero con copy de bienvenida — el
// cliente nunca tuvo contraseña, así que "restablecer" lo confundiría.
async function sendWelcomeEmail(to: string, toName: string, link: string, coachName: string, coachEmail?: string, coachPhoto?: string, coachSlug?: string) {
  const coach = (coachName || "").trim();
  const cEmail = (coachEmail || "").trim();
  const cPhoto = (coachPhoto || "").trim();
  const cSlug = (coachSlug || "").trim();
  const intro = coach
    ? `${coach} te dio acceso a tu espacio en Pathway.`
    : `Te dieron acceso a tu espacio en Pathway.`;
  const html = `
    <p>Hola${toName ? " " + toName : ""},</p>
    <p>${intro} Es tu portal privado para seguir tu proceso paso a paso.</p>
    <p>Para entrar, creá tu contraseña — toma menos de un minuto:</p>
    <p style="margin:24px 0;">
      <a href="${link}" style="display:inline-block;background:#1F5740;color:#fff;
         text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;">
        Crear mi contraseña y entrar
      </a>
    </p>
    <p style="font-size:13px;color:#5A5A55;">
      Este enlace vence en ${TOKEN_TTL_MIN} minutos. Si vence, pedí uno nuevo
      desde "¿Olvidaste tu contraseña?" en la pantalla de acceso.
    </p>
    <p style="font-size:13px;color:#5A5A55;">
      Si el botón no funciona, copiá y pegá este enlace en tu navegador:<br>
      <span style="word-break:break-all;">${link}</span>
    </p>`;
  await fetch(`${SB_URL}/functions/v1/send-email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      to,
      to_name: toName || undefined,
      subject: coach ? `${coach} te dio acceso a tu espacio — entrá a tu sesión` : "Tu acceso a Pathway — entrá a tu sesión",
      html,
      // El cliente conoce a SU coach, no a "Pathway". Mandamos a nombre del coach
      // (más aperturas, menos sensación de spam) PERO desde el dominio autenticado
      // hi@pathwaycareercoach.com (SPF/DKIM ok) — el remitente real no cambia, solo
      // el nombre visible. reply_to al coach para que las respuestas le lleguen a él.
      from_name: coach || "Pathway",
      reply_to: cEmail || undefined,
      // Firma del coach al pie (no la genérica de Pathway) → email personal.
      signature: coach ? "coach" : "pathway",
      // photo = la foto del coach (su cara) para que la firma salga con foto, no
      // con la inicial. slug = link a su web pública. Ver coachSig en send-email.
      coach: coach ? { name: coach, email: cEmail || undefined, photo: cPhoto || undefined, slug: cSlug || undefined } : undefined,
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

  let body: { action?: string; email?: string; token?: string; password?: string; welcome?: boolean; name?: string; coach_name?: string; coach_email?: string; coach_photo?: string; coach_slug?: string };
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
    const lookupUser = async (): Promise<{ nombre?: string } | null> => {
      try {
        const r = await fetch(
          `${SB_URL}/rest/v1/usuarios?email=eq.${encodeURIComponent(email)}&select=id,nombre&limit=1`,
          { headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` } },
        );
        if (r.ok) {
          const rows = await r.json();
          if (Array.isArray(rows) && rows.length) return rows[0];
        }
      } catch { /* best-effort */ }
      return null;
    };
    let user = await lookupUser();

    // Bienvenida (alta de cliente): si el usuario aún NO existe, lo creamos acá con
    // el SERVICE role. Antes dependíamos del INSERT anon del panel, que RLS bloquea
    // → la fila no se creaba, la función no encontraba al usuario y NUNCA mandaba el
    // email (el fallo se tragaba en silencio). Ésa era la causa de "la invitación no
    // llega". Ahora la cuenta se garantiza acá y la invitación SIEMPRE se manda.
    if (!user && body.welcome === true) {
      try {
        const ph = await sha256Hex(randomToken() + email);
        await fetch(`${SB_URL}/rest/v1/usuarios`, {
          method: "POST",
          headers: { ...svcHeaders, Prefer: "return=minimal,resolution=ignore-duplicates" },
          body: JSON.stringify({ email, password_hash: ph, rol: "cliente", nombre: (body.name || "").toString().trim(), activo: true }),
        });
      } catch { /* best-effort */ }
      user = await lookupUser(); // re-consultar (recién creado, o por carrera con el panel)
    }

    let sent = false;
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
        if (body.welcome === true) {
          await sendWelcomeEmail(email, user.nombre || (body.name || "").toString().trim(), link, (body.coach_name || "").toString(), (body.coach_email || "").toString(), (body.coach_photo || "").toString(), (body.coach_slug || "").toString());
        } else {
          await sendResetEmail(email, user.nombre || "", link);
        }
        sent = true;
      } catch {
        // best-effort — no revelamos el detalle, pero sí si se mandó o no (abajo)
      }
    }
    // Devolvemos `sent` para que el panel pueda avisar al coach si la invitación
    // realmente salió (antes siempre decía "ok" aunque no mandara nada).
    return json({ ok: true, sent });
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
