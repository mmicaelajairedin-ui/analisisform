// Supabase Edge Function — generar-informe
//
// Genera informes personalizados de career coaching usando Anthropic Claude.
// También maneja acción 'sugerir_empleos' para devolver empleos filtrados.
//
// Desplegar:
//   supabase functions deploy generar-informe --no-verify-jwt
//
// Env vars requeridas (Supabase → Edge Functions → Secrets):
//   ANTHROPIC_API_KEY — API key de Anthropic (sk-ant-...)
//
// Uso desde frontend:
//   fetch(SB+'/functions/v1/generar-informe', {
//     method:'POST',
//     headers:{'Content-Type':'application/json','Authorization':'Bearer '+KEY},
//     body: JSON.stringify({
//       accion: 'generar_informe' | 'sugerir_empleos',
//       ...datos del candidato
//     })
//   })
//
// Respuesta: JSON con informe completo o lista de empleos.

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, authorization",
};

const CLAUDE_MODEL = "claude-sonnet-4-5";

interface CandidatoPayload {
  nombre?: string;
  email?: string;
  edad?: string;
  experiencia?: string;
  sector?: string;
  rol?: string;
  educacion?: string;
  habilidades?: string;
  objetivo?: string;
  idiomas?: string;
  ubicacion?: string;
  ciudad?: string;
  situacion?: string;
  urgencia?: string;
  modalidad?: string;
  linkedin?: string;
  obstaculos?: string;
  linkedin_texto?: string;
  cargo?: string;
}

// ── SYSTEM PROMPTS ───────────────────────────────────────

const SYSTEM_INFORME = `Sos un coach de carrera experto con 15 años acompañando a profesionales en transición.

Tu tarea: generar un informe ACCIONABLE y ESPECÍFICO para el candidato en formato JSON. No genérico.

REGLAS CRÍTICAS:
1. Las acciones deben ser CONCRETAS, medibles, con verbos en pasado + números cuando se pueda (ej: "Reescribir 3 experiencias laborales con logros cuantificados" NO "Mejorar el CV")
2. Las fortalezas y gaps deben referenciar el perfil ESPECÍFICO del candidato (sector, años, rol, ubicación), no genéricos
3. Cada semana tiene un foco diferente:
   - cv_acciones: ORIENTACIÓN + autoevaluación (S1 Evaluación)
   - linkedin_acciones: CV optimizado (S2 CV)
   - networking_acciones: LinkedIn perfil (S3 LinkedIn)
   - preguntas: Búsqueda activa, networking, entrevistas (S4)
4. 3-5 acciones por semana. Ni menos ni más.
5. El mensaje_candidato debe ser CÁLIDO y PERSONAL (2-3 frases máximo), mencionando algo específico del perfil.

RESPONDÉ SOLO CON JSON VÁLIDO, sin explicaciones previas ni markdown. Estructura exacta:
{
  "resumen": "párrafo de 3-4 oraciones sobre situación actual",
  "fortalezas": ["fortaleza 1 específica", "fortaleza 2", "fortaleza 3"],
  "gaps": ["gap 1 con ejemplo concreto", "gap 2", "gap 3"],
  "estrategia": "párrafo de 4-5 oraciones con estrategia de búsqueda",
  "mercado": "análisis del mercado objetivo",
  "nicho": "nicho/segmento recomendado",
  "cv_acciones": ["acción S1.1", "acción S1.2", "acción S1.3"],
  "linkedin_acciones": ["acción S2.1 CV", "acción S2.2", "acción S2.3"],
  "networking_acciones": ["acción S3.1 LinkedIn", "acción S3.2", "acción S3.3"],
  "preguntas": ["acción S4.1 búsqueda", "acción S4.2", "acción S4.3"],
  "alertas": ["alerta 1 si aplica", "alerta 2 si aplica"],
  "mensaje_candidato": "mensaje cálido 2-3 oraciones",
  "scores": [
    {"label":"CV y marca personal","val":65},
    {"label":"LinkedIn","val":55},
    {"label":"Claridad de objetivo","val":70},
    {"label":"Red de contactos","val":45},
    {"label":"Propuesta de valor","val":60}
  ]
}

Los scores van de 0-100 y deben reflejar el estado actual del candidato basado en los datos proporcionados.`;

const SYSTEM_EMPLEOS = `Sos un recruiter senior con acceso a información del mercado laboral. Generá 5 sugerencias de empleos relevantes para el candidato en formato JSON.

REGLAS:
1. Los empleos deben ser REALISTAS para el perfil y ubicación
2. "empresa_tipo" debe ser genérico (ej: "Consultora tech", "Multinacional CPG") no nombres reales
3. "relevancia" 70-95 (nunca 100, nunca <70)
4. "query_indeed" debe ser el string exacto para buscar en portales
5. "salario_rango" estimado realista

RESPONDÉ SOLO CON JSON VÁLIDO:
{
  "empleos": [
    {
      "titulo": "Senior Product Manager",
      "empresa_tipo": "Scaleup tech · Madrid híbrido",
      "relevancia": 92,
      "descripcion": "2-3 oraciones describiendo qué hace",
      "requisitos": "5+ años PM, stack ágil, B2B SaaS",
      "salario_rango": "€55k-70k",
      "query_indeed": "senior product manager"
    }
  ]
}`;

// ── HELPERS ──────────────────────────────────────────────

async function callClaude(
  systemPrompt: string,
  userMessage: string,
  apiKey: string,
): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 4000,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API ${res.status}: ${err.slice(0, 300)}`);
  }

  const data = await res.json();
  const content = data.content?.[0]?.text || "";
  return content;
}

function extractJson(text: string): Record<string, unknown> | null {
  // Remove markdown code fences if present
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```json\s*/i, "").replace(/^```\s*/, "");
  cleaned = cleaned.replace(/\s*```\s*$/, "");
  // Find first { and last }
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1) return null;
  cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  try {
    return JSON.parse(cleaned);
  } catch (_e) {
    return null;
  }
}

function buildInformePrompt(c: CandidatoPayload): string {
  const parts: string[] = [];
  parts.push(`Perfil del candidato:`);
  if (c.nombre) parts.push(`- Nombre: ${c.nombre}`);
  if (c.edad) parts.push(`- Edad: ${c.edad}`);
  if (c.sector || c.rol) parts.push(`- Sector/rol actual: ${c.sector || ""} ${c.rol || ""}`.trim());
  if (c.cargo) parts.push(`- Cargo actual: ${c.cargo}`);
  if (c.experiencia) parts.push(`- Experiencia: ${c.experiencia}`);
  if (c.educacion) parts.push(`- Educación: ${c.educacion}`);
  if (c.habilidades) parts.push(`- Habilidades: ${c.habilidades}`);
  if (c.idiomas) parts.push(`- Idiomas: ${c.idiomas}`);
  if (c.ubicacion || c.ciudad) parts.push(`- Ubicación: ${c.ubicacion || c.ciudad}`);
  if (c.modalidad) parts.push(`- Modalidad buscada: ${c.modalidad}`);
  if (c.objetivo) parts.push(`- Objetivo profesional: ${c.objetivo}`);
  if (c.situacion) parts.push(`- Situación actual: ${c.situacion}`);
  if (c.urgencia) parts.push(`- Urgencia: ${c.urgencia}`);
  if (c.obstaculos) parts.push(`- Obstáculos percibidos: ${c.obstaculos}`);
  if (c.linkedin) parts.push(`- LinkedIn URL: ${c.linkedin}`);
  if (c.linkedin_texto) {
    parts.push(``);
    parts.push(`Texto de CV/LinkedIn pegado:`);
    parts.push(c.linkedin_texto.slice(0, 3000));
  }
  parts.push(``);
  parts.push(`Generá el informe JSON completo siguiendo las reglas. Sé específico y accionable.`);
  return parts.join("\n");
}

function buildEmpleosPrompt(c: CandidatoPayload & {
  fortalezas?: string;
  estrategia?: string;
  nicho?: string;
}): string {
  const parts: string[] = [];
  parts.push(`Candidato busca empleo:`);
  if (c.sector) parts.push(`- Sector: ${c.sector}`);
  if (c.ubicacion) parts.push(`- Ubicación: ${c.ubicacion}`);
  if (c.modalidad) parts.push(`- Modalidad: ${c.modalidad}`);
  if (c.nicho) parts.push(`- Nicho: ${c.nicho}`);
  if (c.objetivo) parts.push(`- Objetivo: ${c.objetivo}`);
  if (c.fortalezas) parts.push(`- Fortalezas: ${c.fortalezas}`);
  if (c.estrategia) parts.push(`- Estrategia: ${c.estrategia.slice(0, 500)}`);
  parts.push(``);
  parts.push(`Generá 5 sugerencias de empleos en JSON siguiendo las reglas.`);
  return parts.join("\n");
}

async function saveInforme(email: string, candidato_id: number | null, data: Record<string, unknown>) {
  const SB_URL = Deno.env.get("SUPABASE_URL") || "";
  const SERVICE_KEY =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
    Deno.env.get("SERVICE_ROLE_KEY") || "";
  if (!SB_URL || !SERVICE_KEY) return;
  try {
    await fetch(`${SB_URL}/rest/v1/informes`, {
      method: "POST",
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        email: email.toLowerCase(),
        candidato_id: candidato_id,
        data: JSON.stringify(data),
      }),
    });
  } catch (e) {
    console.error("[saveInforme] error", e);
  }
}

// ── MAIN HANDLER ─────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "POST only" }),
      { status: 405, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  }

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY") || "";
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "ANTHROPIC_API_KEY no configurada" }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  }

  let body: (CandidatoPayload & { accion?: string; fortalezas?: string; estrategia?: string; nicho?: string });
  try {
    body = await req.json();
  } catch (_e) {
    return new Response(
      JSON.stringify({ error: "JSON inválido" }),
      { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  }

  const accion = body.accion || "generar_informe";

  try {
    if (accion === "sugerir_empleos") {
      const prompt = buildEmpleosPrompt(body);
      const response = await callClaude(SYSTEM_EMPLEOS, prompt, apiKey);
      const parsed = extractJson(response);
      if (!parsed) {
        return new Response(
          JSON.stringify({ error: "No se pudo parsear respuesta de Claude", raw: response.slice(0, 500) }),
          { status: 502, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify(parsed),
        { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
      );
    }

    // generar_informe (default)
    const prompt = buildInformePrompt(body);
    const response = await callClaude(SYSTEM_INFORME, prompt, apiKey);
    const parsed = extractJson(response);
    if (!parsed) {
      return new Response(
        JSON.stringify({ error: "No se pudo parsear informe de Claude", raw: response.slice(0, 500) }),
        { status: 502, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
      );
    }

    // Guardar en informes table si tenemos email
    if (body.email) {
      await saveInforme(body.email, null, parsed);
    }

    return new Response(
      JSON.stringify({ ok: true, informe: parsed }),
      { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: String(e).slice(0, 400) }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  }
});
