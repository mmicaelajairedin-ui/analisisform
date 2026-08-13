# FASE 1 — EDGE FUNCTIONS EXACTAS

**Propósito:** Implementar la lógica de provider centralizadamente en backend.  
**Responsabilidad:** Backend SOLO (frontend NO decide provider).  
**Patrón:** Async, idempotente, transaccional.

---

## FUNCIÓN 1: `select-provider` (NUEVA)

### Ubicación: `supabase/functions/select-provider/index.ts`

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

interface SelectProviderRequest {
  cita_id: string;
  coach_id: string;
}

interface SelectProviderResponse {
  ok: boolean;
  provider?: "google_meet" | "zoom" | "pathway_room" | "none";
  reason?: string;
  error?: string;
}

serve(async (req: Request): Promise<Response> => {
  try {
    // ========================================================================
    // VALIDACIÓN DE ENTRADA
    // ========================================================================
    const { cita_id, coach_id } = (await req.json()) as SelectProviderRequest;

    if (!cita_id || !coach_id) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Missing cita_id or coach_id",
        }),
        { status: 400 }
      );
    }

    // ========================================================================
    // PASO 1: VERIFICAR QUE CITA EXISTE Y PERTENECE AL COACH
    // ========================================================================
    const { data: cita, error: citaError } = await supabase
      .from("citas")
      .select("id, coach_id, estado, provider")
      .eq("id", cita_id)
      .eq("coach_id", coach_id)
      .single();

    if (citaError || !cita) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: `Cita not found or not owned by coach: ${citaError?.message}`,
        }),
        { status: 404 }
      );
    }

    // Si ya tiene provider decidido, NO decidir de nuevo (idempotencia)
    if (cita.provider && cita.provider !== "none") {
      return new Response(
        JSON.stringify({
          ok: true,
          provider: cita.provider,
          reason: "Already decided",
        }),
        { status: 200 }
      );
    }

    // ========================================================================
    // PASO 2: OBTENER CONFIGURACIÓN DEL COACH
    // ========================================================================
    const { data: coach, error: coachError } = await supabase
      .from("usuarios")
      .select(
        "id, email, zoom_token, zoom_token_expires, google_refresh_token"
      )
      .eq("id", coach_id)
      .single();

    if (coachError || !coach) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: `Coach not found: ${coachError?.message}`,
        }),
        { status: 404 }
      );
    }

    // ========================================================================
    // PASO 3: DECISIÓN DE PROVIDER (ÁRBOL DE DECISIÓN)
    // ========================================================================
    //
    // Prioridad:
    // 1. Zoom (si token válido y no expirado)
    // 2. Google Meet (si token válido, NO Gmail personal, NO expirado)
    // 3. Sala Pathway (fallback, siempre funciona)
    //

    let selectedProvider: "zoom" | "google_meet" | "pathway_room" = "pathway_room";
    let decisionReason = "";

    // --- Opción 1: Zoom ---
    if (coach.zoom_token && coach.zoom_token.length > 0) {
      const expiresAt = new Date(coach.zoom_token_expires);
      if (expiresAt > new Date()) {
        selectedProvider = "zoom";
        decisionReason = "Zoom token valid";
      } else {
        decisionReason = "Zoom token expired, trying Google Meet";
      }
    }

    // --- Opción 2: Google Meet ---
    if (
      selectedProvider === "pathway_room" &&
      coach.google_refresh_token &&
      coach.google_refresh_token.length > 0
    ) {
      // CRITICAL: Detectar Gmail personal (@gmail.com)
      // Google Workspace genera Google Meet links, Gmail personal NO
      const isGmailPersonal = coach.email.toLowerCase().endsWith("@gmail.com");

      if (!isGmailPersonal) {
        selectedProvider = "google_meet";
        decisionReason = "Google Workspace token valid";
      } else {
        decisionReason =
          "Gmail personal account (no Google Meet), using Sala Pathway";
      }
    }

    // --- Opción 3: Sala Pathway (fallback) ---
    if (selectedProvider === "pathway_room") {
      decisionReason = decisionReason || "No provider tokens, using Sala Pathway";
    }

    // ========================================================================
    // PASO 4: REGISTRAR DECISIÓN EN BASE DE DATOS
    // ========================================================================
    const { error: updateError } = await supabase
      .from("citas")
      .update({
        provider: selectedProvider,
      })
      .eq("id", cita_id)
      .eq("coach_id", coach_id);

    if (updateError) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: `Failed to update provider: ${updateError.message}`,
        }),
        { status: 500 }
      );
    }

    // ========================================================================
    // ÉXITO: Provider decidido y registrado
    // ========================================================================
    return new Response(
      JSON.stringify({
        ok: true,
        provider: selectedProvider,
        reason: decisionReason,
      }),
      { status: 200 }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: `Unexpected error: ${error.message}`,
      }),
      { status: 500 }
    );
  }
});
```

### Flujo de decisión (ASCII):

```
COACH crea CITA
  ↓
select-provider (backend async)
  ├─ ¿Zoom token válido y no expirado?
  │   └─ Sí → provider='zoom' ✓
  │
  ├─ ¿Google token válido y NO @gmail.com?
  │   └─ Sí → provider='google_meet' ✓
  │
  └─ Sala Pathway (fallback) → provider='pathway_room' ✓
      ↓
    PATCH citas SET provider='...'
      ↓
    sync-provider-v2 (next step)
```

---

## FUNCIÓN 2: `sync-provider-v2` (NUEVA)

### Ubicación: `supabase/functions/sync-provider-v2/index.ts`

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

interface SyncProviderRequest {
  cita_id: string;
  coach_id: string;
  provider: "google_meet" | "zoom" | "pathway_room";
}

interface SyncProviderResponse {
  ok: boolean;
  provider_url?: string;
  provider_error?: string;
  retry_count?: number;
}

// Backoff exponencial: 2s, 4s, 8s, 16s, 60s
const RETRY_DELAYS_MS = [2000, 4000, 8000, 16000, 60000];
const MAX_RETRIES = 5;

// Categorizar errores como retriable o no
function isRetriable(error: string): boolean {
  const nonRetriable = [
    "401", // Auth error
    "403", // Forbidden
    "422", // Invalid data
    "Gmail", // Gmail personal
  ];
  return !nonRetriable.some((code) => error.includes(code));
}

async function getProviderUrl(
  provider: string,
  coach_id: string,
  event_data: {
    titulo: string;
    fecha: string;
    cliente_email: string;
  }
): Promise<{ url: string | null; error: string | null }> {
  try {
    switch (provider) {
      case "google_meet": {
        return await syncGoogleMeet(coach_id, event_data);
      }
      case "zoom": {
        return await syncZoom(coach_id, event_data);
      }
      case "pathway_room": {
        return await syncSalaPathway();
      }
      default:
        return { url: null, error: `Unknown provider: ${provider}` };
    }
  } catch (error) {
    return { url: null, error: error.message };
  }
}

// ============================================================================
// PROVIDER-SPECIFIC IMPLEMENTATIONS
// ============================================================================

async function syncGoogleMeet(
  coach_id: string,
  event_data: {
    titulo: string;
    fecha: string;
    cliente_email: string;
  }
): Promise<{ url: string | null; error: string | null }> {
  // Obtener refresh token del coach
  const { data: coach, error: coachError } = await supabase
    .from("usuarios")
    .select("google_refresh_token, email")
    .eq("id", coach_id)
    .single();

  if (coachError || !coach?.google_refresh_token) {
    return {
      url: null,
      error: "Google token not found or Gmail personal account",
    };
  }

  // IMPORTANTE: Gmail personal (@gmail.com) no genera Google Meet
  if (coach.email.toLowerCase().endsWith("@gmail.com")) {
    return {
      url: null,
      error:
        "Gmail personal account does not support Google Meet (requires Google Workspace)",
    };
  }

  try {
    // 1. Refrescar token de Google
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: Deno.env.get("GOOGLE_CLIENT_ID")!,
        client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET")!,
        refresh_token: coach.google_refresh_token,
        grant_type: "refresh_token",
      }).toString(),
    });

    if (!tokenResponse.ok) {
      return {
        url: null,
        error: `Google token refresh failed (${tokenResponse.status}): token revoked or invalid`,
      };
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // 2. Crear evento en Google Calendar con Google Meet
    const calendarEventResponse = await fetch(
      "https://www.googleapis.com/calendar/v3/calendars/primary/events",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          summary: event_data.titulo,
          description: `Coaching session with Pathway Career Coach`,
          start: {
            dateTime: event_data.fecha,
            timeZone: "UTC",
          },
          end: {
            dateTime: new Date(
              new Date(event_data.fecha).getTime() + 60 * 60 * 1000
            ).toISOString(),
            timeZone: "UTC",
          },
          conferenceData: {
            createRequest: {
              requestId: `pathway-${Date.now()}`,
              conferenceSolutionKey: {
                key: "hangoutsMeet",
              },
            },
          },
          attendees: [
            {
              email: event_data.cliente_email,
              responseStatus: "needsAction",
            },
          ],
        }),
      }
    );

    if (!calendarEventResponse.ok) {
      const error = await calendarEventResponse.json();
      return {
        url: null,
        error: `Google Calendar API error: ${error.error?.message || calendarEventResponse.statusText}`,
      };
    }

    const event = await calendarEventResponse.json();
    const meetUrl =
      event.conferenceData?.entryPoints?.[0]?.uri ||
      event.hangoutLink ||
      null;

    if (!meetUrl) {
      return {
        url: null,
        error:
          "Google Meet link not generated (Gmail personal account or API issue)",
      };
    }

    return { url: meetUrl, error: null };
  } catch (error) {
    return { url: null, error: `Google Meet sync error: ${error.message}` };
  }
}

async function syncZoom(
  coach_id: string,
  event_data: {
    titulo: string;
    fecha: string;
    cliente_email: string;
  }
): Promise<{ url: string | null; error: string | null }> {
  // Obtener token de Zoom del coach
  const { data: coach, error: coachError } = await supabase
    .from("usuarios")
    .select("zoom_token")
    .eq("id", coach_id)
    .single();

  if (coachError || !coach?.zoom_token) {
    return { url: null, error: "Zoom token not found" };
  }

  try {
    // Crear meeting en Zoom
    const zoomResponse = await fetch(
      "https://api.zoom.us/v2/users/me/meetings",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${coach.zoom_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          topic: event_data.titulo,
          type: 2, // Scheduled meeting
          start_time: event_data.fecha,
          duration: 60,
          timezone: "UTC",
          settings: {
            host_video: true,
            participant_video: true,
            join_before_host: true,
            waiting_room: false,
          },
        }),
      }
    );

    if (!zoomResponse.ok) {
      const error = await zoomResponse.json();
      return {
        url: null,
        error: `Zoom API error (${zoomResponse.status}): ${error.message || zoomResponse.statusText}`,
      };
    }

    const meeting = await zoomResponse.json();
    return { url: meeting.join_url, error: null };
  } catch (error) {
    return { url: null, error: `Zoom sync error: ${error.message}` };
  }
}

async function syncSalaPathway(): Promise<{
  url: string | null;
  error: string | null;
}> {
  // Sala Pathway: generar token y link
  // El token se genera en sala.html, pero aquí creamos la URL de acceso
  const salaUrl = `${Deno.env.get("SALA_BASE_URL") || "https://pathwaycareercoach.com"}/sala.html`;
  return { url: salaUrl, error: null };
}

// ============================================================================
// FUNCIÓN PRINCIPAL
// ============================================================================

serve(async (req: Request): Promise<Response> => {
  try {
    const { cita_id, coach_id, provider } =
      (await req.json()) as SyncProviderRequest;

    if (!cita_id || !coach_id || !provider) {
      return new Response(
        JSON.stringify({
          ok: false,
          provider_error: "Missing required fields",
        }),
        { status: 400 }
      );
    }

    // ====================================================================
    // OBTENER DATOS DE LA CITA
    // ====================================================================
    const { data: cita, error: citaError } = await supabase
      .from("citas")
      .select("id, titulo, fecha, cliente_email, provider_retry_count")
      .eq("id", cita_id)
      .eq("coach_id", coach_id)
      .single();

    if (citaError || !cita) {
      return new Response(
        JSON.stringify({
          ok: false,
          provider_error: "Cita not found",
        }),
        { status: 404 }
      );
    }

    // ====================================================================
    // RETRY LOOP CON BACKOFF EXPONENCIAL
    // ====================================================================
    let attemptNumber = cita.provider_retry_count || 0;
    let lastError = "";

    while (attemptNumber < MAX_RETRIES) {
      // Llamar a provider
      const { url, error } = await getProviderUrl(provider, coach_id, {
        titulo: cita.titulo,
        fecha: cita.fecha,
        cliente_email: cita.cliente_email,
      });

      if (url) {
        // ✅ ÉXITO: Sincronizar URL a base de datos
        const { error: updateError } = await supabase
          .from("citas")
          .update({
            provider_url: url,
            provider_ready_at: new Date().toISOString(),
            provider_error: null,
            provider_retry_count: attemptNumber,
          })
          .eq("id", cita_id)
          .eq("coach_id", coach_id);

        if (updateError) {
          return new Response(
            JSON.stringify({
              ok: false,
              provider_error: `Failed to save provider_url: ${updateError.message}`,
            }),
            { status: 500 }
          );
        }

        return new Response(
          JSON.stringify({
            ok: true,
            provider_url: url,
          }),
          { status: 200 }
        );
      }

      // ❌ ERROR: Determinar si es retriable
      lastError = error || "Unknown error";

      if (!isRetriable(lastError)) {
        // NO retriable: fallar inmediatamente
        const { error: updateError } = await supabase
          .from("citas")
          .update({
            provider_error: lastError,
            provider_retry_count: attemptNumber + 1,
          })
          .eq("id", cita_id)
          .eq("coach_id", coach_id);

        return new Response(
          JSON.stringify({
            ok: false,
            provider_error: lastError,
            retry_count: attemptNumber + 1,
          }),
          { status: 422 }
        );
      }

      // Retriable: aguardar y reintentar
      attemptNumber++;
      if (attemptNumber < MAX_RETRIES) {
        const delayMs = RETRY_DELAYS_MS[attemptNumber - 1];
        console.log(
          `[sync-provider-v2] Retry ${attemptNumber}/${MAX_RETRIES} after ${delayMs}ms: ${lastError}`
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    // ====================================================================
    // MAX RETRIES ALCANZADOS: Fallar permanentemente
    // ====================================================================
    const { error: updateError } = await supabase
      .from("citas")
      .update({
        provider_error: `Max retries (${MAX_RETRIES}) exceeded: ${lastError}`,
        provider_retry_count: MAX_RETRIES,
      })
      .eq("id", cita_id)
      .eq("coach_id", coach_id);

    return new Response(
      JSON.stringify({
        ok: false,
        provider_error: `Max retries exceeded: ${lastError}`,
        retry_count: MAX_RETRIES,
      }),
      { status: 503 }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        ok: false,
        provider_error: `Unexpected error: ${error.message}`,
      }),
      { status: 500 }
    );
  }
});
```

### Flujo de sincronización:

```
select-provider decidelido provider
  ↓
sync-provider-v2 (backend async)
  ├─ Si provider='google_meet':
  │   ├─ Refrescar token de Google
  │   ├─ Crear evento en Google Calendar
  │   ├─ Extraer Google Meet URL de conferenceData
  │   └─ PATCH provider_url
  │
  ├─ Si provider='zoom':
  │   ├─ Crear meeting en Zoom API
  │   ├─ Obtener join_url
  │   └─ PATCH provider_url
  │
  ├─ Si provider='pathway_room':
  │   ├─ Generar Sala URL
  │   └─ PATCH provider_url
  │
  └─ Si error:
      ├─ ¿Retriable? (timeout, rate limit, network)
      │   └─ Sí → esperar, reintentar con backoff [2s, 4s, 8s, 16s, 60s]
      │
      └─ ¿No-retriable? (auth, invalid data, Gmail)
          └─ Fallar inmediatamente, PATCH provider_error
             ↓
           Panel-v2: "Reintentar" button (manual retry)
```

---

## FUNCIÓN 3: `send-email-v2` (MODIFICADA)

### Ubicación: `supabase/functions/send-email-v2/index.ts`

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";
import emailjs from "https://esm.sh/emailjs-com@3.12.0";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

interface SendEmailV2Request {
  cita_id: string;
  coach_id: string;
  cliente_email: string;
}

serve(async (req: Request): Promise<Response> => {
  try {
    const { cita_id, coach_id, cliente_email } =
      (await req.json()) as SendEmailV2Request;

    if (!cita_id || !coach_id || !cliente_email) {
      return new Response(
        JSON.stringify({ ok: false, error: "Missing required fields" }),
        { status: 400 }
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
          error: "Cita not found",
        }),
        { status: 404 }
      );
    }

    // ====================================================================
    // PASO 2: ESPERAR A QUE provider_url ESTÉ DISPONIBLE (RETRY LOOP)
    // ====================================================================
    // 
    // send-email-v2 se ejecuta DESPUÉS de sync-provider-v2, pero puede haber
    // un pequeño lag. Aquí esperamos el provider_url con retry de 30s × 5 = 2.5 min
    //
    let attempts = 0;
    const maxAttempts = 5;

    while (!cita.provider_url && attempts < maxAttempts) {
      attempts++;
      console.log(
        `[send-email-v2] Waiting for provider_url (attempt ${attempts}/${maxAttempts})...`
      );

      // Esperar 30 segundos
      await new Promise((resolve) => setTimeout(resolve, 30000));

      // Reintentar fetch
      const { data: updatedCita, error: fetchError } = await supabase
        .from("citas")
        .select("provider_url, provider_error")
        .eq("id", cita_id)
        .single();

      if (fetchError) {
        console.error(`[send-email-v2] Fetch error: ${fetchError.message}`);
      } else if (updatedCita) {
        cita.provider_url = updatedCita.provider_url;
        cita.provider_error = updatedCita.provider_error;
      }
    }

    // ====================================================================
    // PASO 3: CONSTRUIR EMAIL HTML (SERVER-SIDE)
    // ====================================================================
    // CRÍTICO: El HTML se construye AQUÍ (backend), no enviado desde frontend
    //
    let emailHtml = `
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; }
          .container { max-width: 600px; margin: 0 auto; }
          .header { background: #2D5016; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .button { display: inline-block; padding: 12px 24px; background: #2D5016; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0; }
          .status { padding: 10px; border-left: 4px solid #ff9800; background: #fff3e0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>Tu cita de coaching está confirmada</h2>
          </div>
          <div class="content">
            <p>¡Hola!</p>
            <p>Tu cita de coaching está confirmada para:</p>
            <p><strong>${cita.titulo}</strong></p>
            <p><strong>Fecha y hora:</strong> ${new Date(cita.fecha).toLocaleString("es-ES")}</p>
            
            ${
              cita.provider_url
                ? `
              <p><strong>Enlace de videoconferencia:</strong></p>
              <a href="${cita.provider_url}" class="button">Entrar a la sesión</a>
              <p><small>Provider: ${formatProvider(cita.provider)}</small></p>
            `
                : cita.provider_error
                  ? `
              <div class="status">
                <p><strong>⚠️ Problema con la videoconferencia:</strong></p>
                <p>${cita.provider_error}</p>
                <p>Por favor, contacta a tu coach para resolver esto.</p>
              </div>
            `
                  : `
              <div class="status">
                <p><strong>⏳ Estamos preparando tu enlace de videoconferencia...</strong></p>
                <p>Te llegarán los detalles en breve. Si no recibes nada en 5 minutos, por favor contacta a tu coach.</p>
              </div>
            `
            }
            
            <p><br></p>
            <p>¡Nos vemos pronto!</p>
            <p>Team Pathway Career Coach</p>
          </div>
        </div>
      </body>
    </html>
    `;

    // ====================================================================
    // PASO 4: ENVIAR EMAIL VIA EMAILJS O BREVO
    // ====================================================================
    // 
    // Usar EmailJS (ya integrado) o Brevo (alternativa)
    // CRITICAL: Email se envía desde backend, NUNCA desde frontend
    //
    emailjs.init(Deno.env.get("EMAILJS_PUBLIC_KEY")!);

    const emailResult = await emailjs.send(
      Deno.env.get("EMAILJS_SERVICE_ID")!,
      Deno.env.get("EMAILJS_TEMPLATE_ID_V2") ||
        Deno.env.get("EMAILJS_TEMPLATE_ID")!,
      {
        to_email: cliente_email,
        subject: `Cita confirmada: ${cita.titulo}`,
        html_message: emailHtml,
      }
    );

    if (!emailResult || !emailResult.ok) {
      console.error(`[send-email-v2] Email send failed: ${emailResult}`);
      // NO fallar si email falla; es best-effort
      // El coach y cliente pueden ver los detalles en panel/portal
    }

    // ====================================================================
    // ÉXITO
    // ====================================================================
    return new Response(
      JSON.stringify({
        ok: true,
        provider_url: cita.provider_url || null,
        email_sent: true,
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error(`[send-email-v2] Error: ${error.message}`);
    // Best-effort: no fallar si hay error
    return new Response(
      JSON.stringify({
        ok: false,
        error: error.message,
        message: "Email sending best-effort; check panel for details",
      }),
      { status: 500 }
    );
  }
});

function formatProvider(provider: string): string {
  const map: Record<string, string> = {
    google_meet: "Google Meet",
    zoom: "Zoom",
    pathway_room: "Sala Pathway",
    none: "Pendiente",
  };
  return map[provider] || provider;
}
```

### Cambios clave de V1 → V2:

| Aspecto | V1 (OLD) | V2 (NEW) |
|--------|----------|---------|
| **HTML** | Pasado desde frontend (reservar.html) | Construido en backend (send-email-v2) |
| **provider_url** | Confiado en frontend | Leído de cita.provider_url de DB |
| **Timing** | Email antes de sync completo | Email después (wait para provider_url) |
| **Retry** | No (envío único) | Retry 5× con delay 30s |
| **Fallback** | Email breaks si no hay URL | Email envia igual con "en preparación" |

---

## DEPLOYMENT (Staging)

```bash
# Deploy todas las edge functions
supabase functions deploy select-provider --no-verify-jwt
supabase functions deploy sync-provider-v2 --no-verify-jwt
supabase functions deploy send-email-v2 --no-verify-jwt

# Verificar que existen
supabase functions list | grep -E 'select-provider|sync-provider-v2|send-email-v2'
```

---

## VARIABLES DE ENTORNO REQUERIDAS

```bash
# .env (Supabase Project Settings → API)
SUPABASE_URL=https://ddxnrsnjdvtqhxunxnwj.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Google OAuth (si no existe, crear en Google Cloud Console)
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REFRESH_TOKEN=... (del coach)

# Zoom (si se usa)
ZOOM_API_KEY=...

# Email (EmailJS o Brevo)
EMAILJS_SERVICE_ID=service_...
EMAILJS_TEMPLATE_ID_V2=template_...
EMAILJS_PUBLIC_KEY=...

# Sala Pathway
SALA_BASE_URL=https://pathwaycareercoach.com
```

---

## SEGURIDAD

### Backend-Only Updates

```
❌ NUNCA hacer PATCH(provider) desde frontend
❌ NUNCA hacer PATCH(provider_url) desde frontend
❌ NUNCA hacer PATCH(provider_error) desde frontend

✅ SOLO desde backend:
  ├─ select-provider (PATCH provider)
  ├─ sync-provider-v2 (PATCH provider_url, provider_error, provider_ready_at)
  └─ send-email-v2 (READ provider_url)
```

### Guardias

- Guardrail en CI: `check-guardrails.js` valida que frontend NO intenta PATCH provider*
- Idempotencia: Si provider ya decidido, NO decidir de nuevo
- Transacionalidad: provider_url PATCH solo si sync exitoso

---

## RESUMEN

✅ `select-provider` — Decide qué provider usar (centralizado, backend)  
✅ `sync-provider-v2` — Obtiene URL del provider (retry con backoff)  
✅ `send-email-v2` — Construye email + envía (espera provider_url)  

**Siguiente:** Frontend changes (reservar-v2.html, panel-v2, cliente.html)
