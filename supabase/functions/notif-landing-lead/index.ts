// Supabase Edge Function — notif-landing-lead
//
// La llama el form del chat flotante de la landing cuando alguien deja
// sus datos. Hace dos cosas:
//   1) Manda un email de confirmación al lead (si dejó un email válido).
//   2) Manda un email de notificación a la admin (Mica) con los datos
//      del lead + mensaje, para que la pueda contactar por el canal
//      que ella elija.
//
// Los recipientes están controlados acá adentro (la admin es hardcoded
// vía env ADMIN_EMAIL, fallback mmicaela.jairedin@gmail.com). El frontend
// solo pasa nombre/contacto/mensaje — no puede setear destinatarios
// arbitrarios, así que la función no es vector de spam.
//
// Despliegue (auto vía .github/workflows/deploy-functions.yml):
//   supabase functions deploy notif-landing-lead --no-verify-jwt
//
// Body de la request:
//   { nombre: "string", contacto: "email o teléfono", mensaje: "opcional" }
//
// Env vars (auto-inyectadas en Supabase):
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   ADMIN_EMAIL (opcional, fallback mmicaela.jairedin@gmail.com)

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

  let body: { nombre?: string; contacto?: string; mensaje?: string; tipo?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad_json" }, 400);
  }
  const nombre = (body.nombre || "").trim().slice(0, 100);
  const contacto = (body.contacto || "").trim().slice(0, 200);
  const mensaje = (body.mensaje || "").trim().slice(0, 1000);
  // tipo: "coach" (quiere demo) | "candidato" (busca trabajo) | "" (general)
  const tipoRaw = (body.tipo || "").trim().toLowerCase();
  const tipo: "coach" | "candidato" | "" =
    tipoRaw === "coach" ? "coach" : tipoRaw === "candidato" ? "candidato" : "";
  if (!nombre || !contacto) return json({ error: "nombre_contacto_required" }, 400);

  const SB_URL = Deno.env.get("SUPABASE_URL") || "";
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const ADMIN_EMAIL = (Deno.env.get("ADMIN_EMAIL") || "mmicaela.jairedin@gmail.com").trim();
  if (!SB_URL || !SERVICE) return json({ error: "env_missing" }, 500);

  const leadIsEmail = isEmail(contacto);
  const firstName = nombre.split(/\s+/)[0] || nombre;

  // ── Email para la admin (Mica) ────────────────────────────────
  const tipoLbl = tipo === "coach"
    ? "COACH (quiere demo)"
    : tipo === "candidato" ? "CANDIDATO (busca trabajo)" : "Lead general";
  const adminSubject = `Nuevo lead ${tipoLbl}: ${nombre}`;
  const replyTo = leadIsEmail ? contacto : "";
  const tipoBanner = tipo === "coach"
    ? `<div style="display:inline-block;background:#2D6A4F;color:#fff;font-size:11px;font-weight:700;padding:4px 10px;border-radius:99px;letter-spacing:.4px;text-transform:uppercase;">Coach · Quiere demo</div>`
    : tipo === "candidato"
      ? `<div style="display:inline-block;background:#8C7B80;color:#fff;font-size:11px;font-weight:700;padding:4px 10px;border-radius:99px;letter-spacing:.4px;text-transform:uppercase;">Candidato · Busca trabajo</div>`
      : "";
  const adminHtml = `
<h2 style="font-family:Fraunces,Georgia,serif;font-weight:500;color:#1B4332;margin:0 0 14px;">Nuevo lead desde la landing</h2>
${tipoBanner ? `<div style="margin:0 0 14px;">${tipoBanner}</div>` : ""}
<p style="margin:0 0 14px;color:#3A4A40;">Alguien dejó sus datos en el chat flotante de pathwaycareercoach.com.</p>
<div style="background:#fff;border:1px solid rgba(45,106,79,.14);border-radius:12px;padding:16px 18px;margin:14px 0;">
  <div style="font-size:16px;font-weight:700;color:#1B4332;">${escH(nombre)}</div>
  <div style="font-size:13px;color:#5A6A60;margin-top:4px;">${escH(contacto)}</div>
  ${mensaje ? `<div style="margin-top:12px;padding-top:12px;border-top:1px solid rgba(45,106,79,.08);font-size:13.5px;color:#3A4A40;line-height:1.55;white-space:pre-wrap;">${escH(mensaje)}</div>` : ""}
</div>
${leadIsEmail
  ? `<p style="margin:18px 0 0;"><a href="mailto:${escH(contacto)}?subject=${encodeURIComponent("Re: tu mensaje a Pathway")}" style="display:inline-block;padding:12px 24px;background:#2D6A4F;color:#fff;border-radius:10px;text-decoration:none;font-weight:700;">Responder por email →</a></p>`
  : `<p style="font-size:13px;color:#5A6A60;margin-top:14px;">No dejó un email — el contacto puede ser un teléfono.</p>`}
<p style="font-size:12px;color:#888;margin-top:18px;">También podés ver todos los leads en Admin → Contactos del chatbot.</p>
`;

  const sendOne = (to: string, toName: string, subject: string, html: string, replyTo?: string) =>
    fetch(`${SB_URL}/functions/v1/send-email`, {
      method: "POST",
      headers: {
        apikey: SERVICE,
        Authorization: `Bearer ${SERVICE}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to,
        to_name: toName,
        subject,
        html,
        signature: "pathway",
        reply_to: replyTo || undefined,
      }),
    });

  const tasks: Promise<unknown>[] = [];

  // Notificar a la admin
  tasks.push(
    sendOne(ADMIN_EMAIL, "Micaela", adminSubject, adminHtml, replyTo)
      .then((r) => r.ok ? { admin: "sent" } : r.text().then((t) => ({ admin: "failed", status: r.status, detail: t.slice(0, 200) })))
      .catch((e) => ({ admin: "exception", detail: String(e).slice(0, 200) })),
  );

  // Confirmación al lead (solo si dejó un email válido)
  let leadResult: unknown = { lead: "skipped_no_email" };
  if (leadIsEmail) {
    const DEMO_URL = "https://calendly.com/mmicaela-jairedin/pathway-demo";
    const COACHES_URL = "https://pathwaycareercoach.com/coaches.html";
    let leadSubject = "";
    let leadHtml = "";
    const mensajeBlock = mensaje
      ? `<div style="background:#fff;border:1px solid rgba(45,106,79,.10);border-radius:10px;padding:12px 14px;margin:16px 0;font-size:13.5px;color:#5A6A60;line-height:1.55;font-style:italic;white-space:pre-wrap;">Tu mensaje: "${escH(mensaje)}"</div>`
      : "";
    if (tipo === "coach") {
      // COACH: querés mostrar Pathway → demo Calendly directa.
      leadSubject = `Hola ${firstName}, agendemos tu demo · Pathway`;
      leadHtml = `
<p style="margin:0 0 14px;color:#1B2E26;font-size:16px;">¡Hola ${escH(firstName)}! 😊</p>
<p style="margin:0 0 14px;color:#3A4A40;line-height:1.65;">Vi que querés conocer <strong>Pathway</strong>. Te puedo mostrar la plataforma en una <strong>demo de 11 minutos</strong>: te enseño cómo funciona, qué problemas resuelve y vemos si encaja con lo que estás buscando para tu negocio.</p>
${mensajeBlock}
<p style="margin:18px 0;">
  <a href="${DEMO_URL}" style="display:inline-block;padding:13px 26px;background:#2D6A4F;color:#fff;border-radius:10px;text-decoration:none;font-weight:700;font-family:Inter,sans-serif;">📅 Agendá tu demo</a>
</p>
<p style="margin:18px 0 6px;color:#3A4A40;line-height:1.65;font-size:13.5px;">Si preferís, respondeme este email y te respondo con la info que necesites.</p>
<p style="margin:14px 0 6px;color:#3A4A40;line-height:1.65;">Saludos,</p>
<p style="margin:0;color:#1B4332;font-weight:600;">Micaela</p>
`;
    } else if (tipo === "candidato") {
      // CANDIDATO: no centralizar en Mica. Mandarlo al directorio de coaches.
      leadSubject = `Hola ${firstName}, encontrá tu coach · Pathway`;
      leadHtml = `
<p style="margin:0 0 14px;color:#1B2E26;font-size:16px;">¡Hola ${escH(firstName)}! 😊</p>
<p style="margin:0 0 14px;color:#3A4A40;line-height:1.65;">Vi que estás buscando trabajo. Pathway es la plataforma donde están los <strong>coaches de carrera</strong> — ellos son los que te acompañan uno a uno en tu proceso.</p>
<p style="margin:0 0 14px;color:#3A4A40;line-height:1.65;">Acá podés ver los coaches disponibles y elegir el que más te encaje (cada uno tiene su perfil, su forma de trabajar y reseñas reales):</p>
${mensajeBlock}
<p style="margin:18px 0;">
  <a href="${COACHES_URL}" style="display:inline-block;padding:13px 26px;background:#2D6A4F;color:#fff;border-radius:10px;text-decoration:none;font-weight:700;font-family:Inter,sans-serif;">🔍 Ver coaches disponibles</a>
</p>
<p style="margin:18px 0 6px;color:#3A4A40;line-height:1.65;font-size:13.5px;">Si ninguno te convence o tenés una duda, respondeme este email y te ayudo.</p>
<p style="margin:14px 0 6px;color:#3A4A40;line-height:1.65;">Saludos,</p>
<p style="margin:0;color:#1B4332;font-weight:600;">Micaela</p>
`;
    } else {
      // Fallback genérico (sin tipo)
      leadSubject = `Hola ${firstName}, recibí tu mensaje · Pathway`;
      leadHtml = `
<p style="margin:0 0 14px;color:#1B2E26;font-size:16px;">¡Hola ${escH(firstName)}! 😊</p>
<p style="margin:0 0 14px;color:#3A4A40;line-height:1.65;">Recibí tu mensaje sobre <strong>Pathway</strong> y te respondo pronto a este email.</p>
${mensajeBlock}
<p style="margin:14px 0 6px;color:#3A4A40;line-height:1.65;">Saludos,</p>
<p style="margin:0;color:#1B4332;font-weight:600;">Micaela</p>
`;
    }
    tasks.push(
      sendOne(contacto, firstName, leadSubject, leadHtml)
        .then((r) => r.ok ? { lead: "sent" } : r.text().then((t) => ({ lead: "failed", status: r.status, detail: t.slice(0, 200) })))
        .catch((e) => ({ lead: "exception", detail: String(e).slice(0, 200) })),
    );
  } else {
    tasks.push(Promise.resolve(leadResult));
  }

  const results = await Promise.all(tasks);
  return json({ ok: true, results });
});
