// Supabase Edge Function — multicoach-exchange-handoff
//
// Intercambia un código de handoff por la sesión del usuario.
//
// Flujo:
// 1. MultiCoach recibe ?handoff=<código> en la URL
// 2. AppProvider.tsx llama esta función con el código
// 3. Función valida que:
//    - El código existe
//    - No está expirado
//    - No fue usado aún
// 4. Obtiene user_id, org_id y otros datos del usuario
// 5. Marca el código como usado
// 6. Devuelve los datos del usuario + access/refresh tokens
// 7. AppProvider restaura la sesión en localStorage
//
// Desplegar:
//   supabase functions deploy multicoach-exchange-handoff

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as jose from "https://deno.land/x/jose@v5.4.1/index.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, authorization, apikey",
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "content-type": "application/json; charset=utf-8" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("", { headers: CORS });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const { code } = (await req.json()) as { code?: string };

    if (!code) {
      return json({ error: "Missing handoff code" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar y validar el código
    const { data: handoffData, error: findError } = await supabase
      .from("handoff_codes")
      .select("*")
      .eq("code", code)
      .single();

    if (findError || !handoffData) {
      return json({ error: "Invalid handoff code" }, 404);
    }

    // Verificar que no está expirado
    const now = new Date();
    const expiresAt = new Date(handoffData.expires_at);
    if (now > expiresAt) {
      return json({ error: "Handoff code expired" }, 401);
    }

    // Verificar que no fue usado ya
    if (handoffData.used_at !== null || !handoffData.is_valid) {
      return json({ error: "Handoff code already used" }, 401);
    }

    const userId = handoffData.user_id;
    const orgId = handoffData.org_id;

    // Obtener datos del usuario
    const { data: userData, error: userError } = await supabase
      .from("usuarios")
      .select("*")
      .eq("id", userId)
      .single();

    if (userError || !userData) {
      return json({ error: "User not found" }, 404);
    }

    // Obtener rol en organización si existe
    let rolEnOrg = userData.rol;
    if (orgId) {
      const { data: roleData } = await supabase
        .from("usuarios_org")
        .select("rol")
        .eq("usuario_id", userId)
        .eq("org_id", orgId)
        .single();

      if (roleData?.rol) {
        rolEnOrg = roleData.rol;
      }
    }

    // Generar nuevo session token para MultiCoach
    // (Usar el JWT de Supabase Auth directamente)
    const { data: sessionData, error: sessionError } = await supabase.auth.admin.createSession(userId);

    if (sessionError || !sessionData?.session) {
      return json({ error: "Failed to create session" }, 500);
    }

    // Marcar código como usado
    await supabase
      .from("handoff_codes")
      .update({
        used_at: new Date().toISOString(),
        is_valid: false,
      })
      .eq("id", handoffData.id);

    // Devolver datos para restaurar sesión en MultiCoach
    return json({
      user: {
        id: userData.id,
        email: userData.email,
        rol: userData.rol,
        nombre: userData.nombre,
        activo: userData.activo,
        org_id: orgId,
        foto_url: userData.foto_url,
        configuracion: userData.configuracion || {},
      },
      session: {
        access_token: sessionData.session.access_token,
        refresh_token: sessionData.session.refresh_token,
        expires_in: sessionData.session.expires_in,
      },
      rol_en_org: rolEnOrg,
    });
  } catch (err) {
    console.error("multicoach-exchange-handoff error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});
