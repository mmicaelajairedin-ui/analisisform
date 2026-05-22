// Supabase Edge Function — send-email
//
// Función reusable para enviar emails vía Brevo Transactional API.
// La usan: panel-v2.html (notificar al cliente cuando se genera informe/CV),
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

interface CoachSig {
  name?: string;
  email?: string;
  slug?: string;
  photo?: string;
  logo?: string;   // logo del coach (white-label) — solo se usa si pro=true
  pro?: boolean;   // plan Pro → marca del coach; Standard → marca Pathway
}

interface EmailPayload {
  to: string;
  to_name?: string;
  subject: string;
  html?: string;
  text?: string;
  from_email?: string;
  from_name?: string;
  reply_to?: string;
  // Firma a añadir al pie. Una sola firma por email:
  //   "pathway" (default) → firma de Pathway
  //   "coach"             → firma del coach (usa el objeto `coach`)
  //   "none"              → el html ya trae su propia firma, no añadir nada
  signature?: "pathway" | "coach" | "none";
  coach?: CoachSig;
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, authorization",
};

// Verde Pathway oscuro — usado como color de marca en emails.
const PW_GREEN = "#1F5740";

function escAttr(s: unknown): string {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Firma de Pathway (emails enviados por la plataforma).
function pathwaySig(): string {
  return `<hr style="border:none;border-top:1px solid #e5e5e5;margin:24px 0;">
<table style="border-collapse:collapse;width:100%;"><tr><td style="padding-right:14px;vertical-align:middle;width:56px;">
<img src="https://pathwaycareercoach.com/logo-mark.png" width="48" height="48" alt="Pathway" style="display:block;border-radius:8px;">
</td><td style="vertical-align:middle;">
<div style="font-weight:700;color:${PW_GREEN};font-size:15px;">Pathway</div>
<div style="color:#666;font-size:12px;">Plataforma SaaS para coaches de carrera</div>
<div style="margin-top:6px;font-size:12px;">
<a href="https://pathwaycareercoach.com" style="color:${PW_GREEN};text-decoration:none;">pathwaycareercoach.com</a>
&nbsp;·&nbsp;
<a href="mailto:hi@pathwaycareercoach.com" style="color:${PW_GREEN};text-decoration:none;">hi@pathwaycareercoach.com</a>
</div>
</td></tr></table>`;
}

// Firma del coach (emails que el coach manda a su cliente). Si el coach no
// tiene foto, mostramos un avatar con su inicial. Apunta a su web pública
// pathwaycareercoach.com/coach/{slug} (o al dominio raíz si no hay slug).
function coachSig(c: CoachSig): string {
  const nm = (c.name || "Tu coach").trim();
  const em = (c.email || "").trim();
  const slug = (c.slug || "").trim();
  const photo = (c.photo || "").trim();
  const web = slug ? `pathwaycareercoach.com/coach/${slug}` : "pathwaycareercoach.com";
  const webHref = slug ? `https://pathwaycareercoach.com/coach/${slug}` : "https://pathwaycareercoach.com";
  const initial = (nm.charAt(0) || "·").toUpperCase();
  const logo = (c.logo || "").trim();
  const pro = !!c.pro;
  const avatar = photo
    ? `<img src="${escAttr(photo)}" width="48" height="48" alt="${escAttr(nm)}" style="display:block;border-radius:50%;width:48px;height:48px;object-fit:cover;">`
    : `<div style="width:48px;height:48px;border-radius:50%;background:${PW_GREEN};color:#fff;font-weight:700;font-size:20px;line-height:48px;text-align:center;">${escAttr(initial)}</div>`;
  // Marca al pie: Pro con logo → white-label (logo del coach, sin Pathway).
  // Standard (o Pro sin logo) → "Powered by Pathway".
  const brand = (pro && logo)
    ? `<div style="margin-top:14px;"><img src="${escAttr(logo)}" alt="${escAttr(nm)}" style="height:26px;max-width:160px;object-fit:contain;display:block;"></div>`
    : `<div style="margin-top:14px;font-size:11px;color:#999;">
<a href="https://pathwaycareercoach.com" style="color:#999;text-decoration:none;">
<img src="https://pathwaycareercoach.com/logo-mark.png" width="14" height="14" alt="Pathway" style="vertical-align:middle;border-radius:3px;margin-right:5px;">Powered by Pathway</a>
</div>`;
  return `<hr style="border:none;border-top:1px solid #e5e5e5;margin:24px 0;">
<table style="border-collapse:collapse;width:100%;"><tr><td style="padding-right:14px;vertical-align:middle;width:56px;">
${avatar}
</td><td style="vertical-align:middle;">
<div style="font-weight:700;color:${PW_GREEN};font-size:15px;">${escAttr(nm)}</div>
<div style="color:#666;font-size:12px;">Career Coach</div>
<div style="margin-top:6px;font-size:12px;">
<a href="${escAttr(webHref)}" style="color:${PW_GREEN};text-decoration:none;">${escAttr(web)}</a>${
    em ? `&nbsp;·&nbsp;<a href="mailto:${escAttr(em)}" style="color:${PW_GREEN};text-decoration:none;">${escAttr(em)}</a>` : ""
  }
</div>
</td></tr></table>
${brand}`;
}

function wrapHtml(
  innerHtml: string,
  signature: "pathway" | "coach" | "none",
  coach?: CoachSig,
): string {
  let sig = "";
  if (signature === "pathway") sig = pathwaySig();
  else if (signature === "coach") sig = coachSig(coach || {});
  // signature === "none" → el html ya trae su firma; no añadir nada.
  return `<!DOCTYPE html><html><body style="font-family:Inter,-apple-system,sans-serif;font-size:14px;line-height:1.6;color:${PW_GREEN};max-width:620px;margin:0 auto;padding:24px;background:#FAFDF9;">
<div style="background:#fff;border-radius:14px;padding:28px 24px;box-shadow:0 2px 12px rgba(27,46,38,.04);">
${innerHtml}
</div>
${sig}
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
  if (body.html) {
    const sig = body.signature || "pathway";
    payload.htmlContent = wrapHtml(body.html, sig, body.coach);
  }
  // Microsoft (Hotmail/Outlook) prioriza correos multipart con alternativa
  // de texto plano. Si no vino text, lo derivamos del html.
  if (body.text) {
    payload.textContent = body.text;
  } else if (body.html) {
    payload.textContent = body.html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|h[1-6]|li)>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }
  if (body.reply_to) payload.replyTo = { email: body.reply_to };
  // List-Unsubscribe mejora la entregabilidad en Microsoft/Gmail.
  payload.headers = {
    "List-Unsubscribe": "<mailto:hi@pathwaycareercoach.com?subject=unsubscribe>",
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };

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
