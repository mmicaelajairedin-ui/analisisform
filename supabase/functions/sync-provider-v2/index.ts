// Supabase Edge Function — sync-provider-v2
//
// Sincroniza cita con proveedor (Zoom, Google Meet, Sala Pathway).
// Genera URL + tokens, reintentos con backoff, idempotencia.
//
// Desplegar:
//   supabase functions deploy sync-provider-v2 --no-verify-jwt

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

// ============================================================================
// JWT PARA SALA PATHWAY
// ============================================================================
// Generar JWT simple sin librerías (Deno no tiene crypto.subtle fácil).
// Usamos HMAC-SHA256 + Base64 para firmar.
async function createSalaJWT(
  citaId: string,
  coachId: string,
  secretKey: string
): Promise<string> {
  // Header
  const header = {
    alg: "HS256",
    typ: "JWT",
  };

  // Payload: cita_id, coach_id, exp (1h desde ahora)
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    cita_id: citaId,
    coach_id: coachId,
    exp: now + 3600, // 1 hora
    iat: now,
  };

  // Codificar header y payload a Base64
  const headerB64 = btoa(JSON.stringify(header))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
  const payloadB64 = btoa(JSON.stringify(payload))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");

  const message = `${headerB64}.${payloadB64}`;

  // Firmar con HMAC-SHA256
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secretKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, enc.encode(message));

  // Convertir signature a Base64
  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");

  return `${message}.${signatureB64}`;
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
      error: "Google token not found",
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
    const zoomResponse = await fetch("https://api.zoom.us/v2/users/me/meetings", {
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
    });

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

async function syncSalaPathway(
  cita_id: string,
  coach_id: string
): Promise<{ url: string | null; token: string | null; error: string | null }> {
  try {
    const jwtSecret = Deno.env.get("SALA_JWT_SECRET");
    if (!jwtSecret) {
      return {
        url: null,
        token: null,
        error: "SALA_JWT_SECRET not configured",
      };
    }

    // Generar JWT token (1h TTL)
    const token = await createSalaJWT(cita_id, coach_id, jwtSecret);

    // Construir URL con token y cita_id
    const baseUrl = Deno.env.get("SALA_BASE_URL") ||
      "https://pathwaycareercoach.com";
    const salaUrl = `${baseUrl}/sala.html?token=${encodeURIComponent(token)}&cita_id=${cita_id}`;

    return { url: salaUrl, token: token, error: null };
  } catch (error) {
    return {
      url: null,
      token: null,
      error: `Sala token generation error: ${error.message}`,
    };
  }
}

// ============================================================================
// OBTENER URL DEL PROVIDER
// ============================================================================
async function getProviderUrl(
  provider: string,
  coach_id: string,
  cita_id: string,
  event_data: {
    titulo: string;
    fecha: string;
    cliente_email: string;
  }
): Promise<{
  url: string | null;
  token: string | null;
  error: string | null;
}> {
  try {
    switch (provider) {
      case "google_meet": {
        const result = await syncGoogleMeet(coach_id, event_data);
        return { ...result, token: null };
      }
      case "zoom": {
        const result = await syncZoom(coach_id, event_data);
        return { ...result, token: null };
      }
      case "pathway_room": {
        return await syncSalaPathway(cita_id, coach_id);
      }
      default:
        return {
          url: null,
          token: null,
          error: `Unknown provider: ${provider}`,
        };
    }
  } catch (error) {
    return { url: null, token: null, error: error.message };
  }
}

// ============================================================================
// FUNCIÓN PRINCIPAL
// ============================================================================
Deno.serve(async (req: Request): Promise<Response> => {
  try {
    const { cita_id, coach_id, provider } =
      (await req.json()) as SyncProviderRequest;

    if (!cita_id || !coach_id || !provider) {
      return new Response(
        JSON.stringify({
          ok: false,
          provider_error: "Missing required fields (cita_id, coach_id, provider)",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // ====================================================================
    // OBTENER DATOS DE LA CITA
    // ====================================================================
    const { data: cita, error: citaError } = await supabase
      .from("citas")
      .select(
        "id, titulo, fecha, cliente_email, provider_retry_count, provider_url, provider_ready_at"
      )
      .eq("id", cita_id)
      .eq("coach_id", coach_id)
      .single();

    if (citaError || !cita) {
      return new Response(
        JSON.stringify({
          ok: false,
          provider_error: `Cita not found or not owned by coach: ${citaError?.message}`,
        }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // ====================================================================
    // IDEMPOTENCIA: Si ya synced, no reintentar
    // ====================================================================
    if (cita.provider_url && cita.provider_ready_at) {
      console.log(
        `[sync-provider-v2] Cita ${cita_id} already synced, skipping retry`
      );
      return new Response(
        JSON.stringify({
          ok: true,
          provider_url: cita.provider_url,
          message: "Already synced",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // ====================================================================
    // RETRY LOOP CON BACKOFF EXPONENCIAL
    // ====================================================================
    let attemptNumber = cita.provider_retry_count || 0;
    let lastError = "";

    while (attemptNumber < MAX_RETRIES) {
      // Llamar a provider
      const { url, token, error } = await getProviderUrl(
        provider,
        coach_id,
        cita_id,
        {
          titulo: cita.titulo,
          fecha: cita.fecha,
          cliente_email: cita.cliente_email,
        }
      );

      if (url) {
        // ✅ ÉXITO: Sincronizar URL a base de datos
        const updateData: Record<string, unknown> = {
          provider_url: url,
          provider_ready_at: new Date().toISOString(),
          provider_error: null,
          provider_retry_count: attemptNumber,
        };

        // Agregar sala_token solo si es Sala Pathway
        if (provider === "pathway_room" && token) {
          updateData.sala_token = token;
        }

        const { error: updateError } = await supabase
          .from("citas")
          .update(updateData)
          .eq("id", cita_id)
          .eq("coach_id", coach_id);

        if (updateError) {
          return new Response(
            JSON.stringify({
              ok: false,
              provider_error: `Failed to save provider_url: ${updateError.message}`,
            }),
            { status: 500, headers: { "Content-Type": "application/json" } }
          );
        }

        console.log(`[sync-provider-v2] ✓ Synced cita ${cita_id} (${provider})`);
        return new Response(
          JSON.stringify({
            ok: true,
            provider_url: url,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
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

        console.error(
          `[sync-provider-v2] ✗ Non-retriable error: ${lastError}`
        );
        return new Response(
          JSON.stringify({
            ok: false,
            provider_error: lastError,
            retry_count: attemptNumber + 1,
          }),
          { status: 422, headers: { "Content-Type": "application/json" } }
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

    console.error(
      `[sync-provider-v2] ✗ Max retries exceeded for cita ${cita_id}`
    );
    return new Response(
      JSON.stringify({
        ok: false,
        provider_error: `Max retries exceeded: ${lastError}`,
        retry_count: MAX_RETRIES,
      }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error(`[sync-provider-v2] Unexpected error: ${String(error)}`);
    return new Response(
      JSON.stringify({
        ok: false,
        provider_error: `Unexpected error: ${String(error).slice(0, 200)}`,
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
