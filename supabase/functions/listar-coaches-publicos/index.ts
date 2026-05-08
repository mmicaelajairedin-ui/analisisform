// Supabase Edge Function — listar-coaches-publicos
//
// Devuelve la lista de coaches con perfil_publico_activo=true.
// Usado por la pagina /coaches.html (directorio publico).
//
// Sin auth — publica.
// Desplegar: supabase functions deploy listar-coaches-publicos --no-verify-jwt

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
  "especialidades",
  "atiende",
  "anios_experiencia",
  "foto_url",
].join(",");

interface Row {
  nombre: string | null;
  slug: string | null;
  titulo_profesional: string | null;
  tagline: string | null;
  especialidades: string[] | null;
  atiende: string | null;
  anios_experiencia: number | null;
  foto_url: string | null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }
  if (req.method !== "GET") {
    return json({ error: "GET only" }, 405);
  }

  const SB_URL = Deno.env.get("SUPABASE_URL") || "";
  const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
    Deno.env.get("SUPABASE_ANON_KEY") || "";
  if (!SB_URL || !SB_KEY) {
    return json({ error: "supabase_env_missing" }, 500);
  }

  try {
    const q = `${SB_URL}/rest/v1/usuarios` +
      `?perfil_publico_activo=eq.true` +
      `&slug=not.is.null` +
      `&select=${SELECT_FIELDS}` +
      `&order=anios_experiencia.desc.nullslast,nombre.asc`;
    const sbRes = await fetch(q, {
      headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
    });
    if (!sbRes.ok) return json({ error: "supabase_error", status: sbRes.status }, 502);
    const rows: Row[] = await sbRes.json();

    const coaches = rows.map((r) => ({
      nombre: r.nombre,
      slug: r.slug,
      titulo_profesional: r.titulo_profesional,
      tagline: r.tagline,
      especialidades: r.especialidades || [],
      atiende: r.atiende,
      anios_experiencia: r.anios_experiencia,
      foto_perfil_url: r.foto_url,
    }));

    return json({ coaches, total: coaches.length });
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
      "cache-control": "public, max-age=120",
    },
  });
}
