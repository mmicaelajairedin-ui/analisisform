// Supabase Edge Function — select-provider
//
// Decide qué proveedor usar para la cita (Zoom, Google Meet, o Sala Pathway).
// Centraliza la lógica de decisión en el backend.
//
// Desplegar:
//   supabase functions deploy select-provider --no-verify-jwt

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

Deno.serve(async (req: Request): Promise<Response> => {
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
        { status: 400, headers: { "Content-Type": "application/json" } }
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
        { status: 404, headers: { "Content-Type": "application/json" } }
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
        { status: 200, headers: { "Content-Type": "application/json" } }
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
        { status: 404, headers: { "Content-Type": "application/json" } }
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

    let selectedProvider: "zoom" | "google_meet" | "pathway_room" =
      "pathway_room";
    let decisionReason = "";

    // --- Opción 1: Zoom ---
    if (coach.zoom_token && coach.zoom_token.length > 0) {
      const expiresAt = new Date(coach.zoom_token_expires || "");
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
      const isGmailPersonal = coach.email
        .toLowerCase()
        .endsWith("@gmail.com");

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
      decisionReason =
        decisionReason ||
        "No provider tokens available, using Sala Pathway (fallback)";
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
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // ========================================================================
    // ÉXITO: Provider decidido y registrado
    // ========================================================================
    console.log(
      `[select-provider] ✓ Decided ${selectedProvider} for cita ${cita_id}: ${decisionReason}`
    );
    return new Response(
      JSON.stringify({
        ok: true,
        provider: selectedProvider,
        reason: decisionReason,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error(`[select-provider] Error: ${String(error)}`);
    return new Response(
      JSON.stringify({
        ok: false,
        error: `Unexpected error: ${String(error).slice(0, 200)}`,
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
