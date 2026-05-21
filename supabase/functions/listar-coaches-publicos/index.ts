// Supabase Edge Function — listar-coaches-publicos
//
// Lista coaches con perfil_publico_activo=true + stats agregados +
// RANKING inteligente para que no compitan unos pocos por todo el tráfico:
//
//   Hard filters (no aparecen si no cumplen):
//     - perfil_publico_activo = true (ya filtraba antes)
//     - slug no nulo (ya filtraba)
//     - stripe_account_id presente (sino no se puede comprar)
//     - al menos 1 servicio con precio en cfg.servicios
//     - pathway_optin = true (acepto estar en el directorio)
//
//   Soft ranking (suma puntos, mayor = aparece primero):
//     - Match de país del candidato (CF-IPCountry) vs cfg.pais  +1000
//     - Perfil completo (foto + bio + ≥1 servicio)              +200
//     - Pocas solicitudes en últimos 14 días (rotación justa)   0..+200
//     - Reseñas (avg_rating × 10)                               0..+50
//
//   Cada coach lleva un campo `country_match: boolean` para que el
//   listado pueda mostrar un badge "En tu país".
//
// Desplegar: supabase functions deploy listar-coaches-publicos --no-verify-jwt

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, authorization, apikey, x-client-info",
};

// Pedimos también `configuracion` para leer stripe_account_id, servicios,
// pathway_optin, pais. Y `bio` para evaluar completitud del perfil.
const COACH_FIELDS = [
  "id","nombre","slug","titulo_profesional","tagline","bio",
  "especialidades","atiende","anios_experiencia","foto_url","configuracion",
].join(",");

interface CoachRow {
  id: string;
  nombre: string | null;
  slug: string | null;
  titulo_profesional: string | null;
  tagline: string | null;
  bio: string | null;
  especialidades: string[] | null;
  atiende: string | null;
  anios_experiencia: number | null;
  foto_url: string | null;
  configuracion: Record<string, unknown> | null;
}
interface CandRow { coach_id: string | null; resena: string | null }
interface SolRow { coach_id: string | null }

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "GET") return json({ error: "GET only" }, 405);

  const SB_URL = Deno.env.get("SUPABASE_URL") || "";
  const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
    Deno.env.get("SUPABASE_ANON_KEY") || "";
  if (!SB_URL || !SB_KEY) return json({ error: "supabase_env_missing" }, 500);

  // País del candidato (Cloudflare lo inyecta automáticamente en cada
  // request en Pages/Workers — gratis, sin lookup). Fallback a query
  // ?country= por si alguien testea sin pasar por Cloudflare.
  const ipCountry = (req.headers.get("cf-ipcountry") || "").toUpperCase();
  const qCountry = new URL(req.url).searchParams.get("country");
  const candidateCountry = (qCountry || ipCountry || "").toUpperCase();

  const headers = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` };

  let coaches: CoachRow[];
  try {
    const q = `${SB_URL}/rest/v1/usuarios` +
      `?perfil_publico_activo=eq.true` +
      `&slug=not.is.null` +
      `&select=${COACH_FIELDS}`;
    const r = await fetch(q, { headers });
    if (!r.ok) return json({ error: "supabase_error", status: r.status }, 502);
    coaches = await r.json();
  } catch (_e) {
    return json({ error: "supabase_unreachable" }, 502);
  }

  // Hard filters: descartar coaches que no cumplen lo mínimo para vender.
  coaches = coaches.filter((c) => {
    const cfg = (c.configuracion || {}) as Record<string, unknown>;
    const hasStripe = typeof cfg.stripe_account_id === "string" && cfg.stripe_account_id.length > 0;
    const servicios = Array.isArray(cfg.servicios) ? cfg.servicios : [];
    const hasServicio = servicios.some((s: unknown) => {
      const so = s as Record<string, unknown>;
      const price = Number(so?.price ?? so?.precio ?? 0);
      return price > 0;
    });
    const optedIn = cfg.pathway_optin === true;
    return hasStripe && hasServicio && optedIn;
  });

  const statsByCoach: Record<string, { clientes: number; reviews: number; sum: number }> = {};
  const solsByCoach: Record<string, number> = {};
  for (const c of coaches) {
    statsByCoach[c.id] = { clientes: 0, reviews: 0, sum: 0 };
    solsByCoach[c.id] = 0;
  }

  if (coaches.length) {
    // Reseñas (de candidatos.resena public)
    try {
      const ids = coaches.map((c) => `"${c.id}"`).join(",");
      const r = await fetch(
        `${SB_URL}/rest/v1/candidatos?coach_id=in.(${ids})&select=coach_id,resena`,
        { headers },
      );
      if (r.ok) {
        const cands: CandRow[] = await r.json();
        for (const cand of cands) {
          if (!cand.coach_id || !statsByCoach[cand.coach_id]) continue;
          statsByCoach[cand.coach_id].clientes++;
          const stars = parseResena(cand.resena);
          if (stars !== null) {
            statsByCoach[cand.coach_id].reviews++;
            statsByCoach[cand.coach_id].sum += stars;
          }
        }
      }
    } catch (_e) { /* opcional */ }

    // Solicitudes de los últimos 14 días — para el factor de rotación
    // (coaches con muchas solicitudes recientes bajan, para dar chance
    // a los que no recibieron leads).
    try {
      const ids = coaches.map((c) => `"${c.id}"`).join(",");
      const since = new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString();
      const r = await fetch(
        `${SB_URL}/rest/v1/solicitudes?coach_id=in.(${ids})&created_at=gte.${encodeURIComponent(since)}&select=coach_id`,
        { headers },
      );
      if (r.ok) {
        const sols: SolRow[] = await r.json();
        for (const s of sols) {
          if (s.coach_id && solsByCoach[s.coach_id] !== undefined) solsByCoach[s.coach_id]++;
        }
      }
    } catch (_e) { /* opcional */ }
  }

  // Calcular score por coach
  const scored = coaches.map((c) => {
    const cfg = (c.configuracion || {}) as Record<string, unknown>;
    const s = statsByCoach[c.id];
    const avg = s.reviews > 0 ? Math.round((s.sum / s.reviews) * 10) / 10 : null;
    const coachCountry = String(cfg.pais || "").toUpperCase();
    const countryMatch = !!(candidateCountry && coachCountry && candidateCountry === coachCountry);

    // Completitud: tiene foto + bio + ≥1 servicio (ya filtrado arriba, así
    // que servicios siempre hay ≥1; aquí valoramos foto + bio).
    const hasFoto = !!(c.foto_url && String(c.foto_url).trim());
    const hasBio = !!(c.bio && String(c.bio).trim().length > 20);
    const completo = hasFoto && hasBio;

    // Rotación: a más solicitudes recientes, menos bonus.
    //   0 sols → +200
    //   1 sol → +150
    //   2 sols → +100
    //   3 sols → +50
    //   4+ sols → 0
    const sols14 = solsByCoach[c.id] || 0;
    const rotacionBonus = Math.max(0, 200 - sols14 * 50);

    let score = 0;
    if (countryMatch) score += 1000;
    if (completo) score += 200;
    score += rotacionBonus;
    if (avg !== null) score += avg * 10;

    return {
      coach: c,
      score,
      stats: s,
      avg,
      countryMatch,
    };
  });

  // Sort por score desc; desempate por nombre asc para consistencia
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (a.coach.nombre || "").localeCompare(b.coach.nombre || "");
  });

  const out = scored.map(({ coach: c, stats: s, avg, countryMatch }) => ({
    nombre: c.nombre,
    slug: c.slug,
    titulo_profesional: c.titulo_profesional,
    tagline: c.tagline,
    especialidades: c.especialidades || [],
    atiende: c.atiende,
    anios_experiencia: c.anios_experiencia,
    foto_perfil_url: c.foto_url,
    country_match: countryMatch, // bandera para que el listado pueda mostrar badge
    stats: { clientes_total: s.clientes, reviews_count: s.reviews, avg_rating: avg },
  }));

  return json({
    coaches: out,
    total: out.length,
    candidate_country: candidateCountry || null, // útil para debug y para que el frontend lo muestre
  });
});

function parseResena(jsonStr: string | null): number | null {
  if (!jsonStr) return null;
  try {
    const o = JSON.parse(jsonStr);
    const c = (o && typeof o === "object" && "coach" in o) ? o.coach : o;
    if (!c) return null;
    if (c.public === false) return null;
    if (typeof c.stars !== "number") return null;
    return c.stars;
  } catch { return null; }
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...CORS_HEADERS,
      "content-type": "application/json; charset=utf-8",
      // Cache más corto (60s en vez de 120s) porque el ranking ahora
      // depende del país del candidato (varía por IP) y de solicitudes
      // recientes (cambian seguido).
      "cache-control": "public, max-age=60",
    },
  });
}
