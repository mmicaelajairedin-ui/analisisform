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
  "email",
  "nombre",
  "slug",
  "titulo_profesional",
  "tagline",
  "bio",
  "mi_enfoque",
  "especialidades",
  "atiende",
  "anios_experiencia",
  "badges",
  "last_seen",
  "foto_url",
  "configuracion",
  "activo",
].join(",");

// ¿La suscripción del coach está VIGENTE? Un coach con la prueba vencida y sin
// pagar no debe tener perfil público accesible (aunque alguien tenga el link
// directo). Cuando paga, el webhook pone estado_sub='activa' y vuelve solo.
function subVigente(cfg: Record<string, unknown>): boolean {
  if (cfg.es_pro_vitalicio === true) return true;
  const estado = String(cfg.estado_sub || "");
  if (estado === "activa") return true;
  if (estado === "cancelada" || estado === "vencida") return false;
  const ff = cfg.fecha_fin_prueba;
  if (ff) { const t = Date.parse(String(ff)); if (!isNaN(t)) return t > Date.now(); }
  return true; // sin datos concluyentes → no ocultar (cuentas viejas)
}

interface UsuarioRow {
  id: string;
  email: string | null;
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
  activo?: boolean | null;
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
    // 1) Busca en top-level: slug + perfil_publico_activo
    const q1 = `${SB_URL}/rest/v1/usuarios` +
      `?slug=eq.${encodeURIComponent(slug)}` +
      `&or=(perfil_publico_activo.eq.true,configuracion->>perfil_publico_activo.eq.true)` +
      `&select=${SELECT_FIELDS}` +
      `&limit=1`;
    let sbRes = await fetch(q1, { headers });
    if (!sbRes.ok) return json({ error: "supabase_error", status: sbRes.status }, 502);
    let rows: UsuarioRow[] = await sbRes.json();

    // 2) Fallback: slug en configuracion + perfil público en top-level O config
    if (!rows.length) {
      const q2 = `${SB_URL}/rest/v1/usuarios` +
        `?configuracion->>slug=eq.${encodeURIComponent(slug)}` +
        `&or=(perfil_publico_activo.eq.true,configuracion->>perfil_publico_activo.eq.true)` +
        `&select=${SELECT_FIELDS}` +
        `&limit=1`;
      sbRes = await fetch(q2, { headers });
      if (sbRes.ok) rows = await sbRes.json();
    }

    if (!rows.length) return json({ error: "not_found" }, 404);
    row = rows[0];
    // Gate de suscripción: si la prueba venció y no pagó (o está de baja), el
    // perfil público no existe públicamente (mismo criterio que el directorio).
    if (row.activo === false || !subVigente((row.configuracion || {}) as Record<string, unknown>)) {
      return json({ error: "not_found" }, 404);
    }
    // Asegurar que row.slug tiene el valor correcto (top-level O de configuracion)
    const cfg = (row.configuracion || {}) as Record<string, unknown>;
    if (!row.slug && typeof cfg.slug === "string") row.slug = cfg.slug;
    if (!row.slug) row.slug = slug; // fallback final
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
    let sum = 0;
    // (a) Tabla `reviews` — fuente ACTUAL: reseñas del marketplace + las que sube
    //     el portal del cliente (puente reseña→público). Solo publica=true (3-5★),
    //     que son las que se muestran; consistente con los testimonios.
    if (row.slug) {
      const rvRes = await fetch(
        `${SB_URL}/rest/v1/reviews?coach_slug=eq.${encodeURIComponent(row.slug)}&publica=eq.true&select=rating`,
        { headers },
      );
      if (rvRes.ok) {
        const rows = await rvRes.json();
        for (const rr of rows) { const n = parseInt(rr.rating, 10); if (n >= 1 && n <= 5) { reviews_count++; sum += n; } }
      }
    }
    // (b) Legacy: candidatos.resena (reseñas viejas guardadas en el candidato).
    const rRes = await fetch(
      `${SB_URL}/rest/v1/candidatos?coach_id=eq.${row.id}&resena=not.is.null&select=resena`,
      { headers },
    );
    if (rRes.ok) {
      const arr: CandReview[] = await rRes.json();
      for (const c of arr) {
        const r = parseResena(c.resena);
        if (r) { reviews_count++; sum += r; }
      }
    }
    if (reviews_count > 0) avg_rating = Math.round((sum / reviews_count) * 10) / 10;
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
      // Versiones en inglés (las carga el coach en su panel → se guardan en
      // configuracion). El perfil público las usa cuando el visitante navega en
      // inglés; si están vacías, cae al texto original.
      titulo_profesional_en: str("titulo_profesional_en"),
      tagline_en: str("tagline_en"),
      bio_publica_en: str("bio_en"),
      mi_enfoque_en: str("mi_enfoque_en"),
      atiende_en: str("atiende_en"),
      anios_experiencia: row.anios_experiencia,
      // Insignias de Pathway del coach (badges reales que fue ganando en la
      // plataforma). De acá salen "Insignias Pathway" (cantidad) y la "Medalla
      // Pathway" (derivada: 6+ oro · 4+ plata · 2+ bronce) — datos REALES, sin inventar.
      badges: Array.isArray(row.badges) ? row.badges : [],
      last_seen: row.last_seen || null, // para "Responde rápido" (derivado en el front)
      seo_keywords: arr("seo_keywords"), // keywords SEO que generó la IA (configuracion) → meta keywords + schema
      // Disponibilidad (días/horas que el coach configuró) → el perfil muestra las
      // "Próximas fechas disponibles" reales. La hora exacta se elige en el reservador.
      disponibilidad: (cfg && typeof cfg.disponibilidad === "object" && cfg.disponibilidad) ? cfg.disponibilidad : null,
      // Bloque IA (diferenciador): "¿Por qué elegir a X?" (SEO/GEO) + "Ideal para ti si…"
      recomendacion_ia: str("recomendacion_ia"),
      ideal_para: arr("ideal_para"),
      no_ideal_para: arr("no_ideal_para"),
      // Casos de éxito REALES que carga el coach (texto "Antes → Después"). Cada
      // item puede ser {antes, despues} o el string "Antes → Después".
      casos_exito: arr("casos_exito"),

      calendly_url: str("calendly_url"),
      // Canales de contacto de respaldo: si el coach no tiene Calendly, el
      // perfil público igual muestra un CTA (WhatsApp si lo configuró, si no
      // un mailto a su email de login). Así el perfil nunca queda sin acción.
      whatsapp: str("whatsapp"),
      contacto_email: row.email,
      foto_perfil_url: row.foto_url || str("foto_url") || str("foto_perfil"),
      linkedin_url: str("linkedin_url"),
      instagram_url: str("instagram_url"),
      web_url: str("web_url"),
      servicios: arr("servicios"),
      moneda: str("moneda") || "eur",
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
