// Supabase Edge Function — send-queued-emails
//
// Lee email_queue, filtra los "pending" cuya fecha ya pasó, y los envía
// vía Brevo Transactional API. Marca como sent / failed y actualiza el
// prospect (estado=contactado, fecha_contacto=now, proximo_followup=+4d).
//
// Desplegar:
//   supabase functions deploy send-queued-emails --no-verify-jwt
//
// Env vars (Supabase Dashboard → Edge Functions → Secrets):
//   BREVO_API_KEY          — key v3 de Brevo (generada en Brevo → SMTP & API)
//
// Trigger: pg_cron cada 10 min (ver SQL que te paso).
// También se puede invocar manualmente para testear:
//   curl -X POST https://<project>.supabase.co/functions/v1/send-queued-emails

interface QueueRow {
  id: number;
  prospecto_id: number | null;
  to_email: string;
  to_nombre: string | null;
  subject: string;
  body: string;
  from_email: string;
  from_nombre: string;
  plantilla_id: string | null;
}

function getSupabaseAuth() {
  const SB_URL = Deno.env.get("SUPABASE_URL") || "";
  const SERVICE_KEY =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
    Deno.env.get("SERVICE_ROLE_KEY") || "";
  return {
    url: SB_URL,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
  };
}

function bodyToHtml(body: string, fromNombre: string, fromEmail: string): string {
  const escaped = body
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Detectar líneas tipo "Unirme directo: https://chat.whatsapp.com/..." y reemplazar
  // por botón verde de WhatsApp. También auto-linkea cualquier otra URL.
  const WA_BTN = /(?:^|\n)([^\n:]*:?\s*)?(https:\/\/chat\.whatsapp\.com\/[A-Za-z0-9_-]+)/g;
  const URL_RE = /(https?:\/\/[^\s<]+)/g;

  let html = escaped;

  // Primero capturamos los links de WhatsApp y los reemplazamos por botón
  html = html.replace(WA_BTN, (match, prefix, url) => {
    const cleanPrefix = (prefix || "").trim();
    const button = `<div style="margin:18px 0;text-align:left;"><a href="${url}" style="display:inline-block;background:#25D366;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;font-size:14px;font-family:Inter,-apple-system,sans-serif;">💬 Unirme a la comunidad</a></div>`;
    // Si había prefijo tipo "Unirme directo:" lo descartamos (el botón ya lo dice)
    return "\n" + button;
  });

  // Auto-linkear el resto de URLs (las que no quedaron dentro de un href)
  html = html.replace(URL_RE, (url) => {
    if (url.includes("chat.whatsapp.com")) return url; // ya fue procesada arriba
    return `<a href="${url}" style="color:#2D6A4F;text-decoration:underline;">${url}</a>`;
  });

  // Convertir saltos de línea a <br>
  html = html.replace(/\n/g, "<br>");

  return `<!DOCTYPE html><html><body style="font-family:Inter,-apple-system,sans-serif;font-size:14px;line-height:1.6;color:#1B4332;max-width:620px;margin:0 auto;padding:20px;">
<div>${html}</div>
<hr style="border:none;border-top:1px solid #e5e5e5;margin:24px 0;">
<table style="border-collapse:collapse;"><tr><td style="padding-right:16px;vertical-align:middle;">
<img src="https://pathwaycareercoach.com/logo-mark.png" width="48" height="48" alt="Pathway" style="display:block;">
</td><td style="vertical-align:middle;">
<div style="font-weight:700;color:#1B4332;">${fromNombre}</div>
<div style="color:#666;font-size:12px;">Plataforma SaaS para coaches de carrera</div>
<div style="margin-top:6px;font-size:12px;">
<a href="https://pathwaycareercoach.com" style="color:#2D6A4F;text-decoration:none;">pathwaycareercoach.com</a>
&nbsp;·&nbsp;
<a href="mailto:${fromEmail}" style="color:#2D6A4F;text-decoration:none;">${fromEmail}</a>
</div>
</td></tr></table>
</body></html>`;
}

async function sendViaBrevo(row: QueueRow): Promise<{ ok: boolean; error?: string }> {
  const BREVO_KEY = Deno.env.get("BREVO_API_KEY") || "";
  if (!BREVO_KEY) return { ok: false, error: "BREVO_API_KEY no configurada" };

  const payload = {
    sender: { email: row.from_email, name: row.from_nombre },
    to: [{ email: row.to_email, name: row.to_nombre || row.to_email }],
    subject: row.subject,
    htmlContent: bodyToHtml(row.body, row.from_nombre, row.from_email),
    textContent: row.body,
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
    if (r.ok) return { ok: true };
    const txt = await r.text();
    return { ok: false, error: `Brevo ${r.status}: ${txt.slice(0, 300)}` };
  } catch (e) {
    return { ok: false, error: String(e).slice(0, 300) };
  }
}

async function markRow(
  id: number,
  patch: Record<string, unknown>,
) {
  const { url, headers } = getSupabaseAuth();
  await fetch(`${url}/rest/v1/email_queue?id=eq.${id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(patch),
  });
}

async function updateProspect(id: number) {
  const { url, headers } = getSupabaseAuth();
  const fu = new Date();
  fu.setDate(fu.getDate() + 4);
  await fetch(`${url}/rest/v1/prospectos?id=eq.${id}&estado=eq.pendiente`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      estado: "contactado",
      fecha_contacto: new Date().toISOString(),
      proximo_followup: fu.toISOString().slice(0, 10),
    }),
  });
}

Deno.serve(async (_req: Request) => {
  const { url, headers } = getSupabaseAuth();

  // Traemos pendientes cuya scheduled_at ya pasó (hasta 50 por corrida)
  const nowIso = new Date().toISOString();
  const qUrl =
    `${url}/rest/v1/email_queue?status=eq.pending&scheduled_at=lte.${encodeURIComponent(nowIso)}` +
    `&select=*&order=scheduled_at.asc&limit=50`;
  const qRes = await fetch(qUrl, { headers: { ...headers, Prefer: "" } });
  if (!qRes.ok) {
    return new Response(
      JSON.stringify({ ok: false, error: `query ${qRes.status}` }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
  const rows: QueueRow[] = await qRes.json();

  const results: Array<{ id: number; ok: boolean; error?: string }> = [];
  for (const row of rows) {
    // Lock pesimista: marcar como "sending" para que si el cron corre 2x
    // no se envíe 2 veces. Si el UPDATE no tocó filas (otro lo tomó), skip.
    const lockRes = await fetch(
      `${url}/rest/v1/email_queue?id=eq.${row.id}&status=eq.pending`,
      {
        method: "PATCH",
        headers: { ...headers, Prefer: "return=representation" },
        body: JSON.stringify({ status: "sending" }),
      },
    );
    const lockRows = lockRes.ok ? await lockRes.json() : [];
    if (!Array.isArray(lockRows) || lockRows.length === 0) continue;

    const r = await sendViaBrevo(row);
    if (r.ok) {
      await markRow(row.id, {
        status: "sent",
        sent_at: new Date().toISOString(),
        error_msg: null,
      });
      if (row.prospecto_id) await updateProspect(row.prospecto_id);
      results.push({ id: row.id, ok: true });
    } else {
      await markRow(row.id, {
        status: "failed",
        error_msg: r.error || "unknown",
      });
      results.push({ id: row.id, ok: false, error: r.error });
    }
  }

  return new Response(
    JSON.stringify({ ok: true, processed: results.length, results }),
    { headers: { "Content-Type": "application/json" } },
  );
});
