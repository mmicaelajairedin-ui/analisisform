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

function generateCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 32; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
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
      .select("org_id, rol, activo")
      .eq("email", userEmail)
      .single();

    if (userError || !userData) {
      return json({ error: "User not found in database" }, 404);
    }

    // S3 — Dar de baja tiene que cerrar la puerta.
    //
    // `eliminar-coach-red` ofrece dos modos y su cabecera promete lo mismo en
    // los dos: "suspender -> activo=false (pierde acceso, sigue en la red)".
    // Suspender CONSERVA el org_id (eliminar-coach-red:88), asi que hasta aqui
    // la persona seguia obteniendo su codigo de handoff y entrando en
    // MultiCoach con su rol y su organizacion intactos. La promesa existia y no
    // la sostenia nadie.
    //
    // Se comprueba contra `false` ESTRICTO a proposito: la columna es nullable
    // (boolean, default true) y una fila historica con `activo` nulo no es una
    // baja. Y `activo` va en el `select` de arriba: sin pedirlo, el valor llega
    // `undefined`, la comparacion es falsa y la guarda no haria nada.
    if (userData.activo === false) {
      return json({ error: "Account is not active" }, 403);
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
