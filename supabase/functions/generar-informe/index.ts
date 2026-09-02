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

// ── Nicho FITNESS ── mismas claves de salida que SYSTEM_INFORME (las acciones
// por etapa mapean a las 4 etapas del nicho: Adaptación/Base/Progresión/Medición).
const SYSTEM_FITNESS = `Sos un coach de fitness y antropometrista con 15 años de experiencia, con conocimiento de nutrición, lesiones y rehabilitación. Entrenás de forma segura y progresiva.

Tu tarea: generar un análisis ACCIONABLE y ESPECÍFICO para el cliente en JSON. No genérico.

REGLAS CRÍTICAS:
1. SEGURIDAD PRIMERO: si declara lesiones o condiciones, adaptá el plan y poné las precauciones en "alertas". NUNCA propongas ejercicios que agraven una lesión declarada.
2. MEDICACIÓN Y LIMITACIONES: respetá la medicación declarada y lo que el cliente dice que NO puede/debe hacer. No contradigas indicaciones médicas; ante dudas de salud, recomendá consultar a un médico (en "alertas").
3. Acciones CONCRETAS y medibles ("3 sesiones de fuerza/semana con progresión de carga", NO "entrenar más").
4. Referenciá el perfil ESPECÍFICO (objetivo, nivel, días disponibles, lugar/equipo, peso/altura).
5. El plan va por 4 etapas: Adaptación → Base → Progresión → Medición. 3-5 acciones por etapa.
6. Si hay datos, incluí orientación nutricional general (no un plan médico).
7. mensaje_candidato CÁLIDO y motivador (2-3 frases), mencionando algo específico.

RESPONDÉ SOLO CON JSON VÁLIDO, sin markdown. Estructura EXACTA (mismas claves):
{
  "resumen": "3-4 oraciones sobre el punto de partida",
  "fortalezas": ["fortaleza específica 1", "2", "3"],
  "gaps": ["área a mejorar 1", "2", "3"],
  "estrategia": "4-5 oraciones de cómo encarar el objetivo de forma segura y progresiva",
  "cv_acciones": ["acción de Adaptación 1", "2", "3"],
  "linkedin_acciones": ["acción de Base 1", "2", "3"],
  "networking_acciones": ["acción de Progresión 1", "2", "3"],
  "preguntas": ["Medición: qué medir y cuándo (peso, % grasa, IMO, pliegues) 1", "2", "3"],
  "alertas": ["precaución por lesión/medicación si aplica", "..."],
  "mensaje_candidato": "mensaje cálido 2-3 oraciones",
  "scores": [
    {"label":"Claridad de objetivo","val":70},
    {"label":"Base técnica","val":50},
    {"label":"Composición corporal","val":60},
    {"label":"Hábitos","val":45},
    {"label":"Constancia esperada","val":65}
  ]
}
Los scores van de 0-100 y reflejan el estado actual del cliente.`;

// ── Nicho FINANZAS ── mismas claves de salida (etapas: Diagnóstico/Presupuesto/Deudas/Ahorro).
const SYSTEM_FINANZAS = `Sos un coach financiero con 15 años de experiencia ayudando a personas a ordenar sus finanzas, salir de deudas y construir el hábito del ahorro. No das consejos de inversión específicos ni recomendás productos.

Tu tarea: generar un análisis ACCIONABLE y ESPECÍFICO para el cliente en JSON. No genérico.

REGLAS CRÍTICAS:
1. Trabajá con los números que da el cliente (ingresos, gastos, deudas, objetivo).
2. Acciones CONCRETAS y medibles ("recortar 120€/mes en suscripciones", NO "gastar menos").
3. El plan va por 4 etapas: Diagnóstico → Presupuesto → Deudas → Ahorro. 3-5 acciones por etapa.
4. Para deudas usá método bola de nieve (saldar la más chica primero) salvo que convenga otra por tasa.
5. mensaje_candidato CÁLIDO y sin juzgar (2-3 frases).

RESPONDÉ SOLO CON JSON VÁLIDO, sin markdown. Estructura EXACTA (mismas claves):
{
  "resumen": "3-4 oraciones sobre la situación financiera",
  "fortalezas": ["fortaleza 1", "2"],
  "gaps": ["área a mejorar 1", "2"],
  "estrategia": "4-5 oraciones",
  "cv_acciones": ["acción de Diagnóstico 1", "2", "3"],
  "linkedin_acciones": ["acción de Presupuesto 1", "2", "3"],
  "networking_acciones": ["acción de Deudas 1", "2", "3"],
  "preguntas": ["acción de Ahorro 1", "2", "3"],
  "alertas": ["alerta si aplica"],
  "mensaje_candidato": "mensaje cálido 2-3 oraciones",
  "scores": [
    {"label":"Salud financiera","val":50},
    {"label":"Control del gasto","val":45},
    {"label":"Nivel de deuda","val":40},
    {"label":"Hábito de ahorro","val":35},
    {"label":"Claridad de objetivo","val":70}
  ]
}
Los scores van de 0-100 y reflejan el estado actual del cliente.`;

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
        "logros": ["Lideré ...", "Implementé ...", "Aumenté ...", "Diseñé ...", "Coordiné ..."]
      }
    ],
    "educacion": [
      {"titulo": "Título", "institucion": "Universidad", "fecha": "2015", "descripcion": "1-2 líneas con tema de tesis, especialización o destaque académico (opcional, omitir si no hay info)"}
    ],
    "cursos": [
      {"titulo": "Curso", "institucion": "Plataforma", "fecha": "2023"}
    ]
  },
  "carta": "<Carta de presentación texto plano, 3-4 párrafos>",
  "linkedin_analisis": {
    "score_actual": 65,
    "titular_actual": "<extraído del linkedin_texto, lo que tiene HOY el candidato>",
    "titular_propuesto": "<titular optimizado, max 220 chars>",
    "acerca_de_actual": "<extraído del linkedin_texto, máx 800 chars>",
    "acerca_de_propuesto": "<sección 'Acerca de' optimizada — MÁX 250 caracteres / 2-3 líneas. Hook directo: quién soy + 1 logro + qué busco. NADA de relleno, listas o párrafos. Que entre completo arriba del fold de LinkedIn móvil.>",
    "puntos_fuertes": ["punto 1", "punto 2", "punto 3"],
    "areas_mejora": ["área 1", "área 2", "área 3"],
    "habilidades_sugeridas": ["habilidad 1", "habilidad 2"],
    "experiencias_optimizadas": [
      {
        "rol": "Cargo (idéntico al CV original)",
        "empresa": "Empresa",
        "fecha": "2020 — Actual",
        "ubicacion": "Madrid",
        "bullets": ["Logro 1 con verbo + número", "Logro 2", "Logro 3", "Logro 4"],
        "aptitudes": ["Skill 1", "Skill 2", "Skill 3"],
        "keywords": ["keyword 1", "keyword 2", "keyword 3"]
      }
    ]
  }
}

REGLAS CRÍTICAS:

IDIOMA:
- Si el mensaje del usuario trae una línea "IDIOMA DE SALIDA: <idioma>", ESA instrucción MANDA y no se discute: generá TODO el contenido (cv_optimizado, carta, textos de linkedin_analisis) en ese idioma, aunque el cv_texto, el objetivo o el linkedin_texto estén en otro. Es el idioma que el candidato eligió a mano para sus documentos.
- Solo si NO viene esa línea, detectá el idioma predominante del cv_texto + objetivo y generá TODO el contenido en ESE idioma.
- En cualquiera de los dos casos: no mezcles idiomas. Nombres propios, empresas, títulos de estudios oficiales y nombres de herramientas se dejan como están.
- Si el linkedin_texto está en OTRO idioma que el CV (ej: CV en español, LinkedIn en inglés), igual analizalo correctamente y agregá en areas_mejora una nota concreta: que unifique el idioma del LinkedIn con el del CV/objetivo o que tenga una versión por idioma según a qué mercado apunta. No bajes la calidad del análisis por el desajuste de idioma.

CV OPTIMIZADO (estructura JSON):
- Extraé los datos del cv_texto y reorganizalos en la estructura.
- nombre: tal cual aparece en el CV
- rol_objetivo: NO copiar el rol actual — generalo a partir del objetivo del candidato
- objetivo: 1-2 frases sintéticas de su perfil profesional (evitá adjetivos vacíos)
- contacto: si falta algún dato, omitir esa key (no inventar)
- competencias: 4-6 competencias relevantes para el objetivo
- herramientas: las que aparecen + las relevantes al objetivo
- experiencia: SELECCIONÁ y JERARQUIZÁ según el OBJETIVO del candidato — un CV enfocado convierte más que uno largo. La experiencia ACTUAL/RECIENTE y la RELEVANTE al objetivo va completa (3-5 bullets de logros, verbo de acción + número/% si se puede). La experiencia VIEJA o POCO RELEVANTE al objetivo va CONDENSADA (1-2 bullets o una línea resumen) — NO la expandas con relleno ni responsabilidades genéricas para "emparejar". Si hay varios roles antiguos parecidos o que no suman al objetivo, podés agruparlos/resumirlos. NUNCA omitas la experiencia actual / más reciente. Meta: un CV ajustado y sin paja (apuntá a 1-2 páginas), donde cada línea aporta al objetivo. NO inventes números ni datos. Los bullets de las experiencias relevantes se reutilizan para LinkedIn (listos para copiar/pegar, sin abreviaciones, sin "etc."). Si una empresa aparece sólo como nombre en el CV pero no es trabajo (ej: el candidato hizo cursos en Amazon pero no trabajó ahí), NO la pongas en experiencia.
- rol: COPIÁ EL CARGO EXACTO como aparece en el CV original. NO traduzcas (si dice "Responsable de RRHH" no lo cambies a "HR Manager"). NO acortes. NO modifiqués. El cliente quiere ver su título tal cual lo escribió.
- educacion: por cada entrada, agregá descripcion (1-2 líneas) si el CV menciona tesis, especialización, beca, proyecto destacado, GPA o intercambio. Si no hay info, omitir descripcion (NO inventar).
- Si en el CV no aparece info para una sección, omitirla (no la inventes)

CARTA DE PRESENTACIÓN:
- 3-4 párrafos, máximo 350 palabras, texto plano (sin markdown)
- Estructura: hook (por qué este rol), por qué soy buen fit, valor concreto que aporto, cierre con CTA
- Personalizada al objetivo — NO genérica
- No uses frases tipo "soy una persona apasionada" o "siempre dispuesto a aprender" — específico
- PERFIL INTEGRAL: la carta debe reflejar la TRAYECTORIA COMPLETA del candidato (años totales, recorrido por varias empresas/sectores/roles), NO solo el trabajo más reciente o más fuerte. Anclá en el logro más potente, pero hilvaná también la experiencia previa relevante al objetivo (ej: "13 años liderando equipos en 3 sectores", no solo el último puesto). El candidato siente que su perfil es más amplio que su rol actual — que se note.

LINKEDIN ANÁLISIS:
- score_actual: 0-100 evaluando el LinkedIn actual (titular + acerca de + completitud)
- titular_actual: extraé del linkedin_texto la headline actual del candidato. Si no se identifica claramente, devolvé "" (string vacío)
- titular_propuesto: ALINEADO al objetivo, no "Buscando nuevas oportunidades"
- acerca_de_actual: extraé del linkedin_texto la sección "Acerca de" / "About" actual (max 800 chars). Si no aparece, devolvé ""
- acerca_de_propuesto: MÁX 250 caracteres / 2-3 líneas. Hook breve: quién soy + 1 logro concreto + qué busco. Sin adjetivos vacíos, sin storytelling, sin listas, sin párrafos. La gente lo lee en 3 segundos. El "quién soy" debe sintetizar la TRAYECTORIA INTEGRAL (años totales + amplitud de sectores/funciones), no solo el último/mejor rol — anclá el logro en lo más fuerte pero que la frase de identidad abarque todo el recorrido. Ejemplo bueno: "Marketing leader B2B SaaS con 8+ años escalando ARR de €5M a €30M. Especializada en demand gen y ABM. Buscando rol de Director/a en scaleup."
- puntos_fuertes: 2-3 cosas concretas que ya hace bien
- areas_mejora: 2-3 cosas ACCIONABLES y específicas
- habilidades_sugeridas: 5-8 skills generales del perfil (van en la sección Aptitudes general de LinkedIn)
- experiencias_optimizadas: array CON TODAS las experiencias laborales del CV. Por CADA experiencia:
  * rol: cargo exacto del CV (no traducir, no resumir)
  * empresa, fecha, ubicacion: igual al CV
  * bullets: 4-6 bullets de logros optimizados (verbo en pasado + número/%). Ready-to-paste en el campo "Description" de LinkedIn. NO abreviar, NO usar "etc.". Cada bullet completo.
  * aptitudes: 4-6 skills SUSTANTIVAS del puesto específico (no genéricas). Ej: en "Marketing Manager B2B SaaS" → ["Demand Generation", "Account-Based Marketing", "Pipeline Acceleration", "HubSpot", "Marketing Operations"]. Sirven para que el cliente las agregue una a una en LinkedIn.
  * keywords: 4-6 palabras-clave del rol que el cliente debe incluir en bullets/headline para que recruiters los encuentren con búsquedas. Ej: ["B2B SaaS", "Pipeline", "Growth Marketing"].
  IMPORTANTE: TODAS las experiencias deben tener bullets+aptitudes+keywords completos. NO dejar la última con 5 bullets y las anteriores con 1 — TODAS al mismo nivel de detalle. Si la info del CV original es escasa, expandirla con criterio (sin inventar números).

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

const SYSTEM_TRADUCIR_EXPRESS =
  `Sos un traductor profesional especializado en documentos de carrera (CV, cartas de presentación y perfiles de LinkedIn).

Recibís un JSON con documentos ya redactados y los devolvés TRADUCIDOS al idioma pedido.

REGLAS CRÍTICAS:

1. ESTRUCTURA INTACTA. Devolvés EXACTAMENTE las mismas claves, en la misma forma
   (objetos donde había objetos, arrays con la misma cantidad de elementos,
   strings donde había strings). No agregues, no quites, no reordenes claves.
   Las CLAVES del JSON no se traducen nunca — solo los VALORES de texto.

2. NO TRADUCIR:
   - Nombres de personas y de empresas.
   - Nombres de herramientas y tecnologías (HubSpot, Salesforce, Python, AWS...).
   - Siglas de negocio establecidas (KPI, ROI, CAC, B2B, SaaS, EBITDA, MRR...).
   - URLs, emails, teléfonos.
   - Títulos oficiales de estudios: se dejan en su idioma original y, si ayuda,
     se agrega la equivalencia entre paréntesis. Un "Grado en Marketing" no se
     convierte en un "Bachelor's" inventado.
   - Fechas y números: se mantienen tal cual (solo se traduce la palabra suelta,
     ej. "2020 — Actual" → "2020 — Present").

3. NO INVENTAR. No agregues logros, cifras, responsabilidades ni adjetivos que no
   estén en el original. No "mejores" el contenido: es una traducción, no una
   reescritura. Si algo está corto en el original, queda corto.

4. REGISTRO PROFESIONAL NATIVO. No traduzcas literal. Un bullet de CV en inglés
   arranca con verbo de acción en pasado simple ("Led", "Built", "Reduced"), sin
   sujeto y sin punto final si el original no lo tenía. En español, la primera
   persona del pretérito ("Lideré", "Construí", "Reduje"). El resultado tiene que
   leerse como escrito por un nativo, no traducido.

5. FORMATO LIMPIO. Sin espacios dobles, sin espacios antes de comas o puntos, sin
   saltos de línea de más, sin comillas tipográficas mezcladas. Respetá los saltos
   de párrafo del original (en la carta, los "\n\n" entre párrafos se mantienen).

6. Las ciudades y países se traducen si tienen nombre propio en el idioma destino
   ("Madrid, España" → "Madrid, Spain").

Devolvés SOLO el JSON traducido, sin texto alrededor y sin bloques de código.`;

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

// Prompt para nichos fitness/financiero: usa los campos del intake del nicho.
function buildNichoPrompt(c: Record<string, unknown>, nicho: string): string {
  const parts: string[] = [];
  parts.push(nicho === "fitness" ? `Perfil del cliente (fitness):` : `Perfil del cliente (finanzas):`);
  const g = (k: string) => (c[k] != null && c[k] !== "" ? String(c[k]) : "");
  if (g("nombre")) parts.push(`- Nombre: ${g("nombre")}`);
  if (g("objetivo")) parts.push(`- Objetivo: ${g("objetivo")}`);
  if (g("situacion")) parts.push(`- Situación: ${g("situacion")}`);
  const fitKeys = ["nivel", "dias", "lugar", "equipo", "peso", "altura", "lesiones", "medicacion", "restricciones", "nutricion", "edad"];
  const finKeys = ["ingresos", "gastos", "deudas", "objetivo_ahorro", "plazo", "ahorro_actual"];
  const labels: Record<string, string> = {
    nivel: "Nivel", dias: "Días disponibles/semana", lugar: "Lugar (gym/casa)", equipo: "Equipo disponible",
    peso: "Peso (kg)", altura: "Altura (cm)", lesiones: "Lesiones/condiciones", medicacion: "Medicación",
    restricciones: "Restricciones (no puede/no debe)", nutricion: "Hábitos de alimentación", edad: "Edad",
    ingresos: "Ingresos mensuales", gastos: "Gastos fijos", deudas: "Deudas", objetivo_ahorro: "Objetivo de ahorro",
    plazo: "Plazo", ahorro_actual: "Ahorro actual",
  };
  (nicho === "fitness" ? fitKeys : finKeys).forEach((k) => { if (g(k)) parts.push(`- ${labels[k] || k}: ${g(k)}`); });
  if (g("extra")) parts.push(`- Notas extra: ${g("extra")}`);
  if (g("linkedin_texto")) { parts.push(``); parts.push(`Material/notas del cliente:`); parts.push(String(c["linkedin_texto"]).slice(0, 3000)); }
  parts.push(``);
  parts.push(`Generá el análisis JSON completo siguiendo las reglas. Sé específico y accionable.`);
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
  const svc = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` };
  const em = email.toLowerCase();
  try {
    // Estampar coach_id = dueño real del cliente. Si no se hace, la fila queda
    // huérfana (coach_id NULL) y bajo RLS estricto el coach no puede editarla
    // después (el UPDATE exige coach_id = pw_coach_id()). Así se evita el bug.
    let coach_id: string | null = null;
    let cid = candidato_id;
    try {
      const cr = await fetch(
        `${SB_URL}/rest/v1/candidatos?email=eq.${encodeURIComponent(em)}&select=id,coach_id&limit=1`,
        { headers: svc },
      );
      if (cr.ok) {
        const rows = await cr.json();
        if (Array.isArray(rows) && rows[0]) {
          coach_id = rows[0].coach_id || null;
          if (cid == null && rows[0].id != null) cid = rows[0].id;
        }
      }
    } catch { /* sin dueño conocido → queda como estaba */ }
    const row: Record<string, unknown> = { email: em, candidato_id: cid, data: JSON.stringify(data) };
    if (coach_id) row.coach_id = coach_id;
    // Upsert por email (merge): si ya existe el informe, lo actualiza en vez de
    // fallar por el unique constraint (informes_email_unique).
    await fetch(`${SB_URL}/rest/v1/informes?on_conflict=email`, {
      method: "POST",
      headers: { ...svc, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(row),
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
        idioma?: string;
      };
      const outEN = String(b.idioma || "es").toLowerCase().startsWith("en");
      const langDirective = outEN
        ? `\n\nIDIOMA DE SALIDA: INGLÉS. Redactá TODO el contenido de los valores del JSON (cv_optimizado completo, carta y linkedin_analisis) en inglés profesional y natural. Las claves del JSON quedan EXACTAMENTE igual. No uses español en ningún valor.`
        : `\n\nIDIOMA DE SALIDA: ESPAÑOL. Redactá todo el contenido de los valores en español.`;
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
        langDirective +
        `\n\nGenerá los 3 outputs siguiendo el formato JSON estricto.`;

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

    // ── TRADUCIR EXPRESS — el mismo pack, en el otro idioma ──
    // El comprador del Pack Express pide su CV / carta / LinkedIn en el otro
    // idioma para tener las dos versiones. Traducimos lo YA generado en vez de
    // re-generar: sale más barato, es más rápido y — sobre todo — las dos
    // versiones dicen lo mismo (si re-generáramos, la IA elegiría otros logros
    // y el cliente terminaría con dos CVs distintos).
    // Se manda solo lo que haga falta: los 3 campos son opcionales.
    if (accion === "traducir_express") {
      const b = body as unknown as {
        idioma?: string;
        cv_optimizado?: unknown;
        carta?: string;
        linkedin_analisis?: unknown;
      };
      const toEN = String(b.idioma || "").toLowerCase().startsWith("en");
      const destino = toEN ? "INGLÉS" : "ESPAÑOL";

      const payload: Record<string, unknown> = {};
      if (b.cv_optimizado) payload.cv_optimizado = b.cv_optimizado;
      if (typeof b.carta === "string" && b.carta.trim()) payload.carta = b.carta;
      if (b.linkedin_analisis) payload.linkedin_analisis = b.linkedin_analisis;

      if (!Object.keys(payload).length) {
        return new Response(
          JSON.stringify({
            error: "Nada que traducir: mandá al menos cv_optimizado, carta o linkedin_analisis",
          }),
          { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
        );
      }

      const prompt = `IDIOMA DESTINO: ${destino}\n\n` +
        `Traducí los valores de este JSON a ${destino.toLowerCase()}, respetando las reglas.\n\n` +
        JSON.stringify(payload);

      // 16K igual que la generación: el pack completo traducido ocupa lo mismo
      // que el original, y truncarlo devolvería JSON roto.
      const response = await callClaude(SYSTEM_TRADUCIR_EXPRESS, prompt, apiKey, 16000);
      const parsed = extractJson(response);

      console.log("[traducir_express] destino:", destino, "· claves pedidas:", Object.keys(payload));
      console.log("[traducir_express] response length:", response.length);

      if (!parsed) {
        return new Response(
          JSON.stringify({
            error: "Output de Claude inválido o truncado",
            response_length: response.length,
            raw_start: response.slice(0, 800),
            raw_end: response.slice(-400),
          }),
          { status: 502, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
        );
      }

      // Devolvemos SOLO lo que se pidió y de verdad volvió. Si un campo se
      // perdió, el frontend se queda con el original en ese idioma en vez de
      // pisarlo con null.
      const out: Record<string, unknown> = { ok: true, idioma: toEN ? "en" : "es" };
      const faltan: string[] = [];
      for (const k of Object.keys(payload)) {
        if (parsed[k] === undefined || parsed[k] === null) faltan.push(k);
        else out[k] = parsed[k];
      }
      if (faltan.length) out.warning = "No se pudo traducir: " + faltan.join(", ");

      return new Response(
        JSON.stringify(out),
        { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
      );
    }

    // ── ANALIZAR LINKEDIN — desde cliente.html ──
    // Cliente del coach pega su LinkedIn actual, la IA analiza y genera
    // titular_propuesto + acerca_de_propuesto + experiencias_optimizadas.
    // Reusamos el prompt de cv_express pero pedimos SOLO el bloque de LinkedIn.
    if (accion === "analizar_linkedin") {
      const b = body as unknown as {
        nombre?: string;
        rol?: string;
        sector?: string;
        ciudad?: string;
        objetivo?: string;
        experiencia?: string;
        educacion?: string;
        habilidades?: string;
        linkedin_texto?: string;
      };
      if (!b.linkedin_texto || b.linkedin_texto.length < 50) {
        return new Response(
          JSON.stringify({ error: "linkedin_texto es requerido (min 50 chars)" }),
          { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
        );
      }
      // Construir un cv_texto sintético desde los campos del candidato.
      const cvSint = [
        b.nombre ? `Nombre: ${b.nombre}` : "",
        b.rol ? `Rol actual: ${b.rol}` : "",
        b.sector ? `Sector: ${b.sector}` : "",
        b.ciudad ? `Ciudad: ${b.ciudad}` : "",
        b.experiencia ? `Experiencia:\n${b.experiencia}` : "",
        b.educacion ? `Educación:\n${b.educacion}` : "",
        b.habilidades ? `Habilidades: ${b.habilidades}` : "",
      ].filter(Boolean).join("\n\n");
      const objetivo = b.objetivo || `Mejorar perfil de LinkedIn como ${b.rol || "profesional"}`;
      const prompt = `OBJETIVO PROFESIONAL:\n${objetivo}\n\n` +
        `CV/CONTEXTO DEL CANDIDATO:\n${cvSint}\n\n` +
        `LINKEDIN TEXTO ACTUAL:\n${b.linkedin_texto}\n\n` +
        `Devolvé SOLO el bloque linkedin_analisis del formato JSON. ` +
        `NO incluyas cv_optimizado ni carta — solo linkedin_analisis con todos sus subcampos ` +
        `(score_actual, titular_actual, titular_propuesto, acerca_de_actual, acerca_de_propuesto, ` +
        `puntos_fuertes, areas_mejora, habilidades_sugeridas, experiencias_optimizadas).`;
      const response = await callClaude(SYSTEM_CV_EXPRESS, prompt, apiKey, 8000);
      const parsed = extractJson(response);
      if (!parsed) {
        return new Response(
          JSON.stringify({ error: "No se pudo parsear respuesta de Claude" }),
          { status: 502, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
        );
      }
      // El frontend (cliente.html liAnalizar) lee data.analisis. Devolvemos
      // ahí el linkedin_analisis si vino, o el parsed completo como fallback
      // (algunos prompts devuelven el contenido al root level).
      const analisis = parsed.linkedin_analisis || parsed;
      return new Response(
        JSON.stringify({ ok: true, analisis: analisis }),
        { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
      );
    }

    // generar_informe (default). Elegimos el prompt según el nicho del coach:
    // carrera = SYSTEM_INFORME; fitness / financiero = sus prompts propios.
    const nicho = String((body as Record<string, unknown>).nicho || "carrera");
    let systemPrompt = SYSTEM_INFORME;
    let prompt: string;
    if (nicho === "fitness") { systemPrompt = SYSTEM_FITNESS; prompt = buildNichoPrompt(body as Record<string, unknown>, "fitness"); }
    else if (nicho === "financiero") { systemPrompt = SYSTEM_FINANZAS; prompt = buildNichoPrompt(body as Record<string, unknown>, "financiero"); }
    else { prompt = buildInformePrompt(body); }
    const response = await callClaude(systemPrompt, prompt, apiKey);
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
