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

const SYSTEM_CV_EXPRESS = `Sos un experto en CV ATS y career coaching con +800 procesos de selección en Amazon. Tu output debe ser PROFESIONAL, ESPECÍFICO al objetivo del candidato y aplicable al mercado real.

Recibirás:
1. objetivo: la posición que busca el candidato
2. cv_texto: texto del CV actual del candidato
3. linkedin_url: URL de su LinkedIn
4. linkedin_texto: (opcional) texto del perfil LinkedIn

Devolverás JSON ESTRICTO con 3 campos:

{
  "cv_optimizado": {
    "nombre": "Nombre Completo",
    "rol_objetivo": "Título profesional alineado al objetivo (ej: 'Director de Marketing Digital')",
    "objetivo": "1-2 frases de perfil/objetivo profesional",
    "contacto": {
      "tel": "+34 6XX XXX XXX",
      "email": "email@dominio.com",
      "ciudad": "Ciudad, País",
      "linkedin": "linkedin.com/in/usuario"
    },
    "competencias": ["Competencia 1", "Competencia 2", "..."],
    "herramientas": ["Tool 1", "Tool 2", "..."],
    "idiomas": [{"idioma": "Español", "nivel": "Nativo"}, {"idioma": "Inglés", "nivel": "C1"}],
    "experiencia": [
      {
        "rol": "Director de Marketing",
        "empresa": "Empresa S.A.",
        "fecha": "2020 — Actual",
        "ubicacion": "Madrid",
        "logros": ["Lideré ...", "Implementé ...", "Aumenté ..."]
      }
    ],
    "educacion": [
      {"titulo": "Título", "institucion": "Universidad", "fecha": "2015"}
    ],
    "cursos": [
      {"titulo": "Curso", "institucion": "Plataforma", "fecha": "2023"}
    ]
  },
  "carta": "<Carta de presentación texto plano, 3-4 párrafos>",
  "linkedin_analisis": {
    "score_actual": 65,
    "titular_propuesto": "<titular optimizado, max 220 chars>",
    "acerca_de_propuesto": "<sección 'Acerca de' optimizada, max 1500 chars>",
    "puntos_fuertes": ["punto 1", "punto 2", "punto 3"],
    "areas_mejora": ["área 1", "área 2", "área 3"],
    "habilidades_sugeridas": ["habilidad 1", "habilidad 2"],
    "experiencia_sugerencias": ["sugerencia concreta 1", "sugerencia concreta 2"]
  }
}

REGLAS CRÍTICAS:

CV OPTIMIZADO (estructura JSON):
- Extraé los datos del cv_texto y reorganizalos en la estructura.
- nombre: tal cual aparece en el CV
- rol_objetivo: NO copiar el rol actual — generalo a partir del objetivo del candidato
- objetivo: 1-2 frases sintéticas de su perfil profesional (evitá adjetivos vacíos)
- contacto: si falta algún dato, omitir esa key (no inventar)
- competencias: 4-6 competencias relevantes para el objetivo
- herramientas: las que aparecen + las relevantes al objetivo
- experiencia: máximo 4 experiencias más relevantes. logros: 3-5 bullets cada uno con verbo de acción + número/% si se puede
- Si en el CV no aparece info para una sección, omitirla (no la inventes)

CARTA DE PRESENTACIÓN:
- 3-4 párrafos, máximo 350 palabras, texto plano (sin markdown)
- Estructura: hook (por qué este rol), por qué soy buen fit, valor concreto que aporto, cierre con CTA
- Personalizada al objetivo — NO genérica
- No uses frases tipo "soy una persona apasionada" o "siempre dispuesto a aprender" — específico

LINKEDIN ANÁLISIS:
- score_actual: 0-100 evaluando el LinkedIn actual (titular + acerca de + completitud)
- titular_propuesto: ALINEADO al objetivo, no "Buscando nuevas oportunidades"
- acerca_de_propuesto: storytelling que conecte experiencia → objetivo
- puntos_fuertes: 2-3 cosas concretas que ya hace bien
- areas_mejora: 2-3 cosas ACCIONABLES y específicas
- habilidades_sugeridas: 5-8 keywords relevantes
- experiencia_sugerencias: 2-3 mejoras concretas

OUTPUT: JSON estricto, sin markdown wrapper, sin texto antes ni después. Solo el JSON.`;

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
  maxTokens = 4000,
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
      max_tokens: maxTokens,
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

    // ── PACK EXPRESS — self-service del candidato ──
    // Recibe cv_texto + linkedin_url + objetivo + opcional linkedin_texto.
    // Devuelve {cv_optimizado, carta, linkedin_analisis} en una sola
    // llamada a Claude (max_tokens 8000 es suficiente para los 3 outputs).
    if (accion === "cv_express") {
      const b = body as unknown as {
        objetivo?: string;
        cv_texto?: string;
        linkedin_url?: string;
        linkedin_texto?: string;
        email?: string;
      };
      if (!b.objetivo || b.objetivo.length < 20) {
        return new Response(
          JSON.stringify({ error: "objetivo es requerido (min 20 chars)" }),
          { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
        );
      }
      if (!b.cv_texto || b.cv_texto.length < 100) {
        return new Response(
          JSON.stringify({ error: "cv_texto es requerido (min 100 chars)" }),
          { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
        );
      }
      const prompt = `OBJETIVO PROFESIONAL:\n${b.objetivo}\n\n` +
        `CV ACTUAL DEL CANDIDATO:\n${b.cv_texto}\n\n` +
        `LINKEDIN URL: ${b.linkedin_url || "(no proporcionado)"}\n\n` +
        (b.linkedin_texto
          ? `LINKEDIN TEXTO:\n${b.linkedin_texto}\n\n`
          : "") +
        `Generá los 3 outputs siguiendo el formato JSON estricto.`;

      // 16K max_tokens — los 3 outputs (CV con experiencia detallada +
      // carta + análisis LinkedIn completo) pueden requerir bastante espacio.
      const response = await callClaude(SYSTEM_CV_EXPRESS, prompt, apiKey, 16000);
      const parsed = extractJson(response);

      // Diagnóstico: log las claves que volvieron + si hay truncación
      console.log("[cv_express] response length:", response.length);
      console.log("[cv_express] parsed keys:", parsed ? Object.keys(parsed) : "null");

      // Si parsed falló por completo, intentamos relajar la validación
      // requiriendo SOLO cv_optimizado (los otros 2 son nice-to-have).
      // Mejor entregar parcial que 502 silente.
      if (!parsed || !parsed.cv_optimizado) {
        return new Response(
          JSON.stringify({
            error: "Output de Claude inválido o truncado",
            response_length: response.length,
            parsed_keys: parsed ? Object.keys(parsed) : null,
            raw_start: response.slice(0, 800),
            raw_end: response.slice(-400),
          }),
          { status: 502, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
        );
      }

      // Si faltan carta o linkedin_analisis, retornamos lo que tenemos
      // con un warning — el usuario al menos ve el CV editor.
      const partial = !parsed.carta || !parsed.linkedin_analisis;
      const result: Record<string, unknown> = {
        ok: true,
        cv_optimizado: parsed.cv_optimizado,
        carta: parsed.carta || "",
        linkedin_analisis: parsed.linkedin_analisis || null,
      };
      if (partial) {
        result.warning = "Algunos campos vinieron incompletos: " +
          (!parsed.carta ? "carta " : "") + (!parsed.linkedin_analisis ? "linkedin_analisis" : "");
      }

      return new Response(
        JSON.stringify(result),
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
