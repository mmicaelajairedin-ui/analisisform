// Supabase Edge Function — listar-coaches-publicos
//
// Lista coaches con perfil_publico_activo=true + stats agregados:
//   - clientes_total (count de candidatos.coach_id)
//   - reviews_count, avg_rating (de candidatos.resena public)
//
// Sin auth — alimenta /coaches.html.
// Optimizado: 2 queries totales (coaches + 1 query agregada de candidatos).
//
// Desplegar: supabase functions deploy listar-coaches-publicos --no-verify-jwt

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, authorization, apikey, x-client-info",
};

const COACH_FIELDS = [
  "id","nombre","slug","titulo_profesional","tagline",
  "especialidades","atiende","anios_experiencia","foto_url",
].join(",");

interface CoachRow {
  id: string;
  nombre: string | null;
  slug: string | null;
  titulo_profesional: string | null;
  tagline: string | null;
  especialidades: string[] | null;
  atiende: string | null;
  anios_experiencia: number | null;
  foto_url: string | null;
}
interface CandRow { coach_id: string | null; resena: string | null }

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "GET") return json({ error: "GET only" }, 405);

  const SB_URL = Deno.env.get("SUPABASE_URL") || "";
  const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
    Deno.env.get("SUPABASE_ANON_KEY") || "";
  if (!SB_URL || !SB_KEY) return json({ error: "supabase_env_missing" }, 500);

  const headers = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` };

  let coaches: CoachRow[];
  try {
    const q = `${SB_URL}/rest/v1/usuarios` +
      `?perfil_publico_activo=eq.true` +
      `&slug=not.is.null` +
      `&select=${COACH_FIELDS}` +
      `&order=anios_experiencia.desc.nullslast,nombre.asc`;
    const r = await fetch(q, { headers });
    if (!r.ok) return json({ error: "supabase_error", status: r.status }, 502);
    coaches = await r.json();
  } catch (_e) {
    return json({ error: "supabase_unreachable" }, 502);
  }

  const statsByCoach: Record<string, { clientes: number; reviews: number; sum: number }> = {};
  for (const c of coaches) statsByCoach[c.id] = { clientes: 0, reviews: 0, sum: 0 };

  if (coaches.length) {
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
  }

  const out = coaches.map((c) => {
    const s = statsByCoach[c.id];
    const avg = s.reviews > 0 ? Math.round((s.sum / s.reviews) * 10) / 10 : null;
    return {
      nombre: c.nombre,
      slug: c.slug,
      titulo_profesional: c.titulo_profesional,
      tagline: c.tagline,
      especialidades: c.especialidades || [],
      atiende: c.atiende,
      anios_experiencia: c.anios_experiencia,
      foto_perfil_url: c.foto_url,
      stats: { clientes_total: s.clientes, reviews_count: s.reviews, avg_rating: avg },
    };
  });

  return json({ coaches: out, total: out.length });
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
      "cache-control": "public, max-age=120",
    },
  });
}
