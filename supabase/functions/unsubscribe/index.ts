// unsubscribe — baja de los emails de ciclo de vida / onboarding.
//
// El pie de cada email de coach-lifecycle enlaza aquí:
//   https://api.pathwaycareercoach.com/functions/v1/unsubscribe?u=<coachId>
// Al abrirlo, marca configuracion.notifs.lifecycle = false para ese coach
// (mismo flag que ya respeta coach-lifecycle) y muestra una confirmación.
//
// Es un opt-out de marketing (bajo riesgo): usa el id del coach (UUID, no
// adivinable) como protección suficiente. No expone datos.
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (auto-inyectadas).
// Deploy: supabase functions deploy unsubscribe --no-verify-jwt

function page(title, msg, ok) {
  const accent = ok ? "#2D6A4F" : "#B23B3B";
  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="margin:0;background:#EAF1ED;font-family:-apple-system,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:60px 16px;"><tr><td align="center">
<table width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background:#fff;border-radius:16px;border:1px solid #E3EFE8;">
<tr><td style="background:#2D6A4F;border-radius:16px 16px 0 0;padding:18px 26px;text-align:center;">
<span style="font-family:Georgia,serif;font-size:20px;color:#fff;font-weight:600;">Pathway <span style="color:#95D5B2;">&bull;</span></span></td></tr>
<tr><td style="padding:34px 30px;text-align:center;">
<h2 style="font-family:Georgia,serif;font-size:22px;color:${accent};margin:0 0 12px;">${title}</h2>
<p style="font-family:Arial,sans-serif;font-size:15px;color:#40584C;line-height:1.6;margin:0 0 22px;">${msg}</p>
<a href="https://pathwaycareercoach.com" style="display:inline-block;padding:12px 26px;background:#2D6A4F;color:#fff;border-radius:10px;text-decoration:none;font-family:Arial,sans-serif;font-size:14px;font-weight:700;">Ir a Pathway</a>
</td></tr></table></td></tr></table></body></html>`;
}
// Lista cerrada de bajas admitidas, con el texto de confirmacion de cada una.
// Cualquier `k` fuera de aqui cae a `lifecycle` (comportamiento historico).
const BAJAS = {
  lifecycle: "No vas a recibir más correos automáticos de Pathway.",
  weeklyReport: "No vas a recibir más el resumen semanal de tus clientes.",
};
function resp(html, status) {
  return new Response(html, { status: status || 200, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const coachId = (url.searchParams.get("u") || "").trim();
  // Solo se aceptan flags de una lista cerrada: `k` viene de un enlace publico
  // y no puede poder escribir cualquier clave dentro de configuracion.notifs.
  const tipoBaja = (url.searchParams.get("k") || "lifecycle").trim();
  if (!coachId) {
    return resp(page("Enlace inválido", "Falta el identificador. Si querés darte de baja, respondé cualquiera de nuestros correos.", false), 400);
  }
  const SUPABASE_URL = (Deno.env.get("SUPABASE_URL") || "").replace(/\/+$/, "");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return resp(page("Error", "No pudimos procesar la baja ahora. Probá de nuevo en un rato.", false), 500);
  }
  const sbHeaders = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` };
  try {
    const id = encodeURIComponent(coachId);
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/usuarios?id=eq.${id}&select=id,nombre,configuracion`,
      { headers: sbHeaders },
    );
    const rows = r.ok ? await r.json() : [];
    if (!rows.length) {
      return resp(page("No encontramos tu cuenta", "El enlace no corresponde a una cuenta activa. Si querés darte de baja, respondé cualquiera de nuestros correos.", false), 404);
    }
    const cfg = rows[0].configuracion || {};
    const notifs = cfg.notifs || {};
    // `k` = de QUE se da de baja. Sin `k` se comporta como siempre (lifecycle),
    // asi que los enlaces ya enviados en correos antiguos siguen funcionando.
    // AP2 lo necesita porque el resumen semanal es otro flag: sin esto, el
    // enlace del digest apagaria los emails de ciclo de vida en su lugar.
    notifs[BAJAS[tipoBaja] ? tipoBaja : "lifecycle"] = false;
    const newCfg = { ...cfg, notifs };
    const up = await fetch(`${SUPABASE_URL}/rest/v1/usuarios?id=eq.${id}`, {
      method: "PATCH",
      headers: { ...sbHeaders, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ configuracion: newCfg }),
    });
    if (!up.ok) throw new Error("patch failed " + up.status);
    const detalle = BAJAS[tipoBaja] || BAJAS.lifecycle;
    return resp(page("Listo, te diste de baja", detalle + " Podés seguir usando tu panel con normalidad, y si cambiás de idea, respondé cualquier correo y te reactivamos.", true));
  } catch (_e) {
    return resp(page("Error", "No pudimos procesar la baja ahora. Probá de nuevo en un rato.", false), 500);
  }
});
