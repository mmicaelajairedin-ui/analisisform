// Supabase Edge Function — pathway-handoff
//
// Genera un código temporal de un solo uso para transferir la sesión
// de Pathway (pathwaycareercoach.com) a MultiCoach (pathwayplatforms.com).
//
// Flujo:
// 1. Usuario autentica en Pathway login.html
// 2. login.html llama esta función con el JWT del usuario
// 3. Función valida el JWT, obtiene user_id y org_id
// 4. Genera un código temporal (single-use, 5 min expiry)
// 5. Devuelve el código
// 6. login.html redirige a https://pathwayplatforms.com/?handoff=<código>
// 7. MultiCoach intercambia el código por la sesión completa
//
// Desplegar:
//   supabase functions deploy pathway-handoff
//
// Env (auto-inyectadas):
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

// S1 — El codigo es una CREDENCIAL AL PORTADOR: quien lo tenga obtiene una
// sesion completa, con el rol y la organizacion de su dueno, y sin contrasena.
//
// Antes se generaba con Math.random(), que en V8 es xorshift128+: su estado
// interno se reconstruye observando unas pocas salidas y desde ahi se predicen
// las siguientes. Los 32 caracteres daban una falsa sensacion de fuerza — la
// entropia real no era la del alfabeto, era la del generador. Y las instancias
// de Deno se reutilizan entre invocaciones, asi que ese estado persiste entre
// peticiones de usuarios distintos.
//
// Esto NO era deuda dormida: desde que el dueno entra a MultiCoach por handoff,
// este codigo es la unica puerta de entrada al producto.
//
// Solo cambia la GENERACION. El formato pasa a 32 bytes -> 64 hex, que es lo
// que `multicoach-exchange-handoff` ya espera. La arquitectura del handoff no
// se toca.
function generateCode(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("", { headers: CORS });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Missing or invalid authorization header" }, 401);
    }

    const token = authHeader.substring(7);

    // Crear cliente Supabase con token del usuario (para verificar RLS)
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verificar el JWT mediante Supabase Auth
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return json({ error: "Invalid or expired token" }, 401);
    }

    const userId = user.id;
    const userEmail = user.email || "";

    // Obtener org_id del usuario desde la tabla usuarios
    const { data: userData, error: userError } = await supabase
      .from("usuarios")
      .select("org_id, rol")
      .eq("email", userEmail)
      .single();

    if (userError || !userData) {
      return json({ error: "User not found in database" }, 404);
    }

    const orgId = userData.org_id || null;

    // Generar código temporal único
    const code = generateCode();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutos

    // Guardar el código en handoff_codes
    const { error: insertError } = await supabase
      .from("handoff_codes")
      .insert({
        code,
        user_id: userId,
        org_id: orgId,
        expires_at: expiresAt.toISOString(),
      });

    if (insertError) {
      console.error("Error inserting handoff code:", insertError);
      return json({ error: "Failed to generate handoff code" }, 500);
    }

    return json({
      code,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (err) {
    console.error("pathway-handoff error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});
