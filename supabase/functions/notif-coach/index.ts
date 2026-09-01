// notif-coach — Digest semanal por email a cada coach.
//
// Recorre los coaches activos y les manda un email con:
//   - clientes nuevos de los últimos 7 días (asignados a su coach_id)
//   - total de clientes activos
//
// AP2 (agosto 2026): el resumen pasa de opt-in a OPT-OUT. Antes exigia
// `configuracion.notifs.weeklyReport === true`, pero el panel dejo de tener UI
// para activarlo: 0 de 49 coaches lo recibian. Ahora sale salvo que el coach lo
// apague (=== false), con enlace de baja de un clic en el pie del email.
//
// Disparo: GitHub Actions cron (.github/workflows/coach-notifications.yml)
// hace POST con header X-Trigger-Secret = AGENT_TRIGGER_SECRET.
//
// Env (Supabase Edge Functions → Secrets):
//   SUPABASE_URL               — auto-inyectada
//   SUPABASE_SERVICE_ROLE_KEY  — auto-inyectada
//   AGENT_TRIGGER_SECRET       — mismo valor que el secret de GitHub
//
// Deploy: supabase functions deploy notif-coach --no-verify-jwt

// Reintento acotado ante el limite de tasa de las invocaciones anidadas
// (notif-coach -> send-email). El run #15 perdio 8 de 38 digests por eso; el
// porque, y por que reintentar ahi no puede duplicar un envio, en ese fichero.
import { enviarConReintento } from "./enviar.ts";

const PANEL_URL = "https://pathwaycareercoach.com/panel-v2.html";
// Baja en un clic desde el pie del email (AP2-B). `k=weeklyReport` apaga SOLO
// este resumen; sin `k`, la funcion apagaria los emails de ciclo de vida.
const UNSUB_URL = "https://api.pathwaycareercoach.com/functions/v1/unsubscribe";

function esc(s: unknown): string {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function digestHtml(coachName: string, nuevos: Array<Record<string, unknown>>, totalActivos: number, coachId: string): string {
  const primer = (coachName || "").split(" ")[0] || "coach";
  const lista = nuevos.length
    ? `<ul style="margin:8px 0 0;padding-left:18px;">${nuevos.map((c) =>
        `<li>${esc(c.nombre || c.email || "Cliente")}${c.email ? ` · <span style="color:#5A6A60;">${esc(c.email)}</span>` : ""}</li>`).join("")}</ul>`
    : `<p style="color:#5A6A60;margin:8px 0 0;">No hubo clientes nuevos esta semana.</p>`;
  return `<!DOCTYPE html><html><body style="font-family:Inter,-apple-system,sans-serif;font-size:14px;line-height:1.6;color:#1B4332;max-width:620px;margin:0 auto;padding:24px;background:#FAFDF9;">
<h2 style="font-family:Fraunces,Georgia,serif;color:#1B4332;margin:0 0 14px;">Hola ${esc(primer)},</h2>
<p>Tu resumen semanal en Pathway:</p>
<div style="background:#fff;border:1px solid rgba(45,106,79,.14);border-radius:12px;padding:16px 18px;margin:14px 0;">
  <div style="font-weight:700;">${nuevos.length} cliente${nuevos.length === 1 ? "" : "s"} nuevo${nuevos.length === 1 ? "" : "s"} esta semana</div>
  ${lista}
  <div style="margin-top:14px;color:#5A6A60;">Clientes activos en total: <strong style="color:#1B4332;">${totalActivos}</strong></div>
</div>
<p style="margin-top:20px;"><a href="${PANEL_URL}" style="display:inline-block;padding:12px 24px;background:#2D6A4F;color:#fff;border-radius:10px;text-decoration:none;font-weight:700;">Abrir mi panel →</a></p>
<p style="font-size:12px;color:#999;margin-top:18px;">Recibes el resumen semanal porque tienes clientes en Pathway. Si no lo quieres, <a href="${UNSUB_URL}?u=${encodeURIComponent(coachId)}&amp;k=weeklyReport" style="color:#5A6A60;">date de baja en un clic</a> — tu panel sigue igual.</p>
</body></html>`;
}

const dormir = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

Deno.serve(async (req: Request) => {
  const triggerSecret = Deno.env.get("AGENT_TRIGGER_SECRET") || "";
  const provided = req.headers.get("x-trigger-secret") || "";
  if (!triggerSecret || provided !== triggerSecret) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401, headers: { "Content-Type": "application/json" },
    });
  }

  const SUPABASE_URL = (Deno.env.get("SUPABASE_URL") || "").replace(/\/+$/, "");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return new Response(JSON.stringify({ error: "missing SUPABASE_URL / SERVICE_ROLE_KEY" }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }

  const sbHeaders = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` };
  const sinceISO = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // `reintentos` es informativo: mide cuanto esta pegando el limite de tasa.
  const result = {
    coaches: 0, enviados: 0, saltados: 0, reintentos: 0, errores: [] as string[],
  };
  const inicio = Date.now();

  try {
    const cRes = await fetch(
      `${SUPABASE_URL}/rest/v1/usuarios?rol=in.(coach,admin)&activo=eq.true&select=id,email,nombre,configuracion`,
      { headers: sbHeaders },
    );
    const coaches: Array<Record<string, unknown>> = cRes.ok ? await cRes.json() : [];
    result.coaches = coaches.length;

    for (const u of coaches) {
      const email = String(u.email || "").trim();
      const cfg = (u.configuracion as Record<string, unknown>) || {};
      const notifs = (cfg.notifs as Record<string, unknown>) || {};
      // AP2 · el default se invierte: sale salvo que el coach lo apague.
      //
      // Antes era `!== true` (opt-in) y el panel dejo de tener UI para
      // activarlo, asi que la condicion no la cumplia NADIE: 0 de 49 coaches
      // recibian el resumen. No es que no lo quisieran — es que no habia donde
      // decir que si. Un coach que lo apago a proposito (=== false) se respeta.
      if (notifs.weeklyReport === false || !email) { result.saltados++; continue; }
      // AP2-D · fuera cuentas de prueba y demos: la consulta ya filtra por
      // activo=true, pero esas dos viven en `configuracion`.
      if (cfg.cuenta_test === true || cfg.demo === true) { result.saltados++; continue; }

      try {
        const id = encodeURIComponent(String(u.id));
        const nRes = await fetch(
          `${SUPABASE_URL}/rest/v1/candidatos?coach_id=eq.${id}&created_at=gte.${encodeURIComponent(sinceISO)}&select=nombre,email,created_at&order=created_at.desc`,
          { headers: sbHeaders },
        );
        const nuevos: Array<Record<string, unknown>> = nRes.ok ? await nRes.json() : [];

        const tRes = await fetch(
          `${SUPABASE_URL}/rest/v1/candidatos?coach_id=eq.${id}&or=(activo.is.null,activo.eq.true)&select=id`,
          { headers: { ...sbHeaders, Prefer: "count=exact", Range: "0-0" } },
        );
        const cr = tRes.headers.get("content-range") || "0/0";
        const totalActivos = parseInt(cr.split("/")[1] || "0", 10) || 0;

        const envio = await enviarConReintento(
          `${SUPABASE_URL}/functions/v1/send-email`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
            body: JSON.stringify({
              to: email,
              to_name: String(u.nombre || ""),
              subject: "📋 Tu resumen semanal — Pathway",
              html: digestHtml(String(u.nombre || ""), nuevos, totalActivos, String(u.id || "")),
              reply_to: "hi@pathwaycareercoach.com",
            }),
          },
          { fetchImpl: fetch, dormir, ahora: Date.now, inicio },
        );
        result.reintentos += envio.intentos - 1;
        if (envio.estado === "enviado") result.enviados++;
        else result.errores.push(`${email}: ${envio.detalle}`);
      } catch (e) {
        // Fallo al reunir los datos del coach (las consultas de arriba). El
        // envio ya no lanza: enviarConReintento devuelve su desenlace.
        result.errores.push(`${email}: ${String(e).slice(0, 120)}`);
      }
    }
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e).slice(0, 200) }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify(result), {
    status: 200, headers: { "Content-Type": "application/json" },
  });
});
