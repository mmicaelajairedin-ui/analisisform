// Supabase Edge Function — send-email
//
// Función reusable para enviar emails vía Brevo Transactional API.
// La usan: panel.html (notificar al cliente cuando se genera informe/CV),
// registro.html (avisar al admin cuando alguien se registra), etc.
//
// Desplegar:
//   supabase functions deploy send-email --no-verify-jwt
//
// Env vars requeridas (Supabase → Edge Functions → Secrets):
//   BREVO_API_KEY — v3 API key de Brevo (xkeysib-...)
//
// Uso desde el frontend:
//   fetch(SB+'/functions/v1/send-email', {
//     method:'POST',
//     headers:{'Content-Type':'application/json'},
//     body: JSON.stringify({
//       to: 'destino@mail.com',
//       to_name: 'Nombre Destino',
//       subject: 'Asunto',
//       html: '<p>Contenido HTML</p>',
//       reply_to: 'hi@pathwaycareercoach.com' // opcional
//     })
//   });

interface EmailPayload {
  to: string;
  to_name?: string;
  subject: string;
  html?: string;
  text?: string;
  from_email?: string;
  from_name?: string;
  reply_to?: string;
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, authorization",
};

function wrapHtml(innerHtml: string): string {
  return `<!DOCTYPE html><html><body style="font-family:Inter,-apple-system,sans-serif;font-size:14px;line-height:1.6;color:#1B4332;max-width:620px;margin:0 auto;padding:24px;background:#FAFDF9;">
<div style="background:#fff;border-radius:14px;padding:28px 24px;box-shadow:0 2px 12px rgba(27,46,38,.04);">
${innerHtml}
</div>
<hr style="border:none;border-top:1px solid #e5e5e5;margin:24px 0;">
<table style="border-collapse:collapse;width:100%;"><tr><td style="padding-right:14px;vertical-align:middle;width:56px;">
<img src="https://pathwaycareercoach.com/logo-mark.png" width="48" height="48" alt="Pathway" style="display:block;border-radius:8px;">
</td><td style="vertical-align:middle;">
<div style="font-weight:700;color:#1B4332;font-size:15px;">Pathway</div>
<div style="color:#666;font-size:12px;">Plataforma SaaS para coaches de carrera</div>
<div style="margin-top:6px;font-size:12px;">
<a href="https://pathwaycareercoach.com" style="color:#2D6A4F;text-decoration:none;">pathwaycareercoach.com</a>
&nbsp;·&nbsp;
<a href="mailto:hi@pathwaycareercoach.com" style="color:#2D6A4F;text-decoration:none;">hi@pathwaycareercoach.com</a>
</div>
</td></tr></table>
</body></html>`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "POST only" }), {
      status: 405,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const BREVO_KEY = Deno.env.get("BREVO_API_KEY") || "";
  if (!BREVO_KEY) {
    return new Response(
      JSON.stringify({ ok: false, error: "BREVO_API_KEY no configurada" }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  }

  let body: EmailPayload;
  try {
    body = await req.json();
  } catch (_e) {
    return new Response(JSON.stringify({ ok: false, error: "JSON inválido" }), {
      status: 400,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  if (!body.to || !body.subject || (!body.html && !body.text)) {
    return new Response(
      JSON.stringify({ ok: false, error: "faltan campos (to, subject, html/text)" }),
      { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  }

  const fromEmail = body.from_email || "hi@pathwaycareercoach.com";
  const fromName = body.from_name || "Pathway";

  const payload: Record<string, unknown> = {
    sender: { email: fromEmail, name: fromName },
    to: [{ email: body.to, name: body.to_name || body.to }],
    subject: body.subject,
  };
  if (body.html) payload.htmlContent = wrapHtml(body.html);
  if (body.text) payload.textContent = body.text;
  if (body.reply_to) payload.replyTo = { email: body.reply_to };

  try {
    const r = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": BREVO_KEY,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (r.ok) {
      const j = await r.json().catch(() => ({}));
      return new Response(JSON.stringify({ ok: true, id: j.messageId || null }), {
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
    const txt = await r.text();
    return new Response(
      JSON.stringify({ ok: false, status: r.status, error: txt.slice(0, 400) }),
      { status: 502, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: String(e).slice(0, 300) }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  }
});
