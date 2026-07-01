// coach-lifecycle — empujones automáticos de ciclo de vida a los coaches.
//
// La idea: que los coaches "vayan haciendo" SOLOS, sin que Micaela tenga que
// correr atrás de cada uno. Esta function recorre todos los coaches, calcula
// en qué momento de su arranque están y a cada uno le manda un empujón
// GENÉRICO —el mismo hilo para cualquier nicho (Carrera / Fitness / Financiero):
// que sigan entrando y avanzando— con un botón al panel. Y si un coach que YA
// PAGÓ está por caerse, le avisa a Micaela para que intervenga ella.
//
// Momentos (máximo 1 empujón por coach por corrida, anti-spam vía coach_nudges):
//   1. welcome_no_client — alta ≥2 d y todavía 0 clientes  → "sumá tu primer cliente"
//   2. sigue_avanzando   — ya tiene ≥1 cliente             → "seguí explorando el panel"
//   3. buen_avance       — ya tiene ≥2 clientes            → felicitación sobria (una vez)
//   4. reactivacion      — ≥14 d sin entrar (y con clientes o pagante) → "¿seguimos?" (cooldown 14 d)
//      + admin_churn_alert — si además es PAGANTE → mail a Micaela        (cooldown 14 d)
//
// Genérico a propósito: NO menciona features concretas (informe IA, etc.) ni
// depende del nicho. Sirve igual para todos los coaches.
//
// Canales: email (Brevo via send-email) + push (send-push). El push es best-effort.
// Respeta el opt-out del coach: configuracion.notifs.lifecycle === false → no recibe.
//
// Disparo: GitHub Actions cron diario (.github/workflows/coach-lifecycle.yml)
// con header X-Trigger-Secret = AGENT_TRIGGER_SECRET.
//
// Env (Supabase Edge Functions → Secrets):
//   SUPABASE_URL               — auto-inyectada
//   SUPABASE_SERVICE_ROLE_KEY  — auto-inyectada
//   AGENT_TRIGGER_SECRET       — mismo valor que el secret de GitHub
//   ADMIN_EMAIL                — opcional, fallback mmicaela.jairedin@gmail.com
//
// Deploy: supabase functions deploy coach-lifecycle --no-verify-jwt

const PANEL_URL = "https://pathwaycareercoach.com/panel-v2.html";
// Deep-links: cada mail cae en el paso exacto (el panel lee ?go= en bootPanel).
const GO_CLIENTES = PANEL_URL + "?go=clientes";
const GO_RESUMEN = PANEL_URL + "?go=resumen";
const REPLY_TO = "hi@pathwaycareercoach.com";
const DAY = 24 * 60 * 60 * 1000;

function esc(s: unknown): string {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Párrafo de cuerpo centrado (mismo estilo en todos los mails).
function P(t: string): string {
  return `<p style="font-family:Arial,sans-serif;font-size:15px;color:#40584C;line-height:1.65;text-align:center;margin:0 0 26px;">${t}</p>`;
}

// Plantilla de email de marca: cabecera verde + ícono redondo + tarjeta blanca
// + botón verde + pie con la baja. Todo con HTML tabular + estilos inline
// (email-safe, se ve igual en Gmail / Outlook / Apple Mail).
function emailHtml(
  primer: string, icon: string, iconBg: string,
  inner: string, ctaText: string, ctaUrl: string, footer?: string,
): string {
  const foot = footer ||
    "Recibes esto porque tienes tu cuenta de coach en Pathway. ¿No quieres estos recordatorios? Responde este mail y los damos de baja. 💚";
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#EAF1ED;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EAF1ED;padding:26px 12px;"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
<tr><td style="background:#2D6A4F;border-radius:16px 16px 0 0;padding:20px 28px;text-align:center;">
<span style="font-family:Georgia,serif;font-size:21px;color:#ffffff;font-weight:600;letter-spacing:-.5px;">Pathway <span style="color:#95D5B2;">&bull;</span></span>
</td></tr>
<tr><td style="background:#ffffff;padding:34px 34px 30px;border-left:1px solid #E3EFE8;border-right:1px solid #E3EFE8;">
<div style="width:58px;height:58px;line-height:58px;text-align:center;background:${iconBg};border-radius:50%;font-size:27px;margin:0 auto 18px;">${icon}</div>
<h2 style="font-family:Georgia,serif;font-size:21px;color:#1B4332;text-align:center;margin:0 0 12px;font-weight:600;">Hola ${esc(primer)}</h2>
${inner}
<table role="presentation" align="center" cellpadding="0" cellspacing="0" style="margin:0 auto;"><tr><td style="border-radius:11px;background:#2D6A4F;">
<a href="${ctaUrl}" style="display:inline-block;padding:13px 30px;font-family:Arial,sans-serif;font-size:15px;color:#ffffff;font-weight:700;text-decoration:none;">${esc(ctaText)} &rarr;</a>
</td></tr></table>
</td></tr>
<tr><td style="background:#F3F8F5;border-radius:0 0 16px 16px;padding:16px 28px;text-align:center;border:1px solid #E3EFE8;border-top:none;">
<p style="font-family:Arial,sans-serif;font-size:12px;color:#8A9A91;line-height:1.5;margin:0;">${foot}</p>
</td></tr>
</table></td></tr></table>
</body></html>`;
}

// Definición de cada nudge: copy de email (español neutro) + copy de push.
function buildNudge(kind: string, primer: string) {
  switch (kind) {
    case "welcome_no_client":
      return {
        subject: "🌱 Demos juntos el primer paso en Pathway",
        html: emailHtml(primer, "🌱", "#E9F5EF",
          P(`¡Qué bueno tenerte en Pathway! Tu cuenta ya está lista. El mejor primer paso es <strong>sumar a tu primer cliente</strong>: te toma menos de un minuto y, desde ahí, tienes todo tu espacio para empezar a trabajar con él. Cuando quieras, entra y lo damos juntos. 💚`),
          "Sumar mi primer cliente", GO_CLIENTES),
        push: { title: "Demos el primer paso 🌱", body: "Suma a tu primer cliente en Pathway." },
      };
    case "sigue_avanzando":
      return {
        subject: "🚀 Sigue avanzando con tu cliente",
        html: emailHtml(primer, "🚀", "#E9F5EF",
          P(`¡Ya diste el primer paso! Ahora entra a tu panel y <strong>explora las herramientas</strong> que tienes para acompañar a tu cliente. Cada cosa que sumas hace que sienta que está en buenas manos. Tómate unos minutos y sigue armando su proceso — vas muy bien. 🌱`),
          "Entrar a mi panel", GO_CLIENTES),
        push: { title: "Sigue avanzando 🚀", body: "Explora las herramientas para tu cliente." },
      };
    case "buen_avance":
      return {
        subject: "🌱 Vas por buen camino",
        html: emailHtml(primer, "⭐", "#FBF3DE",
          P(`Queremos reconocértelo: estás <strong>avanzando muy bien</strong> con tus clientes en Pathway. Cada paso que das se nota del otro lado. Sigue así — y si necesitas una mano con algo, responde este mail y te ayudo. 💚`),
          "Ver mi progreso", GO_RESUMEN),
        push: { title: "Vas por buen camino 🌱", body: "Estás avanzando muy bien. Mira tu progreso." },
      };
    case "reactivacion":
      return {
        subject: "👋 Te extrañamos por acá",
        html: emailHtml(primer, "👋", "#E9F5EF",
          P(`Hace unos días que no entras a Pathway, y tus clientes te esperan del otro lado. Con un par de minutos <strong>retomas justo donde lo dejaste</strong>. Y si necesitas ayuda con algo, responde este mail y te doy una mano personalmente. Te esperamos. 🌱`),
          "Volver a mi panel", GO_CLIENTES),
        push: { title: "Te extrañamos 👋", body: "Tus clientes te esperan en Pathway." },
      };
    default:
      return null;
  }
}

async function countRows(url: string, headers: Record<string, string>): Promise<number> {
  try {
    const r = await fetch(url, { headers: { ...headers, Prefer: "count=exact", Range: "0-0" } });
    const cr = r.headers.get("content-range") || "0/0";
    return parseInt(cr.split("/")[1] || "0", 10) || 0;
  } catch (_e) { return 0; }
}

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
  const ADMIN_EMAIL = (Deno.env.get("ADMIN_EMAIL") || "mmicaela.jairedin@gmail.com").trim();
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return new Response(JSON.stringify({ error: "missing SUPABASE_URL / SERVICE_ROLE_KEY" }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
  const sbHeaders = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` };
  const now = Date.now();

  // Helpers de envío --------------------------------------------------------
  async function sendEmail(to: string, toName: string, subject: string, html: string) {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
      body: JSON.stringify({ to, to_name: toName, subject, html, reply_to: REPLY_TO }),
    });
    return r.ok;
  }
  async function sendPush(email: string, title: string, body: string, tag: string) {
    try {
      await fetch(`${SUPABASE_URL}/functions/v1/send-push`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
        body: JSON.stringify({ user_email: email, title, body, url: PANEL_URL, tag }),
      });
    } catch (_e) { /* best-effort */ }
  }
  async function recordNudge(coachId: string, plantilla: string, canal: string) {
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/coach_nudges`, {
        method: "POST",
        headers: { ...sbHeaders, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ coach_id: coachId, plantilla_id: plantilla, canal }),
      });
    } catch (_e) { /* no romper la corrida por un insert */ }
  }

  const result = {
    coaches: 0, enviados: 0, saltados: 0,
    porTipo: {} as Record<string, number>,
    alertasAdmin: 0, errores: [] as string[],
  };

  try {
    const cRes = await fetch(
      `${SUPABASE_URL}/rest/v1/usuarios?rol=in.(coach,admin)&select=id,email,nombre,configuracion,created_at,last_seen,activo`,
      { headers: sbHeaders },
    );
    const coaches: Array<Record<string, unknown>> = cRes.ok ? await cRes.json() : [];
    result.coaches = coaches.length;

    for (const u of coaches) {
      const email = String(u.email || "").trim().toLowerCase();
      const cfg = (u.configuracion as Record<string, unknown>) || {};
      const notifs = (cfg.notifs as Record<string, unknown>) || {};
      const nombre = String(u.nombre || "");
      const primer = nombre.split(" ")[0] || "coach";

      // Filtros: sin email, opt-out, cuenta deshabilitada, admin/cortesía vitalicia.
      const vitalicio = cfg.es_pro_vitalicio === true || u.rol === "admin";
      if (!email || notifs.lifecycle === false || u.activo === false || vitalicio) {
        result.saltados++; continue;
      }

      try {
        const id = encodeURIComponent(String(u.id));
        // Señal genérica de avance: cuántos clientes cargó (no depende del nicho).
        const nClients = await countRows(`${SUPABASE_URL}/rest/v1/candidatos?coach_id=eq.${id}&select=id`, sbHeaders);
        const estadoSub = String(cfg.estado_sub || "");
        const isPaying = estadoSub === "activa";

        const altaTs = u.created_at ? +new Date(u.created_at as string) : 0;
        const seenRaw = (cfg.last_login as string) || (u.last_seen as string) || (u as Record<string, unknown>).last_login as string || (u.created_at as string) || "";
        const seenTs = seenRaw ? +new Date(seenRaw) : 0;
        const dAlta = altaTs ? (now - altaTs) / DAY : 999;
        const dSeen = seenTs ? (now - seenTs) / DAY : 999;

        // Historial de nudges ya enviados a este coach.
        const hRes = await fetch(
          `${SUPABASE_URL}/rest/v1/coach_nudges?coach_id=eq.${id}&select=plantilla_id,sent_at&order=sent_at.desc`,
          { headers: sbHeaders },
        );
        const hist: Array<Record<string, unknown>> = hRes.ok ? await hRes.json() : [];
        const sentEver = (p: string) => hist.some((h) => h.plantilla_id === p);
        const sentWithin = (p: string, days: number) => hist.some((h) =>
          h.plantilla_id === p && h.sent_at && (now - +new Date(h.sent_at as string)) / DAY < days);
        // Tope global anti-abuso: jamás dos empujones al coach en menos de 3 días,
        // sin importar el tipo (el aviso interno a Micaela no cuenta).
        const recientes = hist.some((h) => h.plantilla_id !== "admin_churn_alert" &&
          h.sent_at && (now - +new Date(h.sent_at as string)) / DAY < 3);

        // ── Decisión: primer match gana (máx 1 empujón por corrida) ──────────
        // Orden = viaje natural del coach: empezá → seguí → ¡bien! → volvé.
        let kind: string | null = null;
        if (nClients === 0 && dAlta >= 2 && dAlta <= 21 && !sentEver("welcome_no_client")) {
          kind = "welcome_no_client";                   // empujar primer cliente
        } else if (nClients >= 1 && dAlta >= 4 && !sentEver("sigue_avanzando")) {
          kind = "sigue_avanzando";                     // seguir explorando el panel
        } else if (nClients >= 2 && !sentEver("buen_avance")) {
          kind = "buen_avance";                         // felicitar el avance (una vez)
        } else if (dSeen >= 14 && (nClients > 0 || isPaying) && !sentWithin("reactivacion", 14)) {
          kind = "reactivacion";                        // reactivar al ausente
        }

        if (!kind || recientes) { result.saltados++; continue; }

        const n = buildNudge(kind, primer);
        if (!n) { result.saltados++; continue; }

        const okEmail = await sendEmail(email, nombre, n.subject, n.html);
        await sendPush(email, n.push.title, n.push.body, "lifecycle-" + kind);
        await recordNudge(String(u.id), kind, "email+push");

        if (okEmail) { result.enviados++; result.porTipo[kind] = (result.porTipo[kind] || 0) + 1; }
        else result.errores.push(`${email}: send-email falló (${kind})`);

        // Aviso a Micaela: coach PAGANTE por caerse (no la molestamos por los de prueba).
        if (kind === "reactivacion" && isPaying && !sentWithin("admin_churn_alert", 14)) {
          const dias = Math.round(dSeen);
          await sendEmail(ADMIN_EMAIL, "Micaela",
            `⚠️ Coach pagante inactivo: ${nombre}`,
            emailHtml("Micaela", "⚠️", "#FBECEC",
              P(`<strong>${esc(nombre)}</strong> (${esc(email)}) es coach <strong>pagante</strong> y lleva <strong>${dias} días</strong> sin entrar. Puede estar por darse de baja — un mensaje personal tuyo ahora puede marcar la diferencia y retenerlo.`) +
              P(`<span style="color:#5A6A60;font-size:13px;">El sistema ya le envió un recordatorio automático; este aviso es solo para que intervengas tú si quieres.</span>`),
              "Abrir el panel", PANEL_URL,
              "Aviso interno de Pathway — solo lo recibes tú como admin."));
          await recordNudge(String(u.id), "admin_churn_alert", "admin");
          result.alertasAdmin++;
        }
      } catch (e) {
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
