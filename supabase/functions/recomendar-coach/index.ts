// ============================================================================
// recomendar-coach — "Encontrar mi coach ideal" (diferenciador con IA).
//
// Recibe el objetivo de una persona (+ área/país opcionales) y devuelve los
// coaches REALES del directorio que mejor encajan, con una razón en 1 frase
// ("por qué te lo recomendamos"). La IA elige SOLO de la lista real de coaches
// públicos — nunca inventa uno ni datos que no estén.
//
// Secrets: ANTHROPIC_API_KEY.
// Deploy:  supabase functions deploy recomendar-coach --no-verify-jwt
// Uso (frontend):
//   POST /functions/v1/recomendar-coach  { objetivo, area, pais }
//   → { recomendados: [{ slug, nombre, titulo, foto, razon }] }
// ============================================================================

const CLAUDE_MODEL = "claude-sonnet-4-5";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, authorization, apikey, x-client-info",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function subVigente(cfg: Record<string, unknown>): boolean {
  if (cfg.es_pro_vitalicio === true) return true;
  const estado = String(cfg.estado_sub || "");
  if (estado === "activa") return true;
  if (estado === "cancelada" || estado === "vencida") return false;
  const ff = cfg.fecha_fin_prueba;
  if (ff) { const t = Date.parse(String(ff)); if (!isNaN(t)) return t > Date.now(); }
  return true;
}

// Nicho normalizado (igual criterio que el directorio) para poder pre-filtrar
// por área cuando la persona la eligió.
function nichoDe(cfg: Record<string, unknown>, esp: string[]): string {
  const ct = String(cfg.coach_type || (esp && esp[0]) || "").toLowerCase();
  if (ct.indexOf("fitness") >= 0) return "fitness";
  if (ct.indexOf("financ") >= 0) return "financiero";
  return "carrera";
}

async function callClaude(system: string, user: string, apiKey: string, maxTokens = 900): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: CLAUDE_MODEL, max_tokens: maxTokens, system, messages: [{ role: "user", content: user }] }),
  });
  if (!res.ok) { const err = await res.text(); throw new Error(`Claude API ${res.status}: ${err.slice(0, 300)}`); }
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

const SYSTEM = `Sos el asistente de Pathway que ayuda a una persona a elegir coach. Te doy su OBJETIVO y una lista de coaches REALES (slug, nombre, especialidad, a quién ayudan, dónde atienden). Elegí los que MEJOR encajan y explicá por qué, hablándole a la persona en segunda persona, cálido y concreto. Español neutro, SIN voseo.

Reglas estrictas:
- Recomendá SOLO coaches de la lista, por su slug EXACTO. Nunca inventes uno.
- Elegí entre 1 y 3 (del mejor al menos bueno). Si ninguno encaja perfecto, devolvé igual el/los más cercano/s (mínimo 1).
- La razón: por qué ESE coach para ESE objetivo. Máx 150 caracteres. NO inventes cifras, empresas ni certificaciones que no aparezcan en los datos.

Devolvés SOLO un objeto JSON válido (sin markdown):
{"matches":[{"slug":"exacto-de-la-lista","razon":"por qué te lo recomendamos"}]}`;

interface CoachRow {
  id: string; nombre: string | null; slug: string | null;
  titulo_profesional: string | null; tagline: string | null; bio: string | null;
  especialidades: string[] | null; atiende: string | null;
  foto_url: string | null; configuracion: Record<string, unknown> | null;
  activo?: boolean | null; perfil_publico_activo?: boolean | null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY") || "";
  if (!apiKey) return json({ error: "ANTHROPIC_API_KEY no configurada" }, 500);

  const SB_URL = Deno.env.get("SUPABASE_URL") || "";
  const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || "";
  if (!SB_URL || !SB_KEY) return json({ error: "supabase_env_missing" }, 500);

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { return json({ error: "json_invalido" }, 400); }
  const objetivo = String(body.objetivo || "").slice(0, 600).trim();
  const area = String(body.area || "").slice(0, 40).trim().toLowerCase();
  const pais = String(body.pais || "").slice(0, 40).trim();
  if (!objetivo) return json({ error: "falta_objetivo" }, 400);

  const headers = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` };
  let coaches: CoachRow[] = [];
  try {
    const fields = "id,nombre,slug,titulo_profesional,tagline,bio,especialidades,atiende,foto_url,configuracion,activo,perfil_publico_activo";
    const q = `${SB_URL}/rest/v1/usuarios?or=(perfil_publico_activo.eq.true,configuracion->>perfil_publico_activo.eq.true)&select=${fields}`;
    const r = await fetch(q, { headers });
    if (!r.ok) return json({ error: "supabase_error", status: r.status }, 502);
    coaches = await r.json();
  } catch (_e) { return json({ error: "supabase_unreachable" }, 502); }

  // Slug efectivo + solo vigentes con slug.
  coaches = coaches.map((c) => {
    const cfg = (c.configuracion || {}) as Record<string, unknown>;
    if (!c.slug && typeof cfg.slug === "string") c.slug = cfg.slug;
    if (c.perfil_publico_activo !== true && cfg.perfil_publico_activo === true) c.perfil_publico_activo = true;
    return c;
  }).filter((c) =>
    !!(c.slug && String(c.slug).trim()) && c.activo !== false &&
    subVigente((c.configuracion || {}) as Record<string, unknown>)
  );

  // Pre-filtro por área si la persona la eligió y quedan suficientes.
  let pool = coaches;
  if (area) {
    const f = coaches.filter((c) => nichoDe((c.configuracion || {}) as Record<string, unknown>, c.especialidades || []) === area);
    if (f.length >= 1) pool = f;
  }
  if (!pool.length) return json({ recomendados: [] });

  // Lista compacta para el prompt (máx 30 candidatos).
  const cand = pool.slice(0, 30).map((c) => {
    const cfg = (c.configuracion || {}) as Record<string, unknown>;
    const esp = (c.especialidades || []).join(", ");
    const ideal = Array.isArray(cfg.ideal_para) ? (cfg.ideal_para as unknown[]).map(String).join(", ") : "";
    const reco = typeof cfg.recomendacion_ia === "string" ? cfg.recomendacion_ia : "";
    const bio = (c.bio || c.tagline || "").slice(0, 160);
    return `slug: ${c.slug}\n  nombre: ${c.nombre || ""}\n  título: ${c.titulo_profesional || ""}\n  especialidades: ${esp}\n  ideal para: ${ideal}\n  sobre: ${reco || bio}\n  atiende: ${c.atiende || ""}`;
  }).join("\n---\n");

  const userMsg = [
    `OBJETIVO de la persona: ${objetivo}`,
    area ? `Área elegida: ${area}` : "",
    pais ? `País: ${pais}` : "",
    "",
    "COACHES DISPONIBLES:",
    cand,
    "",
    "Elegí 1-3 y devolvé el JSON.",
  ].filter(Boolean).join("\n");

  let matches: Array<{ slug: string; razon: string }> = [];
  try {
    const raw = await callClaude(SYSTEM, userMsg, apiKey);
    const out = extractJson(raw);
    if (out && Array.isArray(out.matches)) {
      matches = (out.matches as Array<Record<string, unknown>>)
        .map((m) => ({ slug: String(m.slug || "").trim().toLowerCase(), razon: String(m.razon || "").trim().slice(0, 200) }))
        .filter((m) => m.slug);
    }
  } catch (e) { return json({ error: "ia_error", detail: String(e).slice(0, 200) }, 502); }

  // Unir con datos reales del coach (solo slugs que existen en el pool).
  const bySlug: Record<string, CoachRow> = {};
  for (const c of coaches) { if (c.slug) bySlug[String(c.slug).toLowerCase()] = c; }
  const recomendados = matches
    .map((m) => {
      const c = bySlug[m.slug];
      if (!c) return null;
      const cfg = (c.configuracion || {}) as Record<string, unknown>;
      const foto = c.foto_url || (typeof cfg.foto_url === "string" ? cfg.foto_url : null) || (typeof cfg.foto_perfil === "string" ? cfg.foto_perfil : null);
      return { slug: c.slug, nombre: c.nombre, titulo: c.titulo_profesional, foto, razon: m.razon };
    })
    .filter(Boolean)
    .slice(0, 3);

  return json({ recomendados });
});
