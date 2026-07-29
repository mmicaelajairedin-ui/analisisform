// ============================================================================
// generar-perfil-coach — escribe el COPY del perfil público del coach con IA.
//
// El coach carga lo MÍNIMO (profesión · a quién ayuda + resultados · país) y
// esta función devuelve, listo para revisar/editar antes de publicar:
//   - tagline      : frase corta del hero ("Ayudo a personas a…"), 1-2 líneas.
//   - bio          : "Sobre mí" ampliado, 1 párrafo cálido y profesional.
//   - enfoque      : 3 bullets de enfoque ("Basado en evidencia", etc.).
//   - especialidades: 4-6 chips sugeridos.
//   - keywords     : términos SEO sugeridos.
//
// Secrets: ANTHROPIC_API_KEY (sk-ant-...).
// Deploy:  supabase functions deploy generar-perfil-coach --no-verify-jwt
// Uso (frontend):
//   fetch(SB+'/functions/v1/generar-perfil-coach', {method:'POST',
//     headers:{'Content-Type':'application/json'},
//     body:JSON.stringify({ profesion, ayuda, pais, especialidades, lang })})
// ============================================================================

const CLAUDE_MODEL = "claude-sonnet-4-5";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, authorization, apikey",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

async function callClaude(system: string, user: string, apiKey: string, maxTokens = 1600): Promise<string> {
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
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API ${res.status}: ${err.slice(0, 300)}`);
  }
  const data = await res.json();
  return data.content?.[0]?.text || "";
}

function extractJson(text: string): Record<string, unknown> | null {
  let c = (text || "").trim();
  c = c.replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/\s*```\s*$/, "");
  const a = c.indexOf("{"), b = c.lastIndexOf("}");
  if (a < 0 || b < 0 || b < a) return null;
  try { return JSON.parse(c.slice(a, b + 1)); } catch { return null; }
}

const SYSTEM = `Sos un copywriter experto en marcas personales de coaches (carrera, fitness y finanzas). Escribís perfiles públicos que generan confianza y convierten, en español neutro (sin voseo), cálidos pero profesionales. NUNCA inventás datos, títulos, cifras ni resultados que el coach no haya dado: si falta info, escribís algo genérico pero honesto. Prohibido prometer resultados garantizados.

Devolvés SOLO un objeto JSON válido (sin texto extra, sin markdown) con esta forma exacta:
{
  "titulo": "Título profesional para el hero (es el H1 de la página, clave para SEO). Optimizado para búsquedas pero NATURAL y legible: incluí el rol + la especialidad/nicho + a quién ayuda si entra bien, ej. 'Coach de Carrera para Ejecutivos · Transición y LinkedIn' o 'Entrenador Personal · Pérdida de grasa e Hipertrofia'. Sin inventar certificaciones ni cifras. Máx 95 caracteres.",
  "tagline": "1-2 oraciones en primera persona que arrancan con un verbo de ayuda (Ayudo a…/Acompaño a…). Máx 180 caracteres.",
  "bio": "Un párrafo de 'Sobre mí' en primera persona, 3-5 oraciones, cálido y concreto. Máx 600 caracteres.",
  "enfoque": ["3 bullets cortos de método/enfoque, 2-4 palabras cada uno"],
  "especialidades": ["4-6 etiquetas cortas de especialidad, 1-3 palabras"],
  "keywords": ["8-14 términos SEO en minúscula que la gente busca en Google para encontrar un coach así: mezclá términos cortos (rol, especialidad) y long-tail reales (ej. 'coach de carrera para ejecutivos', 'cómo mejorar mi linkedin', 'entrenador personal pérdida de grasa'). Nada inventado."]
}`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY") || "";
  if (!apiKey) return json({ error: "ANTHROPIC_API_KEY no configurada" }, 500);

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { return json({ error: "json_invalido" }, 400); }

  const profesion = String(body.profesion || "").slice(0, 300).trim();
  const ayuda = String(body.ayuda || "").slice(0, 1200).trim();
  const pais = String(body.pais || "").slice(0, 80).trim();
  const esp = Array.isArray(body.especialidades) ? (body.especialidades as unknown[]).map((x) => String(x)).slice(0, 12) : [];
  const nombre = String(body.nombre || "").slice(0, 120).trim();

  if (!profesion && !ayuda) return json({ error: "faltan_datos", detail: "Poné al menos tu profesión y a quién ayudás." }, 400);

  const userMsg = [
    nombre ? `Nombre: ${nombre}` : "",
    profesion ? `Profesión / título: ${profesion}` : "",
    ayuda ? `A quién ayuda y con qué resultados (en sus palabras): ${ayuda}` : "",
    pais ? `País donde atiende: ${pais}` : "",
    esp.length ? `Especialidades que ya mencionó: ${esp.join(", ")}` : "",
    "",
    "Escribí el copy del perfil según el formato JSON indicado. No inventes cifras ni títulos que no estén acá.",
  ].filter(Boolean).join("\n");

  try {
    const raw = await callClaude(SYSTEM, userMsg, apiKey);
    const out = extractJson(raw);
    if (!out) return json({ error: "respuesta_invalida" }, 502);
    // Normalización defensiva.
    const asArr = (v: unknown) => Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : [];
    return json({
      titulo: String(out.titulo || "").trim().slice(0, 120),
      tagline: String(out.tagline || "").trim().slice(0, 220),
      bio: String(out.bio || "").trim().slice(0, 700),
      enfoque: asArr(out.enfoque).slice(0, 4),
      especialidades: asArr(out.especialidades).slice(0, 8),
      keywords: asArr(out.keywords).slice(0, 12),
    });
  } catch (e) {
    return json({ error: "ia_error", detail: String(e).slice(0, 300) }, 502);
  }
});
