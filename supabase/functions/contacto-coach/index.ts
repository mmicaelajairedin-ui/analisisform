// Supabase Edge Function — contacto-coach
//
// La llama el modal "Contactar" del perfil público del coach
// (coach.html → /coach/<slug>). Es el canal de contacto INTERNO de
// Pathway: el lead escribe un mensaje y le llega al coach por email
// (con reply-to al lead), más una confirmación al lead. Así el primer
// contacto queda dentro de Pathway (no se va directo a WhatsApp/Calendly).
//
// El frontend solo pasa coach_id/slug + nombre/email/mensaje. El email
// del coach se resuelve acá con la service role key (no se expone al
// navegador), así que la función no es vector de spam ni filtra emails.
//
// Body de la request:
//   { coach_id?: string, slug?: string, nombre: string, email: string, mensaje: string }
//
// Despliegue:
//   supabase functions deploy contacto-coach --no-verify-jwt
//
// Env vars (auto-inyectadas en Supabase):
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, authorization, apikey, x-client-info",
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "content-type": "application/json; charset=utf-8" },
  });
}

function escH(s: unknown): string {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function isEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  let body: { coach_id?: string; slug?: string; nombre?: string; email?: string; mensaje?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad_json" }, 400);
  }

  const coachId = (body.coach_id || "").trim();
  const slug = (body.slug || "").trim().toLowerCase();
  const nombre = (body.nombre || "").trim().slice(0, 100);
  const email = (body.email || "").trim().slice(0, 200);
  const mensaje = (body.mensaje || "").trim().slice(0, 1000);

  if (!nombre || !email || !mensaje) return json({ error: "campos_requeridos" }, 400);
  if (!isEmail(email)) return json({ error: "email_invalido" }, 400);
  if (!coachId && !slug) return json({ error: "coach_requerido" }, 400);

  const SB_URL = (Deno.env.get("SUPABASE_URL") || "").replace(/\/+$/, "");
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!SB_URL || !SERVICE) return json({ error: "env_missing" }, 500);

  const sbHeaders = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` };

  // ── Resolver el coach (email + nombre) con service role ──────────
  let coachQuery = "";
  if (coachId) {
    coachQuery = `${SB_URL}/rest/v1/usuarios?id=eq.${encodeURIComponent(coachId)}&select=id,nombre,email&limit=1`;
  } else {
    coachQuery = `${SB_URL}/rest/v1/usuarios?slug=eq.${encodeURIComponent(slug)}&select=id,nombre,email&limit=1`;
  }
  let coach: { id?: string; nombre?: string; email?: string } | null = null;
  try {
    const r = await fetch(coachQuery, { headers: sbHeaders });
    if (r.ok) {
      const rows = await r.json();
      if (Array.isArray(rows) && rows.length) coach = rows[0];
    }
    // Fallback: slug guardado en configuracion
    if (!coach && slug) {
      const r2 = await fetch(
        `${SB_URL}/rest/v1/usuarios?configuracion->>slug=eq.${encodeURIComponent(slug)}&select=id,nombre,email&limit=1`,
        { headers: sbHeaders },
      );
      if (r2.ok) {
        const rows = await r2.json();
        if (Array.isArray(rows) && rows.length) coach = rows[0];
      }
    }
  } catch (_e) {
    return json({ error: "lookup_failed" }, 502);
  }

  if (!coach || !coach.email) return json({ error: "coach_no_encontrado" }, 404);

  const coachFirst = (coach.nombre || "").split(/\s+/)[0] || "coach";
  const leadFirst = nombre.split(/\s+/)[0] || nombre;

  // ── Registrar el lead en contactos_chat (lo ve la admin en Contactos) ──
  // Reusa el formato "Nombre · email → SOLICITA coach: <nombre> [<id>]" que el
  // panel ya parsea y muestra como "Pidió coach". Así el contacto queda como
  // solicitud, no solo como email.
  const contactoTxt = `${nombre} · ${email} → SOLICITA coach: ${coach.nombre || "coach"} [${coach.id || coachId}]`;
  const logTask = fetch(`${SB_URL}/rest/v1/contactos_chat`, {
    method: "POST",
    headers: { ...sbHeaders, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ contacto: contactoTxt, pagina: "contacto-coach" }),
  }).then((r) => r.ok ? { log: "saved" } : { log: "failed", status: r.status })
    .catch((e) => ({ log: "exception", detail: String(e).slice(0, 120) }));

  // ── Crear la solicitud tipo "mensaje" (la ve el coach en su panel) ────
  // estado='mensaje', monto/comisión 0 → no entra al flujo de pago de Stripe
  // (aceptar/rechazar). El panel la muestra como contacto, con responder.
  const solTask = fetch(`${SB_URL}/rest/v1/solicitudes`, {
    method: "POST",
    headers: { ...sbHeaders, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({
      coach_id: coach.id || coachId,
      candidato_nombre: nombre,
      candidato_email: email,
      servicio: "mensaje",
      mensaje: mensaje,
      monto: 0,
      comision: 0,
      estado: "mensaje",
      created_at: new Date().toISOString(),
    }),
  }).then((r) => r.ok ? { sol: "saved" } : r.text().then((t) => ({ sol: "failed", status: r.status, detail: t.slice(0, 160) })))
    .catch((e) => ({ sol: "exception", detail: String(e).slice(0, 120) }));


  const sendOne = (to: string, toName: string, subject: string, html: string, replyTo?: string) =>
    fetch(`${SB_URL}/functions/v1/send-email`, {
      method: "POST",
      headers: { ...sbHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({
        to,
        to_name: toName,
        subject,
        html,
        signature: "pathway",
        reply_to: replyTo || undefined,
      }),
    });

  // ── Email para el coach ──────────────────────────────────────────
  const coachSubject = `💬 ${nombre} te escribió desde tu perfil en Pathway`;
  const coachHtml = `
<h2 style="font-family:Fraunces,Georgia,serif;font-weight:500;color:#1B4332;margin:0 0 14px;">Tienes un mensaje nuevo</h2>
<p style="margin:0 0 14px;color:#3A4A40;">Alguien te escribió desde tu perfil público en Pathway.</p>
<div style="background:#fff;border:1px solid rgba(45,106,79,.14);border-radius:12px;padding:16px 18px;margin:14px 0;">
  <div style="font-size:16px;font-weight:700;color:#1B4332;">${escH(nombre)}</div>
  <div style="font-size:13px;color:#5A6A60;margin-top:4px;">${escH(email)}</div>
  <div style="margin-top:12px;padding-top:12px;border-top:1px solid rgba(45,106,79,.08);font-size:13.5px;color:#3A4A40;line-height:1.55;white-space:pre-wrap;">${escH(mensaje)}</div>
</div>
<p style="margin:18px 0 0;"><a href="mailto:${escH(email)}?subject=${encodeURIComponent("Re: tu mensaje en Pathway")}" style="display:inline-block;padding:12px 24px;background:#2D6A4F;color:#fff;border-radius:10px;text-decoration:none;font-weight:700;">Responder →</a></p>
<p style="font-size:12px;color:#888;margin-top:18px;">Respondé directo a este email y le llega a ${escH(leadFirst)}.</p>
`;

  // ── Confirmación para el lead ─────────────────────────────────────
  const leadSubject = `Tu mensaje a ${coachFirst} · Pathway`;
  const leadHtml = `
<p style="margin:0 0 14px;color:#1B2E26;font-size:16px;">¡Hola ${escH(leadFirst)}! 😊</p>
<p style="margin:0 0 14px;color:#3A4A40;line-height:1.65;">Recibimos tu mensaje para <strong>${escH(coach.nombre || "tu coach")}</strong> y ya se lo hicimos llegar. Te va a responder a este email.</p>
<div style="background:#fff;border:1px solid rgba(45,106,79,.10);border-radius:10px;padding:12px 14px;margin:16px 0;font-size:13.5px;color:#5A6A60;line-height:1.55;font-style:italic;white-space:pre-wrap;">Tu mensaje: "${escH(mensaje)}"</div>
<p style="margin:14px 0 6px;color:#3A4A40;line-height:1.65;">Saludos,</p>
<p style="margin:0;color:#1B4332;font-weight:600;">El equipo de Pathway</p>
`;

  const results = await Promise.all([
    logTask,
    solTask,
    sendOne(coach.email, coach.nombre || "Coach", coachSubject, coachHtml, email)
      .then((r) => r.ok ? { coach: "sent" } : r.text().then((t) => ({ coach: "failed", status: r.status, detail: t.slice(0, 200) })))
      .catch((e) => ({ coach: "exception", detail: String(e).slice(0, 200) })),
    sendOne(email, leadFirst, leadSubject, leadHtml)
      .then((r) => r.ok ? { lead: "sent" } : r.text().then((t) => ({ lead: "failed", status: r.status, detail: t.slice(0, 200) })))
      .catch((e) => ({ lead: "exception", detail: String(e).slice(0, 200) })),
  ]);

  return json({ ok: true, results });
});
