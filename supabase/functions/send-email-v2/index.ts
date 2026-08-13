// Supabase Edge Function — send-email-v2
//
// Envía confirmación de cita por Brevo después de que sync-provider-v2 completa.
// Lee provider_url + provider_error directamente de la BD (no del frontend).
//
// Desplegar:
//   supabase functions deploy send-email-v2 --no-verify-jwt

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

interface SendEmailV2Request {
  cita_id: string;
  coach_id: string;
  cliente_email: string;
}

// ============================================================================
// HTML ESCAPE — Prevenir XSS
// ============================================================================
function escapeHtml(text: string | null | undefined): string {
  if (!text) return "";
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return String(text).replace(/[&<>"']/g, (c) => map[c]);
}

// ============================================================================
// FORMATEAR PROVIDER (para emails)
// ============================================================================
function formatProvider(provider: string): string {
  const map: Record<string, string> = {
    google_meet: "Google Meet",
    zoom: "Zoom",
    pathway_room: "Sala Pathway",
    none: "Pendiente",
  };
  return map[provider] || provider;
}

// ============================================================================
// ENVIAR VÍA BREVO (email transaccional)
// ============================================================================
async function sendViaBrevo(
  to: string,
  subject: string,
  htmlContent: string
): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  const brevoKey = Deno.env.get("BREVO_API_KEY");
  if (!brevoKey) {
    return { ok: false, error: "BREVO_API_KEY not configured" };
  }

  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": brevoKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        sender: {
          email: "hi@pathwaycareercoach.com",
          name: "Pathway Career Coach",
        },
        to: [{ email: to }],
        subject: subject,
        htmlContent: htmlContent,
        // Texto plano derivado del HTML (para Outlook/Gmail plain-text fallback)
        textContent: htmlContent
          .replace(/<br\s*\/?>/gi, "\n")
          .replace(/<\/(p|div|h[1-6]|li)>/gi, "\n")
          .replace(/<[^>]+>/g, "")
          .replace(/&nbsp;/gi, " ")
          .replace(/&amp;/gi, "&")
          .replace(/[ \t]+/g, " ")
          .replace(/\n{3,}/g, "\n\n")
          .trim(),
        headers: {
          "List-Unsubscribe":
            "<mailto:hi@pathwaycareercoach.com?subject=unsubscribe>",
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      }),
    });

    if (response.ok) {
      const data = await response.json();
      return { ok: true, messageId: data.messageId || null };
    } else {
      const errorText = await response.text();
      return {
        ok: false,
        error: `Brevo API error (${response.status}): ${errorText.slice(0, 200)}`,
      };
    }
  } catch (error) {
    return {
      ok: false,
      error: `Brevo request failed: ${String(error).slice(0, 200)}`,
    };
  }
}

// ============================================================================
// CONSTRUIR EMAIL HTML (server-side, escapado)
// ============================================================================
function buildEmailHtml(
  citaTitle: string,
  citaFecha: string,
  provider: string,
  providerUrl: string | null,
  providerError: string | null
): string {
  // Escape todos los valores dinámicos
  const escTitle = escapeHtml(citaTitle);
  const escFecha = escapeHtml(citaFecha);
  const escError = escapeHtml(providerError);
  const escProvider = escapeHtml(formatProvider(provider));
  const escUrl = escapeHtml(providerUrl || "");

  let contentSection = "";
  if (providerUrl) {
    // ✅ ÉXITO: Mostrar link
    contentSection = `
      <p style="font-size: 15px; margin-top: 22px; margin-bottom: 14px;">
        <strong>Enlace de videoconferencia:</strong>
      </p>
      <a href="${escUrl}" style="display: inline-block; padding: 14px 24px; background: #2D5016; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 14px 0;">
        Entrar a la sesión →
      </a>
      <p style="font-size: 12px; color: #666; margin-top: 10px;">
        Plataforma: <strong>${escProvider}</strong>
      </p>
    `;
  } else if (providerError) {
    // ❌ ERROR: Mostrar mensaje de error
    contentSection = `
      <div style="background: #FFF3E0; border-left: 4px solid #FF9800; padding: 14px 16px; margin: 14px 0; border-radius: 6px;">
        <p style="margin: 0 0 8px; font-weight: 600; color: #E65100;">
          ⚠️ Problema al preparar tu sesión
        </p>
        <p style="margin: 0; font-size: 14px; color: #BF360C;">
          ${escError}
        </p>
        <p style="margin: 8px 0 0; font-size: 12px; color: #D84315;">
          Por favor, contacta a tu coach para resolver esto.
        </p>
      </div>
    `;
  } else {
    // ⏳ PENDIENTE: Sync en progreso
    contentSection = `
      <div style="background: #E3F2FD; border-left: 4px solid #2196F3; padding: 14px 16px; margin: 14px 0; border-radius: 6px;">
        <p style="margin: 0 0 8px; font-weight: 600; color: #1565C0;">
          ⏳ Estamos preparando tu enlace de videoconferencia…
        </p>
        <p style="margin: 0; font-size: 13px; color: #0D47A1;">
          Te llegarán los detalles en breve. Si no recibes nada en 5 minutos, por favor contacta a tu coach.
        </p>
      </div>
    `;
  }

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
      body { font-family: Inter, -apple-system, sans-serif; font-size: 14px; line-height: 1.6; color: #1B2E26; background: #FAFDF9; margin: 0; padding: 20px; }
      .container { max-width: 600px; margin: 0 auto; background: #fff; border-radius: 14px; padding: 28px 24px; box-shadow: 0 2px 12px rgba(27,46,38,.04); }
      .header { border-bottom: 1px solid #ECE7DC; padding-bottom: 16px; margin-bottom: 20px; }
      .header h2 { margin: 0; font-size: 18px; font-weight: 600; color: #1F5740; }
      .content { margin: 0; }
      .footer { border-top: 1px solid #ECE7DC; margin-top: 24px; padding-top: 16px; font-size: 12px; color: #666; text-align: center; }
      strong { color: #1F5740; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h2>Tu sesión está confirmada</h2>
      </div>
      <div class="content">
        <p>¡Hola!</p>
        <p>Tu sesión de coaching está confirmada:</p>
        <p style="background: #F4F1EA; padding: 12px 16px; border-radius: 8px; margin: 16px 0;">
          <strong style="display: block; font-size: 15px;">${escTitle}</strong>
          <span style="font-size: 13px; color: #666;">Fecha y hora: ${escFecha}</span>
        </p>
        ${contentSection}
        <p style="margin-top: 24px;">¡Nos vemos pronto!</p>
        <p style="margin-bottom: 0; font-size: 13px; color: #666;">
          Team Pathway Career Coach<br>
          <a href="https://pathwaycareercoach.com" style="color: #1F5740; text-decoration: none;">pathwaycareercoach.com</a>
        </p>
      </div>
      <div class="footer">
        <p>Este es un email automático. Por favor, no respondas a esta dirección.</p>
      </div>
    </div>
  </body>
</html>`;
}

// ============================================================================
// FUNCIÓN PRINCIPAL
// ============================================================================
Deno.serve(async (req: Request): Promise<Response> => {
  try {
    const { cita_id, coach_id, cliente_email } =
      (await req.json()) as SendEmailV2Request;

    if (!cita_id || !coach_id || !cliente_email) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Missing required fields (cita_id, coach_id, cliente_email)",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // ====================================================================
    // PASO 1: OBTENER CITA DE BASE DE DATOS
    // ====================================================================
    const { data: cita, error: citaError } = await supabase
      .from("citas")
      .select(
        "id, titulo, fecha, provider, provider_url, provider_error, provider_ready_at"
      )
      .eq("id", cita_id)
      .eq("coach_id", coach_id)
      .single();

    if (citaError || !cita) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: `Cita not found or not owned by coach: ${citaError?.message}`,
        }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // ====================================================================
    // PASO 2: ESPERAR A QUE provider_url ESTÉ DISPONIBLE (RETRY LOOP)
    // ====================================================================
    // send-email-v2 se ejecuta DESPUÉS de sync-provider-v2, pero puede haber
    // un pequeño lag. Esperamos con retry de 1s × 5 intentos = 5 segundos máximo
    //
    const retryDelays = [1000, 1000, 1500, 2000, 2000]; // ms
    let attempts = 0;

    while (!cita.provider_url && attempts < retryDelays.length) {
      attempts++;
      const delayMs = retryDelays[attempts - 1];
      console.log(
        `[send-email-v2] Waiting for provider_url (attempt ${attempts}/${retryDelays.length})...`
      );

      await new Promise((resolve) => setTimeout(resolve, delayMs));

      // Reintentar fetch
      const { data: updatedCita, error: fetchError } = await supabase
        .from("citas")
        .select("provider_url, provider_error, provider")
        .eq("id", cita_id)
        .single();

      if (!fetchError && updatedCita) {
        cita.provider_url = updatedCita.provider_url;
        cita.provider_error = updatedCita.provider_error;
        cita.provider = updatedCita.provider;
      }
    }

    // ====================================================================
    // PASO 3: CONSTRUIR EMAIL HTML (SERVER-SIDE, ESCAPADO)
    // ====================================================================
    let citaFechaFormatted = "";
    try {
      const fecha = new Date(cita.fecha);
      citaFechaFormatted = fecha.toLocaleDateString("es-ES", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (_e) {
      citaFechaFormatted = cita.fecha || "Sin fecha";
    }

    const emailHtml = buildEmailHtml(
      cita.titulo || "Sesión de coaching",
      citaFechaFormatted,
      cita.provider || "none",
      cita.provider_url,
      cita.provider_error
    );

    // ====================================================================
    // PASO 4: ENVIAR EMAIL VÍA BREVO
    // ====================================================================
    const emailResult = await sendViaBrevo(
      cliente_email,
      `Cita confirmada: ${escapeHtml(cita.titulo || "Sesión de coaching")}`,
      emailHtml
    );

    if (!emailResult.ok) {
      console.error(`[send-email-v2] Email send failed: ${emailResult.error}`);
      // Best-effort: no fallar si email falla; el coach y cliente pueden ver
      // los detalles en panel/portal
    }

    // ====================================================================
    // ÉXITO
    // ====================================================================
    return new Response(
      JSON.stringify({
        ok: true,
        provider_url: cita.provider_url || null,
        provider: cita.provider || "none",
        email_sent: emailResult.ok,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error(`[send-email-v2] Error: ${String(error)}`);
    // Best-effort: no fallar si hay error
    return new Response(
      JSON.stringify({
        ok: false,
        error: String(error).slice(0, 300),
        message:
          "Email sending best-effort; check panel and database for details",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
