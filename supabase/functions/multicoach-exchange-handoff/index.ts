// Supabase Edge Function — multicoach-exchange-handoff
//
// Canjea un código de handoff por la sesión del usuario. Es la mitad
// RECEPTORA del puente por el que un owner de Pathway entra en MultiCoach;
// la emisora es `pathway-handoff`.
//
// ─────────────────────────────────────────────────────────────────────────
// POR QUÉ ESTE FICHERO VIVE AQUÍ, Y NO SOLO DESPLEGADO
//
// La corrección de INC-030 se desplegó A MANO como v18 el 2026-08-21 y se
// verificó en producción (8/8, y `auth.mfa_amr_claims` estrenando `otp`).
// Su código fuente se quedó en `.claude/diseno/parches/`, que no es un sitio
// del que despliegue nadie ni que compruebe ninguna prueba.
//
// El 2026-08-25 a las 07:45:57 UTC el CI de Pathway adoptó el slug y lo
// publicó DESDE SU REPOSITORIO, donde el fichero seguía teniendo
// `createSession`. La corrección se perdió. INC-055 registró aquel despliegue
// como una buena noticia —«adopción, v18 → v20»— porque miró el número de
// versión y no el contenido: es R-43 leída del revés. Hoy corre la v25 con el
// mismo defecto, y el 2026-09-01 a las 15:42 dos canjes reales devolvieron
// 500 con el TypeError literal. Ver INC-075.
//
// La consecuencia práctica, que hay que tener presente antes de tocar esto:
// mientras el CI de Pathway despliegue este slug desde SU repositorio,
// cualquier subida a mano dura hasta su siguiente push. La copia que manda es
// la de `analisisform/supabase/functions/multicoach-exchange-handoff/`, y ésta
// es la fuente versionada de la que se toma.
// ─────────────────────────────────────────────────────────────────────────
//
// LAS TRES CORRECCIONES QUE LLEVA, y que la v25 desplegada NO tiene:
//
//   INC-030 · `auth.admin.createSession` NO EXISTE en ninguna versión de la
//             librería (comprobado de gotrue-js@1.22.21 a auth-js@2.112.3).
//             Lanza un TypeError, el catch lo convierte en 500, y la función
//             nunca emite sesión. Se sustituye por `generateLink` + `verify`.
//   INC-018 · la identidad se resolvía solo por `auth_id`, que en Pathway se
//             rellena de forma perezosa y puede ser NULL. Se añade el respaldo
//             por email, como hacen las demás funciones suyas (R-24).
//   S2      · el «un solo uso» no lo era bajo concurrencia. Se reclama con una
//             sola escritura condicional.

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

    // S2 — RECLAMAR el código con UNA sola escritura condicional.
    //
    // Antes se comprobaba (existe, no caducado, no usado) y después se marcaba
    // usado, con la emisión de sesión en medio. Entre la comprobación y la
    // marca cabían dos peticiones: ambas pasaban la validación antes de que
    // ninguna llegase a marcar, y ambas obtenían sesión. Eso convierte un
    // código interceptado —del historial, de un registro de servidor— en algo
    // utilizable aunque su dueño legítimo ya lo hubiera canjeado.
    //
    // Con el UPDATE condicional, la primera petición se lo lleva y la segunda
    // no encuentra fila. Lo garantiza PostgreSQL, no el orden de ejecución.
    //
    // El coste asumido: si la emisión de sesión falla, el código queda quemado
    // y hay que pedir otro. Es el precio de que «un solo uso» sea cierto, y es
    // el comportamiento que la v18 verificó 8/8 en producción.
    const { data: reclamado, error: claimError } = await supabase
      .from("handoff_codes")
      .update({ used_at: new Date().toISOString(), is_valid: false })
      .eq("code", code)
      .is("used_at", null)
      .eq("is_valid", true)
      .gt("expires_at", new Date().toISOString())
      .select()
      .single();

    // Caducado, ya usado e inexistente devuelven LO MISMO, a propósito: a quien
    // está probando códigos no se le dice cuál de las tres cosas ha fallado.
    if (claimError || !reclamado) {
      return json({ error: "Invalid handoff code" }, 401);
    }

    const userId = reclamado.user_id;
    const orgId = reclamado.org_id;

    // ── RESOLUCIÓN DE IDENTIDAD ─────────────────────────────────────────
    //
    // Aquí había `.eq("auth_id", userId).single()` a secas, y devolvía 404 a
    // gente que existe: cuatro «User not found» observados el 2026-08-18. Son
    // dos fallos distintos y éste NO lo arregla el cambio de createSession.
    //
    // 1. `usuarios.auth_id` se rellena de forma PEREZOSA —cuando el usuario
    //    entra por el login antiguo— así que puede ser NULL para alguien que
    //    lleva años en la plataforma. Todas las funciones de Pathway lo
    //    compensan con `or=(auth_id.eq.X,email.ilike.Y)`; ésta era la excepción.
    // 2. `.single()` revienta si hay DOS filas con el mismo `auth_id`.
    //
    // El email sale de Auth, no de `usuarios`: es el que GoTrue reconoce, y es
    // además el que necesita `generateLink` más abajo. Si se cogiera el de
    // `usuarios` y los dos hubieran divergido, la emisión de sesión fallaría.
    const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(userId);
    const emailAuth = authUser?.user?.email ?? "";

    if (authError || !emailAuth) {
      console.error("getUserById fallo:", authError?.message ?? "sin email");
      return json({ error: "User not found" }, 404);
    }

    const { data: filas, error: userError } = await supabase
      .from("usuarios")
      .select("*")
      .or(`auth_id.eq.${userId},email.ilike.${emailAuth}`)
      .limit(2);

    // Con dos filas gana SIEMPRE la del auth_id, que es la unión fuerte; el
    // email es el respaldo. Elegir «la primera» habría dependido del orden que
    // devolviera PostgREST, y eso es una lotería: en una identidad no se sortea.
    const userData = filas?.find((f) => f.auth_id === userId) ?? filas?.[0];

    if (userError || !userData) {
      return json({ error: "User not found" }, 404);
    }

    // S3 — El código pudo emitirse ANTES de la baja y sigue vivo cinco minutos.
    // Se vuelve a comprobar aquí: la emisión y el canje son dos momentos, y la
    // suspensión puede caer entre medias.
    if (userData.activo === false) {
      return json({ error: "Account is not active" }, 403);
    }

    const rolEnOrg = userData.rol_en_org || userData.rol;

    // ── EMISIÓN DE LA SESIÓN ────────────────────────────────────────────
    //
    // NO USAR `supabase.auth.admin.createSession(...)`. ESE MÉTODO NO EXISTE:
    // lanza un TypeError en tiempo de ejecución, y no lo ve ninguna revisión de
    // código, ni el typecheck, ni comparar lo desplegado con el repositorio
    // (R-38). Ya rompió este circuito dos veces — INC-030 y su regresión
    // INC-075— así que hay un guardián que se pone rojo si vuelve: la regla
    // «handoff: la sesion se emite con generateLink + verify, NUNCA con
    // createSession» de `scripts/check-guardrails.js`, que ESTE repositorio
    // ejecuta en su job de Checks y en el hook que bloquea el commit.
    //
    // El mecanismo que sí existe: generar un token de un solo uso con
    // service_role y canjearlo con la anon key. La sesión resultante es una
    // sesión de GoTrue normal y corriente —mismo `sub`, mismo
    // `role: authenticated`— así que auth.uid(), las políticas de RLS, la
    // caducidad y la revocación se comportan igual que tras un login. Eso
    // importa: NO obliga a tocar RLS, que es lo que R-08 y R-09 prohíben.
    //
    // `generateLink` NO manda correo: devuelve el token para usarlo aquí.
    const { data: enlace, error: enlaceError } = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email: emailAuth,
    });

    const tokenUnUso = enlace?.properties?.hashed_token;
    if (enlaceError || !tokenUnUso) {
      console.error("generateLink fallo:", enlaceError?.message ?? "sin hashed_token");
      return json({ error: "Failed to create session" }, 500);
    }

    // El canje va con la anon key a propósito: es lo que convierte el token en
    // una sesión de usuario. Con service_role no se obtiene sesión de nadie.
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const canje = await fetch(`${supabaseUrl}/auth/v1/verify`, {
      method: "POST",
      headers: { apikey: anonKey, "Content-Type": "application/json" },
      body: JSON.stringify({ type: "magiclink", token_hash: tokenUnUso }),
    });
    const sesion = await canje.json().catch(() => null);

    if (!canje.ok || !sesion?.access_token || !sesion?.refresh_token) {
      console.error("verify fallo:", canje.status);
      return json({ error: "Failed to create session" }, 500);
    }

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
        access_token: sesion.access_token,
        refresh_token: sesion.refresh_token,
        expires_in: sesion.expires_in,
      },
      rol_en_org: rolEnOrg,
    });
  } catch (err) {
    console.error("multicoach-exchange-handoff error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});
