// coach-lifecycle — secuencia de bienvenida + retención automática para coaches.
//
// (1) ONBOARDING por TIEMPO desde el alta (created_at) — 4 emails diseñados,
//     cada uno UNA sola vez, para coaches que se registraron hace <= 30 días:
//       +1 d  → Bienvenida         (onb_bienvenida)
//       +5 d  → Referidos (+15 d)  (onb_referido)
//       +9 d  → Funcionalidades    (onb_funciones)
//       +14 d → Review             (onb_review)
// (2) RENOVACIÓN por vencimiento de la prueba (keyed a fecha_fin_prueba de CADA
//     coach → respeta 14 / 15 / 30 días). Solo a coaches que NO pagaron:
//       trial_por_vencer    — faltan <=3 d para vencer
//       trial_vencido       — el día que vence (+ aviso admin_trial_vencido a Micaela)
//       trial_vencido_2     — recordatorio ~3 d después
//     El CTA va DIRECTO al Stripe del plan que ya tenía, con email precargado →
//     reactiva su MISMA cuenta (webhook matchea por email), no crea una nueva.
// (3) RETENCIÓN por comportamiento:
//       reactivacion       — >=14 d sin entrar (con clientes o pagante)
//       admin_churn_alert  — si además es PAGANTE → aviso a Micaela
//
// Prioridad: renovación > onboarding > retención.
// Máx 1 empujón por coach por corrida (anti-spam vía coach_nudges; nunca dos en
// menos de 3 días). Respeta opt-out (configuracion.notifs.lifecycle === false) y
// la baja del pie de cada email (function unsubscribe). Admin / pro vitalicio: skip.
//
// Disparo: GitHub Actions cron diario (.github/workflows/coach-lifecycle.yml)
// header X-Trigger-Secret = AGENT_TRIGGER_SECRET.
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, AGENT_TRIGGER_SECRET, ADMIN_EMAIL(opt).
// Deploy: supabase functions deploy coach-lifecycle --no-verify-jwt

const HOST = "https://pathwaycareercoach.com";
const PANEL_URL = HOST + "/panel-v2.html";
const GO_CLIENTES = PANEL_URL + "?go=clientes";
const PUBLIC_API = "https://api.pathwaycareercoach.com"; // dominio público de las functions (baja)
const REPLY_TO = "hi@pathwaycareercoach.com";
const DAY = 24 * 60 * 60 * 1000;
// Stripe: links de pago por plan. La renovación va DIRECTO acá (no a registro.html),
// con el email del coach precargado → paga en 1 clic y el webhook reactiva su MISMA
// cuenta (match por email), sin crear una cuenta nueva ni pedirle datos de vuelta.
const STRIPE_BASIC = "https://buy.stripe.com/00waEX3Qke8gczqge78AE0d"; // $29/mes
const STRIPE_PRO = "https://buy.stripe.com/eVq5kD86Ae8geHy1jd8AE0e"; // $59/mes
// Link de renovación al plan que ya tenía el coach, con su email precargado.
function renewUrl(plan, email) {
  const base = plan === "pro" ? STRIPE_PRO : STRIPE_BASIC;
  return base + "?prefilled_email=" + encodeURIComponent(String(email || ""));
}
// Arranque del onboarding: SOLO coaches registrados desde esta fecha reciben la
// secuencia de bienvenida (no retroactivo). Para incluir a alguien anterior,
// bajar esta fecha; para pausar, subirla al futuro.
const ONBOARDING_FROM_TS = Date.parse("2026-07-12T00:00:00Z");

function esc(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function P(t) {
  return `<p style="font-family:Arial,sans-serif;font-size:15px;color:#40584C;line-height:1.65;text-align:center;margin:0 0 26px;">${t}</p>`;
}
// Plantilla simple (solo la usa la retención: reactivacion / aviso admin).
function emailHtml(primer, icon, iconBg, inner, ctaText, ctaUrl, footer, extraCta) {
  const foot = footer || "Recibes esto porque tienes tu cuenta de coach en Pathway. ¿No quieres estos recordatorios? Responde este mail y los damos de baja. 💚";
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#EAF1ED;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EAF1ED;padding:26px 12px;"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
<tr><td style="background:#2D6A4F;border-radius:16px 16px 0 0;padding:20px 28px;text-align:center;">
<span style="font-family:Georgia,serif;font-size:21px;color:#ffffff;font-weight:600;letter-spacing:-.5px;">Pathway <span style="color:#95D5B2;">&bull;</span></span>
</td></tr>
<tr><td style="background:#ffffff;padding:34px 34px 30px;border-left:1px solid #E3EFE8;border-right:1px solid #E3EFE8;">
${icon ? `<div style="width:58px;height:58px;line-height:58px;text-align:center;background:${iconBg};border-radius:50%;font-size:27px;margin:0 auto 18px;">${icon}</div>` : ""}
<h2 style="font-family:Georgia,serif;font-size:21px;color:#1B4332;text-align:center;margin:${icon ? "0" : "6px"} 0 12px;font-weight:600;">Hola ${esc(primer)}</h2>
${inner}
<table role="presentation" align="center" cellpadding="0" cellspacing="0" style="margin:0 auto;"><tr><td style="border-radius:11px;background:#2D6A4F;">
<a href="${ctaUrl}" style="display:inline-block;padding:13px 30px;font-family:Arial,sans-serif;font-size:15px;color:#ffffff;font-weight:700;text-decoration:none;">${esc(ctaText)} &rarr;</a>
</td></tr></table>
${extraCta || ""}
</td></tr>
<tr><td style="background:#F3F8F5;border-radius:0 0 16px 16px;padding:16px 28px;text-align:center;border:1px solid #E3EFE8;border-top:none;">
<p style="font-family:Arial,sans-serif;font-size:12px;color:#8A9A91;line-height:1.5;margin:0;">${foot}</p>
</td></tr>
</table></td></tr></table>
</body></html>`;
}

// ── Onboarding: 4 plantillas diseñadas (con cabra), placeholders {Nombre}/{RefLink}/{Baja} ──
const ONB = [{"id":"onb_bienvenida","day":1,"subject":"Bienvenida a Pathway, {Nombre}","html":"<table cellpadding=\"0\" cellspacing=\"0\" border=\"0\" width=\"100%\" style=\"background:#EFF3EE;padding:22px;font-family:Arial,Helvetica,sans-serif;\"><tr><td align=\"center\"><table cellpadding=\"0\" cellspacing=\"0\" border=\"0\" width=\"600\" style=\"width:600px;max-width:600px;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #E4EDE6;\"><tr><td style=\"padding:20px 30px;border-bottom:1px solid #EEF3EE;\"><img src=\"https://pathwaycareercoach.com/logo-horizontal.png\" width=\"130\" alt=\"Pathway\" style=\"display:block;border:0;\"></td></tr>\n <tr><td bgcolor=\"#1F5740\" style=\"padding:28px 30px 26px;font-family:Arial,Helvetica,sans-serif;\"><table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\"><tr>\n   <td valign=\"middle\" style=\"width:120px;\"><img src=\"https://pathwaycareercoach.com/assets/cabra/salta.gif\" width=\"110\" alt=\"\" style=\"display:block;border:0;\"></td>\n   <td valign=\"middle\" style=\"padding-left:6px;\"><div style=\"font-size:11px;letter-spacing:2.5px;text-transform:uppercase;color:#E9C46A;font-weight:bold;\">Bienvenida a Pathway</div><div style=\"font-family:Georgia,serif;font-size:27px;line-height:1.15;color:#fff;font-weight:bold;margin-top:8px;\">Tu plataforma ya está lista</div></td>\n </tr></table></td></tr>\n <tr><td bgcolor=\"#E9C46A\" style=\"padding:12px 30px;font-family:Arial,Helvetica,sans-serif;text-align:center;\"><span style=\"font-size:13.5px;color:#1F5740;font-weight:bold;\">Tu cuenta ya está activa — sin tarjeta, sin vueltas.</span></td></tr>\n <tr><td style=\"padding:24px 30px 2px;font-family:Arial,Helvetica,sans-serif;\"><div style=\"font-size:15.5px;line-height:1.65;color:#42514A;\">Hola {Nombre}, qué bueno tenerte. Con Pathway tus clientes entran a un <b>portal con tu marca</b> y la IA hace el trabajo pesado: CV, LinkedIn e informes en minutos. Tú guías, la herramienta ejecuta.</div></td></tr>\n <tr><td style=\"padding:14px 30px 2px;\"><div style=\"font-family:Georgia,serif;font-size:16px;color:#2D6A4F;font-weight:bold;margin-bottom:4px;\">Empieza en 3 pasos:</div><table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"background:#F4F8F3;border-radius:12px;padding:4px 8px;\"><tr><td width=\"44\" style=\"padding:11px 0 11px 6px;vertical-align:top;\"><table cellpadding=\"0\" cellspacing=\"0\" border=\"0\"><tr><td width=\"30\" height=\"30\" bgcolor=\"#2D6A4F\" align=\"center\" style=\"border-radius:50%;font-family:Georgia,serif;font-size:15px;font-weight:bold;color:#fff;\">1</td></tr></table></td><td style=\"padding:11px 8px 11px 12px;vertical-align:top;font-family:Arial,Helvetica,sans-serif;\"><div style=\"font-size:15px;font-weight:bold;color:#1B2E26;\">Entra a tu panel</div><div style=\"font-size:13.5px;color:#5A6B62;line-height:1.5;margin-top:2px;\">Tu espacio con tu logo y tu color.</div></td></tr><tr><td width=\"44\" style=\"padding:11px 0 11px 6px;vertical-align:top;\"><table cellpadding=\"0\" cellspacing=\"0\" border=\"0\"><tr><td width=\"30\" height=\"30\" bgcolor=\"#2D6A4F\" align=\"center\" style=\"border-radius:50%;font-family:Georgia,serif;font-size:15px;font-weight:bold;color:#fff;\">2</td></tr></table></td><td style=\"padding:11px 8px 11px 12px;vertical-align:top;font-family:Arial,Helvetica,sans-serif;\"><div style=\"font-size:15px;font-weight:bold;color:#1B2E26;\">Carga tu primer cliente</div><div style=\"font-size:13.5px;color:#5A6B62;line-height:1.5;margin-top:2px;\">En 2 minutos ves tu portal funcionando.</div></td></tr><tr><td width=\"44\" style=\"padding:11px 0 11px 6px;vertical-align:top;\"><table cellpadding=\"0\" cellspacing=\"0\" border=\"0\"><tr><td width=\"30\" height=\"30\" bgcolor=\"#2D6A4F\" align=\"center\" style=\"border-radius:50%;font-family:Georgia,serif;font-size:15px;font-weight:bold;color:#fff;\">3</td></tr></table></td><td style=\"padding:11px 8px 11px 12px;vertical-align:top;font-family:Arial,Helvetica,sans-serif;\"><div style=\"font-size:15px;font-weight:bold;color:#1B2E26;\">Genera un informe con IA</div><div style=\"font-size:13.5px;color:#5A6B62;line-height:1.5;margin-top:2px;\">CV, LinkedIn e informe, listos solos.</div></td></tr></table></td></tr>\n <tr><td style=\"padding:16px 30px 2px;\"><table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\"><tr><td style=\"border-left:3px solid #52B788;padding:4px 0 4px 14px;font-family:Arial,Helvetica,sans-serif;\"><div style=\"font-size:13.5px;color:#42514A;line-height:1.6;\"><b style=\"color:#1B2E26;\">Lo que verá tu cliente:</b> su avance semana a semana, su CV y su carta listos, todo con tu marca.</div></td></tr></table></td></tr>\n <tr><td style=\"padding:22px 30px 6px;font-family:Arial,Helvetica,sans-serif;\"><table cellpadding=\"0\" cellspacing=\"0\" border=\"0\"><tr><td bgcolor=\"#2D6A4F\" style=\"border-radius:11px;\"><a href=\"https://pathwaycareercoach.com/panel-v2.html\" style=\"display:inline-block;padding:15px 32px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1;font-weight:bold;color:#fff;text-decoration:none;border-radius:11px;\">Entrar a mi panel</a></td></tr></table></td></tr>\n <tr><td style=\"padding:6px 30px 28px;font-family:Arial,Helvetica,sans-serif;\"><div style=\"font-size:13px;color:#7A8B82;\">¿Tienes dudas? Responde este correo y te ayudamos a arrancar.</div></td></tr><tr><td style=\"padding:20px 30px;background:#fff;border-top:1px solid #EBF1EC;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#9AA69F;text-align:center;line-height:1.7;\"><img src=\"https://pathwaycareercoach.com/logo-horizontal.png\" width=\"92\" alt=\"Pathway\" style=\"display:block;margin:0 auto 8px;border:0;opacity:.8;\"><a href=\"https://pathwaycareercoach.com\" style=\"color:#2D6A4F;text-decoration:none;font-weight:bold;\">pathwaycareercoach.com</a> · Coaching de carrera con IA<br>Recibes este correo porque te uniste a Pathway.<br><a href=\"{Baja}\" style=\"color:#9AA69F;text-decoration:underline;\">Darme de baja</a></td></tr></table></td></tr></table>","push":{"title":"Bienvenida a Pathway 🌿","body":"Tu plataforma ya está lista. Da el primer paso."}},{"id":"onb_referido","day":5,"subject":"{Nombre}, ¿conoces a un coach que merezca esto?","html":"<table cellpadding=\"0\" cellspacing=\"0\" border=\"0\" width=\"100%\" style=\"background:#EFF3EE;padding:22px;font-family:Arial,Helvetica,sans-serif;\"><tr><td align=\"center\"><table cellpadding=\"0\" cellspacing=\"0\" border=\"0\" width=\"600\" style=\"width:600px;max-width:600px;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #E4EDE6;\"><tr><td style=\"padding:20px 30px;border-bottom:1px solid #EEF3EE;\"><img src=\"https://pathwaycareercoach.com/logo-horizontal.png\" width=\"130\" alt=\"Pathway\" style=\"display:block;border:0;\"></td></tr>\n <tr><td style=\"padding:22px 26px 8px;\"><table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"background:#E9C46A;border-radius:16px;\"><tr>\n   <td width=\"120\" valign=\"middle\" style=\"padding:14px 0 14px 14px;\"><img src=\"https://pathwaycareercoach.com/assets/cabra/mira.png\" width=\"104\" alt=\"\" style=\"display:block;border:0;\"></td>\n   <td valign=\"middle\" style=\"padding:16px 20px 16px 8px;font-family:Arial,Helvetica,sans-serif;\"><div style=\"font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#1F5740;font-weight:bold;opacity:.8;\">Entre coaches · Programa de referidos</div><div style=\"font-family:Georgia,serif;font-size:24px;line-height:1.15;color:#1B2E26;font-weight:bold;margin-top:6px;\">¿Conoces a un coach que merezca esto?</div></td>\n </tr></table></td></tr>\n <tr><td align=\"center\" style=\"padding:18px 30px 6px;font-family:Arial,Helvetica,sans-serif;\"><div style=\"font-family:Georgia,serif;font-size:40px;font-weight:bold;color:#2D6A4F;line-height:1;\">+15 días</div><div style=\"font-size:13.5px;color:#42514A;margin-top:6px;\">gratis en tu cuenta · cada vez que tu recomendado se suscribe</div></td></tr>\n <tr><td style=\"padding:16px 30px 2px;\"><table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\"><tr>\n   <td valign=\"middle\" style=\"font-family:Arial,Helvetica,sans-serif;\"><div style=\"font-size:15px;line-height:1.6;color:#42514A;\">Pathway sigue creciendo y buscamos coaches que quieran sumarse a la comunidad:</div><div style=\"font-size:14.5px;color:#1B2E26;line-height:1.9;margin-top:8px;\">• <b>Fitness coach</b><br>• <b>Career coach</b><br>• <b>Finance coach</b></div></td>\n   <td width=\"120\" valign=\"middle\" align=\"right\"><img src=\"https://pathwaycareercoach.com/assets/cabra/atencion.png\" width=\"104\" alt=\"\" style=\"display:block;border:0;\"></td>\n </tr></table></td></tr>\n <tr><td style=\"padding:16px 30px 6px;\"><table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\"><tr><td bgcolor=\"#1F5740\" style=\"border-radius:14px;padding:22px 24px;font-family:Arial,Helvetica,sans-serif;\"><div style=\"font-family:Georgia,serif;font-size:22px;color:#fff;font-weight:bold;line-height:1.25;\">Recomienda Pathway,<br>llévate <span style=\"color:#E9C46A;\">15 días</span></div><div style=\"font-size:14px;color:#DDEAE0;line-height:1.6;margin-top:8px;\">Recomienda a otro coach que conozcas. Si se suscribe, sumamos 15 días a tu plan. Sin límite: cada suscripción, más días.</div></td></tr></table></td></tr>\n <tr><td align=\"center\" style=\"padding:20px 30px 6px;font-family:Arial,Helvetica,sans-serif;\"><table cellpadding=\"0\" cellspacing=\"0\" border=\"0\"><tr><td bgcolor=\"#2D6A4F\" style=\"border-radius:11px;\"><a href=\"{RefLink}\" style=\"display:inline-block;padding:15px 32px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1;font-weight:bold;color:#fff;text-decoration:none;border-radius:11px;\">Recomendar y ganar 15 días</a></td></tr></table><div style=\"height:12px;font-size:0;\">&nbsp;</div><a href=\"{RefLink}\" style=\"font-size:13px;color:#2D6A4F;font-weight:bold;text-decoration:underline;\">Copiar mi enlace</a></td></tr>\n <tr><td style=\"padding:4px 30px 26px;\"></td></tr><tr><td style=\"padding:20px 30px;background:#fff;border-top:1px solid #EBF1EC;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#9AA69F;text-align:center;line-height:1.7;\"><img src=\"https://pathwaycareercoach.com/logo-horizontal.png\" width=\"92\" alt=\"Pathway\" style=\"display:block;margin:0 auto 8px;border:0;opacity:.8;\"><a href=\"https://pathwaycareercoach.com\" style=\"color:#2D6A4F;text-decoration:none;font-weight:bold;\">pathwaycareercoach.com</a> · Coaching de carrera con IA<br>Recibes este correo porque te uniste a Pathway.<br><a href=\"{Baja}\" style=\"color:#9AA69F;text-decoration:underline;\">Darme de baja</a></td></tr></table></td></tr></table>","push":{"title":"Gana 15 días","body":"Recomienda Pathway a otro coach."}},{"id":"onb_funciones","day":9,"subject":"Todo lo que Pathway hace por ti, {Nombre}","html":"<table cellpadding=\"0\" cellspacing=\"0\" border=\"0\" width=\"100%\" style=\"background:#1F5740;padding:22px;font-family:Arial,Helvetica,sans-serif;\"><tr><td align=\"center\"><table cellpadding=\"0\" cellspacing=\"0\" border=\"0\" width=\"600\" style=\"width:600px;max-width:600px;background:#1F5740;border-radius:16px;overflow:hidden;border:1px solid #E4EDE6;\"><tr><td style=\"padding:20px 30px;border-bottom:1px solid rgba(255,255,255,.14);\"><span style=\"font-family:Georgia,serif;font-size:22px;font-weight:bold;color:#fff;\">pathway<span style=\"color:#52B788;\">.</span></span></td></tr>\n <tr><td style=\"padding:26px 30px 8px;font-family:Arial,Helvetica,sans-serif;\"><table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\"><tr>\n   <td valign=\"middle\"><div style=\"font-size:11px;letter-spacing:2.5px;text-transform:uppercase;color:#E9C46A;font-weight:bold;\">Lo que hace por ti</div><div style=\"font-family:Georgia,serif;font-size:25px;color:#fff;font-weight:bold;margin-top:6px;line-height:1.2;\">Menos trabajo manual,<br>más clientes atendidos</div></td>\n   <td width=\"112\" valign=\"middle\" align=\"right\"><img src=\"https://pathwaycareercoach.com/assets/cabra/frente.gif\" width=\"104\" alt=\"\" style=\"display:block;border:0;\"></td>\n </tr></table></td></tr>\n <tr><td style=\"padding:6px 30px 2px;font-family:Arial,Helvetica,sans-serif;\"><div style=\"font-size:15px;line-height:1.6;color:#D7E7DC;\">Hola {Nombre}, esto es lo que Pathway hace por ti cada semana:</div></td></tr>\n <tr><td style=\"padding:12px 30px 2px;\"><table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"background:rgba(255,255,255,.06);border-radius:12px;padding:6px 10px;\"><tr><td width=\"30\" valign=\"top\" style=\"padding:9px 0 9px 4px;\"><div style=\"width:22px;height:22px;border-radius:50%;background:#E9C46A;color:#1F5740;font-size:13px;font-weight:bold;text-align:center;line-height:22px;font-family:Arial;\">✓</div></td><td style=\"padding:9px 6px 9px 10px;font-family:Arial,Helvetica,sans-serif;\"><span style=\"font-size:14.5px;font-weight:bold;color:#fff;\">CV, carta e informes con IA</span> <span style=\"font-size:14px;color:#CFE3D6;\">— en minutos, no en horas.</span></td></tr><tr><td width=\"30\" valign=\"top\" style=\"padding:9px 0 9px 4px;\"><div style=\"width:22px;height:22px;border-radius:50%;background:#E9C46A;color:#1F5740;font-size:13px;font-weight:bold;text-align:center;line-height:22px;font-family:Arial;\">✓</div></td><td style=\"padding:9px 6px 9px 10px;font-family:Arial,Helvetica,sans-serif;\"><span style=\"font-size:14.5px;font-weight:bold;color:#fff;\">Portal con tu marca</span> <span style=\"font-size:14px;color:#CFE3D6;\">— tu logo, no el nuestro.</span></td></tr><tr><td width=\"30\" valign=\"top\" style=\"padding:9px 0 9px 4px;\"><div style=\"width:22px;height:22px;border-radius:50%;background:#E9C46A;color:#1F5740;font-size:13px;font-weight:bold;text-align:center;line-height:22px;font-family:Arial;\">✓</div></td><td style=\"padding:9px 6px 9px 10px;font-family:Arial,Helvetica,sans-serif;\"><span style=\"font-size:14.5px;font-weight:bold;color:#fff;\">Seguimiento por semana</span> <span style=\"font-size:14px;color:#CFE3D6;\">— sabes cómo avanza cada cliente.</span></td></tr><tr><td width=\"30\" valign=\"top\" style=\"padding:9px 0 9px 4px;\"><div style=\"width:22px;height:22px;border-radius:50%;background:#E9C46A;color:#1F5740;font-size:13px;font-weight:bold;text-align:center;line-height:22px;font-family:Arial;\">✓</div></td><td style=\"padding:9px 6px 9px 10px;font-family:Arial,Helvetica,sans-serif;\"><span style=\"font-size:14.5px;font-weight:bold;color:#fff;\">App en el celular</span> <span style=\"font-size:14px;color:#CFE3D6;\">— instálala y llévala contigo.</span></td></tr></table></td></tr>\n <tr><td style=\"padding:16px 30px 4px;\"><table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\"><tr>\n   <td width=\"50%\" style=\"padding-right:6px;\"><table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\"><tr><td bgcolor=\"#E9C46A\" align=\"center\" style=\"border-radius:12px;padding:18px;\"><div style=\"font-family:Georgia,serif;font-size:28px;font-weight:bold;color:#1F5740;line-height:1;\">~6 h</div><div style=\"font-size:12.5px;color:#6b5416;margin-top:5px;font-weight:bold;\">que ahorras por cliente / semana</div></td></tr></table></td>\n   <td width=\"50%\" style=\"padding-left:6px;\"><table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\"><tr><td bgcolor=\"#EAF3EC\" align=\"center\" style=\"border-radius:12px;padding:18px;\"><div style=\"font-family:Georgia,serif;font-size:28px;font-weight:bold;color:#2D6A4F;line-height:1;\">4 sem</div><div style=\"font-size:12.5px;color:#42514A;margin-top:5px;font-weight:bold;\">y tu cliente ve resultados</div></td></tr></table></td>\n </tr></table></td></tr>\n <tr><td style=\"padding:16px 30px 2px;font-family:Arial,Helvetica,sans-serif;\"><div style=\"font-size:13.5px;color:#CFE3D6;line-height:1.6;border-top:1px solid rgba(255,255,255,.14);padding-top:14px;\">¿No sabes algo? La <b style=\"color:#fff;\">IA de Pathway</b> te ayuda con todo, dentro de la plataforma — sin salir del panel.</div></td></tr>\n <tr><td style=\"padding:18px 30px 28px;font-family:Arial,Helvetica,sans-serif;\"><table cellpadding=\"0\" cellspacing=\"0\" border=\"0\"><tr><td bgcolor=\"#E9C46A\" style=\"border-radius:11px;\"><a href=\"https://pathwaycareercoach.com/panel-v2.html\" style=\"display:inline-block;padding:15px 32px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1;font-weight:bold;color:#1F5740;text-decoration:none;border-radius:11px;\">Probar una función</a></td></tr></table></td></tr><tr><td style=\"padding:20px 30px;background:#fff;border-top:1px solid #EBF1EC;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#9AA69F;text-align:center;line-height:1.7;\"><img src=\"https://pathwaycareercoach.com/logo-horizontal.png\" width=\"92\" alt=\"Pathway\" style=\"display:block;margin:0 auto 8px;border:0;opacity:.8;\"><a href=\"https://pathwaycareercoach.com\" style=\"color:#2D6A4F;text-decoration:none;font-weight:bold;\">pathwaycareercoach.com</a> · Coaching de carrera con IA<br>Recibes este correo porque te uniste a Pathway.<br><a href=\"{Baja}\" style=\"color:#9AA69F;text-decoration:underline;\">Darme de baja</a></td></tr></table></td></tr></table>","push":{"title":"Todo lo que Pathway hace por ti","body":"Menos trabajo manual, más clientes atendidos."}},{"id":"onb_review","day":14,"subject":"{Nombre}, ¿cómo vas con Pathway?","html":"<table cellpadding=\"0\" cellspacing=\"0\" border=\"0\" width=\"100%\" style=\"background:#EFF3EE;padding:22px;font-family:Arial,Helvetica,sans-serif;\"><tr><td align=\"center\"><table cellpadding=\"0\" cellspacing=\"0\" border=\"0\" width=\"600\" style=\"width:600px;max-width:600px;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #E4EDE6;\"><tr><td style=\"padding:20px 30px;border-bottom:1px solid #EEF3EE;\"><img src=\"https://pathwaycareercoach.com/logo-horizontal.png\" width=\"130\" alt=\"Pathway\" style=\"display:block;border:0;\"></td></tr>\n <tr><td style=\"padding:22px 26px 6px;\"><table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"background:#E9C46A;border-radius:16px;\"><tr>\n   <td valign=\"middle\" style=\"padding:16px 6px 16px 22px;font-family:Arial,Helvetica,sans-serif;\"><div style=\"font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#1F5740;font-weight:bold;opacity:.8;\">Tu opinión</div><div style=\"font-family:Georgia,serif;font-size:24px;line-height:1.15;color:#1B2E26;font-weight:bold;margin-top:6px;\">¿Cómo vas con Pathway?</div></td>\n   <td width=\"118\" valign=\"middle\" align=\"right\" style=\"padding-right:14px;\"><img src=\"https://pathwaycareercoach.com/assets/cabra/camina.gif\" width=\"104\" alt=\"\" style=\"display:block;border:0;\"></td>\n </tr></table></td></tr>\n <tr><td style=\"padding:20px 30px 2px;font-family:Arial,Helvetica,sans-serif;\"><div style=\"font-size:15px;line-height:1.65;color:#42514A;\">Hola {Nombre}, ya llevas unos días usándolo. Tu opinión moldea lo que construimos — y ayuda a otro coach a decidirse.</div></td></tr>\n <tr><td align=\"center\" style=\"padding:14px 30px 2px;\"><span style=\"font-size:40px;line-height:1;color:#C99A2E;padding:0 4px;\">★</span><span style=\"font-size:40px;line-height:1;color:#C99A2E;padding:0 4px;\">★</span><span style=\"font-size:40px;line-height:1;color:#C99A2E;padding:0 4px;\">★</span><span style=\"font-size:40px;line-height:1;color:#C99A2E;padding:0 4px;\">★</span><span style=\"font-size:40px;line-height:1;color:#C99A2E;padding:0 4px;\">★</span></td></tr>\n <tr><td align=\"center\" style=\"padding:10px 30px 8px;font-family:Arial,Helvetica,sans-serif;\"><table cellpadding=\"0\" cellspacing=\"0\" border=\"0\"><tr><td bgcolor=\"#2D6A4F\" style=\"border-radius:11px;\"><a href=\"mailto:hi@pathwaycareercoach.com?subject=Mi%20rese%C3%B1a%20de%20Pathway&body=Mi%20nota%20(del%201%20al%205)%3A%20%0A%0ALo%20que%20m%C3%A1s%20me%20gust%C3%B3%3A%0A%0ALo%20que%20mejorar%C3%ADa%3A%0A\" style=\"display:inline-block;padding:15px 32px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1;font-weight:bold;color:#fff;text-decoration:none;border-radius:11px;\">Escribir mi opinión</a></td></tr></table></td></tr>\n <tr><td style=\"padding:12px 30px 28px;font-family:Arial,Helvetica,sans-serif;\"><div style=\"font-size:13.5px;color:#7A8B82;line-height:1.6;text-align:center;\">El botón abre tu correo con la respuesta lista para escribir — sin salir a ninguna página.</div></td></tr><tr><td style=\"padding:20px 30px;background:#fff;border-top:1px solid #EBF1EC;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#9AA69F;text-align:center;line-height:1.7;\"><img src=\"https://pathwaycareercoach.com/logo-horizontal.png\" width=\"92\" alt=\"Pathway\" style=\"display:block;margin:0 auto 8px;border:0;opacity:.8;\"><a href=\"https://pathwaycareercoach.com\" style=\"color:#2D6A4F;text-decoration:none;font-weight:bold;\">pathwaycareercoach.com</a> · Coaching de carrera con IA<br>Recibes este correo porque te uniste a Pathway.<br><a href=\"{Baja}\" style=\"color:#9AA69F;text-decoration:underline;\">Darme de baja</a></td></tr></table></td></tr></table>","push":{"title":"¿Cómo vas con Pathway?","body":"Cuéntanos en 30 segundos."}}];
function fillOnb(html, primer, coachId) {
  const refLink = HOST + "/registro.html?ref=popup&referrer=" + encodeURIComponent(coachId);
  const bajaLink = PUBLIC_API + "/functions/v1/unsubscribe?u=" + encodeURIComponent(coachId);
  return String(html)
    .split("{Nombre}").join(esc(primer))
    .split("{RefLink}").join(refLink)
    .split("{Baja}").join(bajaLink);
}

// ── Renovación: avisos por vencimiento de la prueba ──────────────
// Se disparan según la fecha_fin_prueba de CADA coach (respeta 14 / 15 / 30 días,
// porque leen SU fecha, no una fija). Solo a coaches que NO pagaron. El botón va
// DIRECTO al Stripe del plan que ya tenía, con su email precargado: paga en 1 clic
// y reactiva la MISMA cuenta (el webhook matchea por email). El texto deja claro
// que es una renovación de su cuenta, no un alta nueva.
function trialEmail(kind, primer, plan, email) {
  // Botón principal = SU plan (Basic sigue en Basic, Pro sigue en Pro). Si está
  // en Basic, además un link secundario para pasar a Pro (upsell, nunca downsell).
  const payUrl = renewUrl(plan, email);
  const planLbl = plan === "pro" ? "Pro (USD $59/mes)" : "Basic (USD $29/mes)";
  const upsell = plan === "basic"
    ? `<p style="text-align:center;font-family:Arial,sans-serif;font-size:13px;color:#5A6A60;margin:16px 0 0;">¿Quieres más? <a href="${renewUrl("pro", email)}" style="color:#2D6A4F;font-weight:700;text-decoration:underline;">Pasar a Pro · USD $59/mes &rarr;</a></p>`
    : "";
  const intactos = "tus clientes, informes y toda tu configuración siguen intactos — <strong>no empiezas de cero</strong>";
  if (kind === "trial_por_vencer") {
    return {
      subject: `${primer}, tu prueba de Pathway termina pronto`,
      html: emailHtml(primer, "", "",
        P(`Tu prueba está por terminar. Para seguir <strong>sin cortes</strong> con tus clientes, activa tu plan hoy: ${intactos}. Cancelas cuando quieras, sin permanencia.`),
        `Seguir con mi plan ${planLbl}`, payUrl, null, upsell),
      push: { title: "Tu prueba termina pronto", body: "Activa tu plan y seguí sin cortes." },
    };
  }
  if (kind === "trial_vencido") {
    return {
      subject: `${primer}, tu prueba terminó — reactiva tu cuenta`,
      html: emailHtml(primer, "", "",
        P(`Tu prueba de Pathway terminó, pero <strong>tu cuenta y tus datos siguen guardados</strong>. Reactivala en un clic y retomá justo donde lo dejaste: ${intactos}. Desde <strong>${plan === "pro" ? "USD $59" : "USD $29"}/mes</strong>, cancelas cuando quieras.`),
        `Reactivar mi cuenta · ${planLbl}`, payUrl, null, upsell),
      push: { title: "Tu prueba terminó", body: "Reactivá tu cuenta en un clic." },
    };
  }
  // trial_vencido_2 — último recordatorio unos días después
  return {
    subject: `${primer}, ¿seguimos? tu cuenta te espera`,
    html: emailHtml(primer, "", "",
      P(`Hace unos días terminó tu prueba. Todavía guardamos tu cuenta y tu data, pero no por mucho más. Si querés retomar con tus clientes, reactivá tu plan hoy: ${intactos}.`),
      `Volver a Pathway · ${planLbl}`, payUrl, null, upsell),
    push: { title: "Tu cuenta te espera", body: "Reactivá tu plan antes de perder tu data." },
  };
}

async function countRows(url, headers) {
  try {
    const r = await fetch(url, { headers: { ...headers, Prefer: "count=exact", Range: "0-0" } });
    const cr = r.headers.get("content-range") || "0/0";
    return parseInt(cr.split("/")[1] || "0", 10) || 0;
  } catch (_e) { return 0; }
}

Deno.serve(async (req) => {
  const triggerSecret = Deno.env.get("AGENT_TRIGGER_SECRET") || "";
  const provided = req.headers.get("x-trigger-secret") || "";
  if (!triggerSecret || provided !== triggerSecret) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
  }
  const SUPABASE_URL = (Deno.env.get("SUPABASE_URL") || "").replace(/\/+$/, "");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const ADMIN_EMAIL = (Deno.env.get("ADMIN_EMAIL") || "mmicaela.jairedin@gmail.com").trim();
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return new Response(JSON.stringify({ error: "missing SUPABASE_URL / SERVICE_ROLE_KEY" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
  const sbHeaders = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` };
  const now = Date.now();

  async function sendEmail(to, toName, subject, html) {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
      body: JSON.stringify({ to, to_name: toName, subject, html, reply_to: REPLY_TO, signature: "none" }),
    });
    return r.ok;
  }
  async function sendPush(email, title, body, tag) {
    try {
      await fetch(`${SUPABASE_URL}/functions/v1/send-push`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
        body: JSON.stringify({ user_email: email, title, body, url: PANEL_URL, tag }),
      });
    } catch (_e) { /* best-effort */ }
  }
  async function recordNudge(coachId, plantilla, canal) {
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/coach_nudges`, {
        method: "POST",
        headers: { ...sbHeaders, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ coach_id: coachId, plantilla_id: plantilla, canal }),
      });
    } catch (_e) { /* no romper la corrida */ }
  }

  // Modo prueba: POST {test_email:"x@y.com"} envía los 4 emails de onboarding a
  // esa dirección (sin tocar coaches ni el registro anti-spam). Para verificar
  // en tu casilla antes de activar la secuencia real.
  let testEmail = "";
  try { const b = await req.json(); testEmail = String((b && b.test_email) || "").trim(); } catch (_e) { /* body vacío = corrida normal */ }
  if (testEmail) {
    const sampleId = "prueba-0000";
    const out = [];
    for (const s of ONB) {
      const ok = await sendEmail(testEmail, "Micaela", fillOnb(s.subject, "Micaela", sampleId), fillOnb(s.html, "Micaela", sampleId));
      out.push({ id: s.id, ok });
    }
    return new Response(JSON.stringify({ test: true, to: testEmail, sent: out }), { status: 200, headers: { "Content-Type": "application/json" } });
  }

  const result = { coaches: 0, enviados: 0, saltados: 0, porTipo: {}, alertasAdmin: 0, errores: [] };

  try {
    const cRes = await fetch(
      `${SUPABASE_URL}/rest/v1/usuarios?rol=in.(coach,admin)&select=id,email,nombre,configuracion,created_at,last_seen,activo`,
      { headers: sbHeaders },
    );
    const coaches = cRes.ok ? await cRes.json() : [];
    result.coaches = coaches.length;

    for (const u of coaches) {
      const email = String(u.email || "").trim().toLowerCase();
      const cfg = u.configuracion || {};
      const notifs = cfg.notifs || {};
      const nombre = String(u.nombre || "");
      const primer = nombre.split(" ")[0] || "coach";
      const vitalicio = cfg.es_pro_vitalicio === true || u.rol === "admin";
      if (!email || notifs.lifecycle === false || u.activo === false || vitalicio) { result.saltados++; continue; }

      try {
        const id = encodeURIComponent(String(u.id));
        const estadoSub = String(cfg.estado_sub || "");
        const isPaying = estadoSub === "activa";
        const plan = String(cfg.plan || "") === "pro" ? "pro" : "basic";
        const altaTs = u.created_at ? +new Date(u.created_at) : 0;
        const seenRaw = cfg.last_login || u.last_seen || u.created_at || "";
        const seenTs = seenRaw ? +new Date(seenRaw) : 0;
        const dAlta = altaTs ? (now - altaTs) / DAY : 999;
        const dSeen = seenTs ? (now - seenTs) / DAY : 999;
        // Días hasta el fin de la prueba de ESTE coach: >0 faltan, <=0 ya venció.
        const finTs = cfg.fecha_fin_prueba ? +new Date(cfg.fecha_fin_prueba) : 0;
        const dToExpiry = finTs ? (finTs - now) / DAY : null;

        const hRes = await fetch(
          `${SUPABASE_URL}/rest/v1/coach_nudges?coach_id=eq.${id}&select=plantilla_id,sent_at&order=sent_at.desc`,
          { headers: sbHeaders },
        );
        const hist = hRes.ok ? await hRes.json() : [];
        const sentEver = (p) => hist.some((h) => h.plantilla_id === p);
        const sentWithin = (p, days) => hist.some((h) => h.plantilla_id === p && h.sent_at && (now - +new Date(h.sent_at)) / DAY < days);
        // Nunca dos empujones al coach en menos de 3 días (el aviso interno no cuenta).
        const recientes = hist.some((h) => h.plantilla_id !== "admin_churn_alert" && h.sent_at && (now - +new Date(h.sent_at)) / DAY < 3);

        // ── Decisión: PRIORIDAD (1) renovación por vencimiento, (2) onboarding, (3) retención ──
        // (1) Renovación: solo coaches que NO pagaron y tienen fecha de fin de prueba.
        //     Se elige la etapa MÁS avanzada que aún no se mandó, así aunque el cron
        //     se saltee un día, cada coach recibe cada aviso una sola vez.
        let trialKind = null;
        if (!isPaying && finTs) {
          if (dToExpiry <= -3 && !sentEver("trial_vencido_2")) trialKind = "trial_vencido_2";
          else if (dToExpiry <= 0.5 && !sentEver("trial_vencido")) trialKind = "trial_vencido";
          else if (dToExpiry <= 3 && !sentEver("trial_por_vencer")) trialKind = "trial_por_vencer";
        }

        // (2) Onboarding por tiempo. Solo coaches que se registran DESDE la fecha de
        // arranque (no retroactivo: los que ya existían antes NO reciben la bienvenida).
        let onbStep = null;
        if (!trialKind && altaTs >= ONBOARDING_FROM_TS) {
          for (const s of ONB) {
            if (dAlta >= s.day && !sentEver(s.id)) { onbStep = s; break; }
          }
        }
        let kind = trialKind || (onbStep ? onbStep.id : null);
        if (!kind && dSeen >= 14 && (isPaying || (await countRows(`${SUPABASE_URL}/rest/v1/candidatos?coach_id=eq.${id}&select=id`, sbHeaders)) > 0) && !sentWithin("reactivacion", 14)) {
          kind = "reactivacion";
        }
        if (!kind || recientes) { result.saltados++; continue; }

        let subject, html, push;
        if (trialKind) {
          const t = trialEmail(trialKind, primer, plan, email);
          subject = t.subject; html = t.html; push = t.push;
        } else if (onbStep) {
          subject = fillOnb(onbStep.subject, primer, String(u.id));
          html = fillOnb(onbStep.html, primer, String(u.id));
          push = onbStep.push;
        } else { // reactivacion
          subject = "👋 Te extrañamos por acá";
          html = emailHtml(primer, "👋", "#E9F5EF",
            P("Hace unos días que no entras a Pathway, y tus clientes te esperan del otro lado. Con un par de minutos <strong>retomas justo donde lo dejaste</strong>. Y si necesitas ayuda con algo, responde este mail y te doy una mano personalmente. Te esperamos. 🌱"),
            "Volver a mi panel", GO_CLIENTES);
          push = { title: "Te extrañamos 👋", body: "Tus clientes te esperan en Pathway." };
        }

        const okEmail = await sendEmail(email, nombre, subject, html);
        await sendPush(email, push.title, push.body, "lifecycle-" + kind);
        await recordNudge(String(u.id), kind, "email+push");
        if (okEmail) { result.enviados++; result.porTipo[kind] = (result.porTipo[kind] || 0) + 1; }
        else result.errores.push(`${email}: send-email falló (${kind})`);

        if (kind === "reactivacion" && isPaying && !sentWithin("admin_churn_alert", 14)) {
          const dias = Math.round(dSeen);
          await sendEmail(ADMIN_EMAIL, "Micaela", `⚠️ Coach pagante inactivo: ${nombre}`,
            emailHtml("Micaela", "⚠️", "#FBECEC",
              P(`<strong>${esc(nombre)}</strong> (${esc(email)}) es coach <strong>pagante</strong> y lleva <strong>${dias} días</strong> sin entrar. Un mensaje personal tuyo ahora puede retenerlo.`),
              "Abrir el panel", PANEL_URL, "Aviso interno de Pathway — solo lo recibes tú como admin."));
          await recordNudge(String(u.id), "admin_churn_alert", "admin");
          result.alertasAdmin++;
        }

        // Aviso a Micaela el día que se vence una prueba sin pago: para seguirlo
        // personalmente (el panel ya lo muestra como "Vencida", esto es el empujón).
        if (trialKind === "trial_vencido" && !sentWithin("admin_trial_vencido", 30)) {
          await sendEmail(ADMIN_EMAIL, "Micaela", `⏰ Prueba vencida sin pago: ${nombre}`,
            emailHtml("Micaela", "⏰", "#FBECEC",
              P(`<strong>${esc(nombre)}</strong> (${esc(email)}) terminó su prueba y todavía no activó plan. Le mandamos el email de reactivación automático — un mensaje personal tuyo ahora puede terminar de convertirlo.`),
              "Abrir el panel", PANEL_URL, "Aviso interno de Pathway — solo lo recibes tú como admin."));
          await recordNudge(String(u.id), "admin_trial_vencido", "admin");
          result.alertasAdmin++;
        }
      } catch (e) {
        result.errores.push(`${email}: ${String(e).slice(0, 120)}`);
      }
    }
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e).slice(0, 200) }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
  return new Response(JSON.stringify(result), { status: 200, headers: { "Content-Type": "application/json" } });
});
