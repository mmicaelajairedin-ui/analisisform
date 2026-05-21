// Supabase Edge Function — obtener-perfil-coach
//
// Devuelve el perfil publico de un coach por slug.
// Solo retorna filas con perfil_publico_activo=true.
//
// v3: ahora incluye:
//   - servicios, videos, links desde configuracion JSONB
//   - linkedin_url, instagram_url, web_url
//   - stats: clientes_total, reviews_count, avg_rating
//     (derivados de candidatos.coach_id y candidatos.resena)
//
// Sin auth — alimenta /coach/{slug}.
// Desplegar: supabase functions deploy obtener-perfil-coach --no-verify-jwt

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, authorization, apikey, x-client-info",
};

const SELECT_FIELDS = [
  "id",
  "nombre",
  "slug",
  "titulo_profesional",
  "tagline",
  "bio",
  "mi_enfoque",
  "especialidades",
  "atiende",
  "anios_experiencia",
  "foto_url",
  "configuracion",
].join(",");

interface UsuarioRow {
  id: string;
  nombre: string | null;
  slug: string | null;
  titulo_profesional: string | null;
  tagline: string | null;
  bio: string | null;
  mi_enfoque: string | null;
  especialidades: string[] | null;
  atiende: string | null;
  anios_experiencia: number | null;
  foto_url: string | null;
  configuracion: Record<string, unknown> | null;
}

interface CandReview { resena: string | null }

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }
  if (req.method !== "GET") {
    return json({ error: "GET only" }, 405);
  }

  const url = new URL(req.url);
  const slug = (url.searchParams.get("slug") || "").trim().toLowerCase();
  if (!slug || !/^[a-z0-9][a-z0-9-]{0,80}$/.test(slug)) {
    return json({ error: "invalid_slug" }, 400);
  }

  const SB_URL = Deno.env.get("SUPABASE_URL") || "";
  const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
    Deno.env.get("SUPABASE_ANON_KEY") || "";
  if (!SB_URL || !SB_KEY) return json({ error: "supabase_env_missing" }, 500);

  const headers = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` };

  let row: UsuarioRow;
  try {
    const q = `${SB_URL}/rest/v1/usuarios` +
      `?slug=eq.${encodeURIComponent(slug)}` +
      `&perfil_publico_activo=eq.true` +
      `&select=${SELECT_FIELDS}` +
      `&limit=1`;
    const sbRes = await fetch(q, { headers });
    if (!sbRes.ok) return json({ error: "supabase_error", status: sbRes.status }, 502);
    const rows: UsuarioRow[] = await sbRes.json();
    if (!rows.length) return json({ error: "not_found" }, 404);
    row = rows[0];
  } catch (_e) {
    return json({ error: "supabase_unreachable" }, 502);
  }

  let clientes_total = 0;
  let reviews_count = 0;
  let avg_rating: number | null = null;
  try {
    const cRes = await fetch(
      `${SB_URL}/rest/v1/candidatos?coach_id=eq.${row.id}&select=id&limit=0`,
      { headers: { ...headers, Prefer: "count=exact" } },
    );
    if (cRes.ok) {
      const range = cRes.headers.get("content-range") || "";
      const total = parseInt(range.split("/")[1] || "0", 10);
      if (!isNaN(total)) clientes_total = total;
    }
    const rRes = await fetch(
      `${SB_URL}/rest/v1/candidatos?coach_id=eq.${row.id}&resena=not.is.null&select=resena`,
      { headers },
    );
    if (rRes.ok) {
      const arr: CandReview[] = await rRes.json();
      let sum = 0;
      for (const c of arr) {
        const r = parseResena(c.resena);
        if (r) { reviews_count++; sum += r; }
      }
      if (reviews_count > 0) avg_rating = Math.round((sum / reviews_count) * 10) / 10;
    }
  } catch (_e) { /* opcional */ }

  const cfg = row.configuracion || {};
  const str = (k: string) => typeof cfg[k] === "string" ? cfg[k] as string : null;
  const arr = (k: string) => Array.isArray(cfg[k]) ? cfg[k] as unknown[] : [];

  return json({
    coach: {
      id: row.id, // UUID — necesario para que el frontend lo pase a connect-checkout
      stripe_connected: !!str("stripe_account_id"), // flag para mostrar/no el botón "Comprar"
      nombre: row.nombre,
      slug: row.slug,
      titulo_profesional: row.titulo_profesional,
      tagline: row.tagline,
      bio_publica: row.bio,
      mi_enfoque: row.mi_enfoque,
      especialidades: row.especialidades || [],
      atiende: row.atiende,
      anios_experiencia: row.anios_experiencia,
      calendly_url: str("calendly_url"),
      foto_perfil_url: row.foto_url,
      linkedin_url: str("linkedin_url"),
      instagram_url: str("instagram_url"),
      web_url: str("web_url"),
      servicios: arr("servicios"),
      videos: arr("videos"),
      links: arr("links"),
      stats: { clientes_total, reviews_count, avg_rating },
    },
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
      "cache-control": "public, max-age=60",
    },
  });
}
