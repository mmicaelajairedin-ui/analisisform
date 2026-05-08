// Supabase Edge Function — obtener-perfil-coach
//
// Lee de usuarios un coach por su slug y devuelve solo los campos
// publicos. Si perfil_publico_activo=false o el slug no existe, devuelve
// 404.
//
// Sin auth — esta funcion alimenta la pagina publica /coach/{slug} que
// los coaches comparten en LinkedIn / IG.
//
// IMPORTANTE: usuarios ya tiene bio, foto_url y configuracion (JSONB).
// Leemos de esos campos directamente y mapeamos al contrato que coach.html
// espera (bio_publica, foto_perfil_url, calendly_url).
//
// Desplegar:
//   supabase functions deploy obtener-perfil-coach --no-verify-jwt

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, authorization, apikey, x-client-info",
};

const SELECT_FIELDS = [
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
  if (!SB_URL || !SB_KEY) {
    return json({ error: "supabase_env_missing" }, 500);
  }

  try {
    const q = `${SB_URL}/rest/v1/usuarios` +
      `?slug=eq.${encodeURIComponent(slug)}` +
      `&perfil_publico_activo=eq.true` +
      `&select=${SELECT_FIELDS}` +
      `&limit=1`;
    const sbRes = await fetch(q, {
      headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
    });
    if (!sbRes.ok) return json({ error: "supabase_error", status: sbRes.status }, 502);
    const rows: UsuarioRow[] = await sbRes.json();
    if (!rows.length) return json({ error: "not_found" }, 404);

    const r = rows[0];
    const cfg = r.configuracion || {};
    const calendly = typeof cfg.calendly_url === "string" ? cfg.calendly_url : null;

    return json({
      coach: {
        nombre: r.nombre,
        slug: r.slug,
        titulo_profesional: r.titulo_profesional,
        tagline: r.tagline,
        bio_publica: r.bio,
        mi_enfoque: r.mi_enfoque,
        especialidades: r.especialidades,
        atiende: r.atiende,
        anios_experiencia: r.anios_experiencia,
        calendly_url: calendly,
        foto_perfil_url: r.foto_url,
      },
    });
  } catch (_e) {
    return json({ error: "supabase_unreachable" }, 502);
  }
});

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
