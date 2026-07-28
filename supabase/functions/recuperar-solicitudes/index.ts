// Supabase Edge Function — recuperar-solicitudes
//
// Recupera candidatos que EMPEZARON a pagar una solicitud de Pathway pero no
// completaron (estado "pendiente"). Solo a los que tenemos email. Dos toques:
//   · ~30 min:  mail con EL LINK para terminar el pago (sigue vivo hasta las 24 h).
//   · ~12 h:    mail suave — que le escriba al coach o agende una llamada gratis.
// Idempotente: marca rec_link_at / rec_call_at para no repetir. El que ya pagó
// (autorizada) o venció no entra. El mail lo manda Pathway → el email del
// candidato NUNCA se expone al coach.
//
// Desplegar:  supabase functions deploy recuperar-solicitudes --no-verify-jwt
// Cron: lo dispara recordatorios.yml (cada ~15 min) con X-Trigger-Secret.
// Secrets (ya existen para otros agentes): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
//   AGENT_TRIGGER_SECRET, STRIPE_SECRET_KEY, BREVO_API_KEY.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, authorization, x-trigger-secret",
};
const STRIPE = "https://api.stripe.com/v1";
const SITE = "https://pathwaycareercoach.com";
const MIN30 = 30 * 60_000;
const H12 = 12 * 3600_000;

interface Sol {
  id: string; coach_id: string | null; candidato_nombre: string | null;
  candidato_email: string | null; servicio: string | null; monto: number | null;
  estado: string; created_at: string; expires_at: string | null;
  stripe_session_id: string | null; stripe_account_id: string | null;
  rec_link_at: string | null; rec_call_at: string | null;
}

function sbH(k: string) { return { apikey: k, Authorization: `Bearer ${k}` }; }
function esc(s: unknown): string {
  return ("" + (s == null ? "" : s)).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
function json(d: unknown, s = 200): Response {
  return new Response(JSON.stringify(d), { status: s, headers: { ...CORS, "content-type": "application/json; charset=utf-8" } });
}
function firstName(n: string | null | undefined): string { const t = ("" + (n || "")).trim(); return t ? t.split(/\s+/)[0] : ""; }

// Botón + shell mínimo (el branding/firma lo agrega send-email con signature:"pathway").
function shell(intro: string, ctaText: string, ctaUrl: string, foot: string): string {
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1B2E26;line-height:1.55">` +
    `<p style="font-size:15px;margin:0 0 18px">${intro}</p>` +
    `<p style="margin:0 0 18px"><a href="${esc(ctaUrl)}" style="display:inline-block;background:#2D6A4F;color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:12px 22px;border-radius:11px">${esc(ctaText)}</a></p>` +
    (foot ? `<p style="font-size:12.5px;color:#8A968E;margin:0">${foot}</p>` : "") + `</div>`;
}

async function stripeGet(path: string, key: string, account?: string): Promise<Record<string, unknown> | null> {
  try {
    const h: Record<string, string> = { Authorization: `Bearer ${key}` };
    if (account) h["Stripe-Account"] = account;
    const r = await fetch(`${STRIPE}${path}`, { headers: h });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}
async function sendEmail(url: string, key: string, to: string, toName: string, subject: string, html: string, replyTo: string): Promise<boolean> {
  try {
    const r = await fetch(`${url}/functions/v1/send-email`, {
      method: "POST",
      headers: { ...sbH(key), "Content-Type": "application/json" },
      body: JSON.stringify({ to, to_name: toName, subject, html, reply_to: replyTo || "hi@pathwaycareercoach.com", signature: "pathway" }),
    });
    return r.ok;
  } catch { return false; }
}
async function mark(url: string, key: string, id: string, patch: Record<string, unknown>) {
  try {
    await fetch(`${url}/rest/v1/solicitudes?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH", headers: { ...sbH(key), "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify(patch),
    });
  } catch { /* si falla el marcado, el próximo cron reintenta */ }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const SB = Deno.env.get("SUPABASE_URL") || "";
  const SRK = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const TRIGGER = Deno.env.get("AGENT_TRIGGER_SECRET") || "";
  const STRIPE_KEY = Deno.env.get("STRIPE_SECRET_KEY") || "";
  if (!SB || !SRK) return json({ error: "supabase_env_missing" }, 500);
  if (!TRIGGER || (req.headers.get("x-trigger-secret") || "") !== TRIGGER) return json({ error: "unauthorized" }, 401);

  const now = Date.now();
  // Solo pendientes VIVAS (dentro de las 24 h) y con email. El vencido no se recupera acá.
  const sel = "id,coach_id,candidato_nombre,candidato_email,servicio,monto,estado,created_at,expires_at,stripe_session_id,stripe_account_id,rec_link_at,rec_call_at";
  const q = `${SB}/rest/v1/solicitudes?select=${sel}&estado=eq.pendiente&candidato_email=not.is.null&order=created_at.desc&limit=100`;
  let sols: Sol[] = [];
  try {
    const r = await fetch(q, { headers: sbH(SRK) });
    if (r.status === 400) return json({ ok: true, enviados: 0, nota: "faltan columnas rec_link_at/rec_call_at (aplicar migración)" });
    if (!r.ok) return json({ error: "query_failed", status: r.status }, 502);
    sols = await r.json();
  } catch { return json({ error: "unreachable" }, 502); }

  const live = sols.filter((s) => !s.expires_at || new Date(s.expires_at).getTime() > now);
  if (!live.length) return json({ ok: true, enviados: 0, revisadas: 0 });

  // Datos de los coaches (nombre + slug + email) para personalizar y el link de llamada.
  const ids = [...new Set(live.map((s) => s.coach_id).filter(Boolean))] as string[];
  const coaches: Record<string, { nombre: string; email: string; slug: string }> = {};
  if (ids.length) {
    try {
      const cr = await fetch(`${SB}/rest/v1/usuarios?id=in.(${ids.map(encodeURIComponent).join(",")})&select=id,nombre,email,configuracion`, { headers: sbH(SRK) });
      if (cr.ok) {
        for (const u of await cr.json()) {
          let slug = ""; try { const cfg = typeof u.configuracion === "string" ? JSON.parse(u.configuracion) : (u.configuracion || {}); slug = cfg && cfg.slug ? String(cfg.slug) : ""; } catch { /* noop */ }
          coaches[String(u.id)] = { nombre: u.nombre || "tu coach", email: u.email || "", slug };
        }
      }
    } catch { /* seguimos sin personalizar */ }
  }

  let enviados = 0;
  for (const s of live) {
    const age = now - new Date(s.created_at).getTime();
    if (isNaN(age)) continue;
    const coach = coaches[String(s.coach_id)] || { nombre: "tu coach", email: "", slug: "" };
    const nm = firstName(s.candidato_nombre);
    const hola = nm ? `Hola ${esc(nm)},` : "Hola,";
    const svc = esc(s.servicio || "tu reserva");
    const callUrl = `${SITE}/reservar.html?c=${encodeURIComponent(String(s.coach_id || ""))}`;

    // ── Toque 2 (~12 h): que escriba o agende una llamada ──
    if (age >= H12 && !s.rec_call_at) {
      const html = shell(
        `${hola}<br><br>Vi que quedó pendiente <strong>${svc}</strong> con <strong>${esc(coach.nombre)}</strong>. Si tenés alguna duda, <strong>respondé este email</strong> y te contesta, o agendá una llamada gratis:`,
        "Agendar una llamada", callUrl,
        "Sin compromiso — es para resolver tus dudas.",
      );
      const ok = await sendEmail(SB, SRK, s.candidato_email!, nm, `¿Seguimos con tu reserva?`, html, coach.email);
      if (ok) { await mark(SB, SRK, s.id, { rec_call_at: new Date().toISOString() }); enviados++; }
      continue; // un mail por corrida y solicitud
    }

    // ── Toque 1 (~30 min): el link para completar el pago ──
    if (age >= MIN30 && !s.rec_link_at) {
      // Recuperar la URL del checkout (sigue viva hasta que la sesión expira).
      let payUrl = "";
      if (STRIPE_KEY && s.stripe_session_id) {
        const sess = await stripeGet(`/checkout/sessions/${s.stripe_session_id}`, STRIPE_KEY, s.stripe_account_id || undefined);
        const st = sess && (sess.status as string);
        if (sess && st === "open" && typeof sess.url === "string") payUrl = sess.url as string;
      }
      if (!payUrl) continue; // sin link vivo no mandamos (evita link roto)
      const html = shell(
        `${hola}<br><br>Empezaste a reservar <strong>${svc}</strong> con <strong>${esc(coach.nombre)}</strong> pero quedó a mitad. Terminá el pago acá:`,
        "Completar el pago", payUrl,
        "El link vence en unas horas. No se te cobra hasta que tu coach acepte.",
      );
      const ok = await sendEmail(SB, SRK, s.candidato_email!, nm, `Casi listo — terminá tu reserva`, html, coach.email);
      if (ok) { await mark(SB, SRK, s.id, { rec_link_at: new Date().toISOString() }); enviados++; }
    }
  }

  return json({ ok: true, enviados, revisadas: live.length });
});
