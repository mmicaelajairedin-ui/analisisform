import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";

interface BusinessIdentity {
  id: string;
  nombre: string;
  especialidad: string;
  qué_haces: string;
  a_quién_ayudas: string;
  problema_resuelve: string;
  cómo_trabajas: string;
  servicios: string[];
  resultados_clientes: string[];
  tono: string;
  pais: string;
  idiomas: string[];
  cta_texto: string;
  cta_url: string;
}

interface GeneratedOutputs {
  landing_hero: string;
  landing_subhero: string;
  landing_benefits: object[];
  landing_services: object[];
  landing_faq: object[];
  landing_cta_primary: string;
  seo_title: string;
  seo_description: string;
  seo_keywords: string[];
  emails: object;
  ai_system_prompt: string;
  ai_opening_message: string;
  marketplace_bio: string;
  marketplace_teaser: string;
  portal_hero: string;
  portal_welcome: string;
}

// Prompt system por especialidad
const PROMPTS_BY_SPECIALTY = {
  fitness: `Eres un copywriter especialista en coaches de fitness. Genera contenido motivador, directo, orientado a transformación física y empoderamiento.`,
  executive: `Eres un copywriter especialista en executive coaching. Genera contenido profesional, pragmático, orientado a liderazgo y resultados empresariales.`,
  carrera: `Eres un copywriter especialista en career coaching. Genera contenido estratégico, orientado a resultados concretos (ofertas, salarios, roles).`,
  finanzas: `Eres un copywriter especialista en financial coaching. Genera contenido claro, educativo, orientado a libertad financiera y decisiones informadas.`,
  nutricion: `Eres un copywriter especialista en nutrición. Genera contenido científico pero accesible, orientado a salud sostenible y resultados medibles.`,
  productividad: `Eres un copywriter especialista en automatización y productividad. Genera contenido técnico pero optimista, orientado a ahorro de tiempo y ROI.`,
};

async function generateWithClaude(
  prompt: string,
  identity: BusinessIdentity
): Promise<GeneratedOutputs> {
  // B.6.7: Aquí irá la llamada a Claude API
  // Por ahora, retornamos outputs mockeados para testear la estructura

  console.log(`[business-identity-generate] Generating for: ${identity.nombre}`);

  // Mock response (será reemplazado por Claude en B.6.7)
  const mockOutputs: GeneratedOutputs = {
    landing_hero: `${identity.nombre} - Hero Text`,
    landing_subhero: `${identity.nombre} - Subhero Text`,
    landing_benefits: [
      { title: "Benefit 1", description: "Description 1" },
      { title: "Benefit 2", description: "Description 2" },
    ],
    landing_services: (identity.servicios || []).map((s) => ({
      title: s,
      description: `Descripción de ${s}`,
    })),
    landing_faq: [
      {
        question: "¿Cómo funciona?",
        answer: `${identity.cómo_trabajas || "Por especificar"}`,
      },
    ],
    landing_cta_primary: identity.cta_texto || "Reserva tu sesión",
    seo_title: `${identity.nombre} | Coaching Profesional`,
    seo_description: `${identity.qué_haces}. ${identity.a_quién_ayudas}.`,
    seo_keywords: ["coaching", "profesional", identity.nombre.toLowerCase()],
    emails: {
      welcome: {
        subject: `Bienvenida a ${identity.nombre}`,
        body: `Hola, bienvenida a ${identity.nombre}...`,
      },
    },
    ai_system_prompt: `Eres un asistente de ${identity.nombre}. Tu tono es ${identity.tono}. Trabajas con ${identity.a_quién_ayudas}.`,
    ai_opening_message: `Hola, soy el asistente de ${identity.nombre}. ¿Cómo puedo ayudarte?`,
    marketplace_bio: `${identity.nombre} - ${identity.qué_haces}`,
    marketplace_teaser: identity.qué_haces.substring(0, 50),
    portal_hero: `Bienvenida a ${identity.nombre}`,
    portal_welcome: `Soy ${identity.nombre}. Aquí es donde tu transformación comienza.`,
  };

  return mockOutputs;
}

async function saveOutputs(
  supabase: any,
  identityId: string,
  outputs: GeneratedOutputs
) {
  const { error } = await supabase
    .from("business_outputs")
    .update({
      ...outputs,
      generated_at: new Date().toISOString(),
    })
    .eq("identity_id", identityId);

  if (error) {
    console.error("[business-identity-generate] Error saving outputs:", error);
    throw error;
  }

  console.log(`[business-identity-generate] Outputs saved for identity: ${identityId}`);
}

serve(async (req) => {
  // Validar método
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const { identity_id, force } = await req.json();

    if (!identity_id) {
      return new Response(
        JSON.stringify({ error: "identity_id is required" }),
        { status: 400 }
      );
    }

    // Inicializar cliente Supabase
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // 1. Obtener business_identity
    const { data: identity, error: identityError } = await supabase
      .from("business_identity")
      .select("*")
      .eq("id", identity_id)
      .single();

    if (identityError || !identity) {
      return new Response(
        JSON.stringify({ error: "Identity not found" }),
        { status: 404 }
      );
    }

    console.log(
      `[business-identity-generate] Processing: ${identity.nombre}`
    );

    // 2. Generar contenido (en B.6.7 será con Claude)
    const prompt = buildPrompt(identity);
    const outputs = await generateWithClaude(prompt, identity);

    // 3. Guardar outputs
    await saveOutputs(supabase, identity_id, outputs);

    // 4. Retornar resultado
    return new Response(
      JSON.stringify({
        success: true,
        identity_id,
        generated_at: new Date().toISOString(),
        outputs,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[business-identity-generate] Error:", error);
    return new Response(
      JSON.stringify({
        error: "Generation failed",
        details: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});

function buildPrompt(identity: BusinessIdentity): string {
  const basePrompt =
    PROMPTS_BY_SPECIALTY[
      identity.especialidad as keyof typeof PROMPTS_BY_SPECIALTY
    ] || PROMPTS_BY_SPECIALTY["fitness"];

  return `${basePrompt}

IDENTIDAD DEL COACH:
- Nombre: ${identity.nombre}
- Especialidad: ${identity.especialidad}
- País: ${identity.pais}
- Idiomas: ${identity.idiomas.join(", ")}

POSICIONAMIENTO:
- Qué hace: ${identity.qué_haces}
- A quién ayuda: ${identity.a_quién_ayudas}
- Problema que resuelve: ${identity.problema_resuelve}
- Cómo trabaja: ${identity.cómo_trabajas}
- Servicios: ${(identity.servicios || []).join(", ")}
- Resultados: ${(identity.resultados_clientes || []).join(", ")}
- Tono: ${identity.tono}
- CTA: ${identity.cta_texto}

GENERAR:
1. Landing (hero, subhero, benefits, services, faq)
2. SEO (title, description, keywords)
3. Email templates
4. AI system prompt
5. Marketplace bio
6. Portal welcome text

Mantén consistencia de tono y mensaje en TODO.
Responde en JSON.`;
}
