// ===================================================================
// link-preview — devuelve la imagen de previsualización (og:image) de una lista
// de URLs, para que las tarjetas de Recursos (pw-recursos.js) muestren una
// portada REAL del recurso en vez de la ilustración generada.
//
// Server-side (no lo puede hacer el navegador por CORS): baja el HTML de cada
// página, extrae og:image / twitter:image / <link rel=image_src>, resuelve
// relativas → absolutas. Para YouTube deriva la miniatura directo del id. Cachea
// el resultado en la tabla `link_previews` (por hash de URL) para no re-bajar la
// página cada vez.
//
// POST { urls: ["https://…", …] }  (máx 40)
//   → { previews: { "<url>": "<imageUrl>" | "" , … } }   ("" = sin imagen)
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// Deploy: supabase functions deploy link-preview --no-verify-jwt
// Requiere migración: supabase/migrations/link_previews.sql
// ===================================================================

const SB_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
  Deno.env.get("SERVICE_ROLE_KEY") || "";
const svc = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` };

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

// Cache de 30 días: consideramos fresco un preview con menos de ese tiempo.
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

async function hashUrl(u: string): Promise<string> {
  const data = new TextEncoder().encode(u);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf)).slice(0, 12).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function ytThumb(u: string): string {
  const m = u.match(/[?&]v=([A-Za-z0-9_-]{11})/) || u.match(/youtu\.be\/([A-Za-z0-9_-]{11})/) ||
    u.match(/\/embed\/([A-Za-z0-9_-]{11})/) || u.match(/\/shorts\/([A-Za-z0-9_-]{11})/);
  return m ? `https://i.ytimg.com/vi/${m[1]}/hqdefault.jpg` : "";
}

function absolutize(img: string, base: string): string {
  try { return new URL(img, base).href; } catch { return img; }
}

function extractOg(html: string, base: string): string {
  // og:image / twitter:image / rel=image_src. Tolerante al orden de atributos.
  const patterns = [
    /<meta[^>]+property=["']og:image(?::url)?["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::url)?["']/i,
    /<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image(?::src)?["']/i,
    /<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/i,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m && m[1]) return absolutize(m[1].trim(), base);
  }
  return "";
}

async function fetchOg(url: string): Promise<string> {
  const yt = ytThumb(url);
  if (yt) return yt;
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), 6000);
  try {
    const r = await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; PathwayPreview/1.0; +https://pathwaycareercoach.com)",
        "Accept": "text/html,application/xhtml+xml",
      },
    });
    if (!r.ok) return "";
    const ct = (r.headers.get("content-type") || "").toLowerCase();
    if (ct.startsWith("image/")) return url; // la URL ya es una imagen
    if (!ct.includes("html")) return "";
    // Leer solo el principio (el <head> con las meta) — evita bajar páginas enormes.
    const reader = r.body?.getReader();
    if (!reader) { const t = await r.text(); return extractOg(t, r.url || url); }
    let html = "", received = 0;
    const dec = new TextDecoder();
    while (received < 200000) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      html += dec.decode(value, { stream: true });
      if (/<\/head>/i.test(html)) break;
    }
    try { await reader.cancel(); } catch { /* noop */ }
    return extractOg(html, r.url || url);
  } catch {
    return "";
  } finally {
    clearTimeout(to);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "post_only" }, 405);

  let body: { urls?: string[] };
  try { body = await req.json(); } catch { return json({ error: "bad_json" }, 400); }
  let urls = Array.isArray(body.urls) ? body.urls : [];
  urls = urls.map((u) => (u || "").toString().trim()).filter((u) => /^https?:\/\//i.test(u)).slice(0, 40);
  if (!urls.length) return json({ previews: {} });

  const previews: Record<string, string> = {};
  const hashes: Record<string, string> = {};
  for (const u of urls) hashes[u] = await hashUrl(u);

  // 1) Cache: leer lo que ya tengamos fresco.
  const cacheAvailable = !!(SB_URL && SERVICE);
  const missing: string[] = [];
  if (cacheAvailable) {
    try {
      const inList = urls.map((u) => `"${hashes[u]}"`).join(",");
      const cr = await fetch(
        `${SB_URL}/rest/v1/link_previews?select=url_hash,image,ts&url_hash=in.(${inList})`,
        { headers: svc },
      );
      const rows: Array<{ url_hash: string; image: string; ts: string }> = cr.ok ? await cr.json() : [];
      const byHash: Record<string, { image: string; ts: string }> = {};
      for (const row of rows) byHash[row.url_hash] = { image: row.image, ts: row.ts };
      for (const u of urls) {
        const c = byHash[hashes[u]];
        if (c && (Date.now() - new Date(c.ts).getTime()) < TTL_MS) previews[u] = c.image || "";
        else missing.push(u);
      }
    } catch {
      missing.push(...urls);
    }
  } else {
    missing.push(...urls);
  }

  // 2) Faltantes: bajar en paralelo (acotado).
  const results = await Promise.all(missing.map(async (u) => ({ u, img: await fetchOg(u) })));
  for (const { u, img } of results) previews[u] = img || "";

  // 3) Guardar en cache lo recién bajado (upsert por url_hash).
  if (cacheAvailable && results.length) {
    try {
      const rows = results.map(({ u, img }) => ({ url_hash: hashes[u], url: u, image: img || "", ts: new Date().toISOString() }));
      await fetch(`${SB_URL}/rest/v1/link_previews?on_conflict=url_hash`, {
        method: "POST",
        headers: { ...svc, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates" },
        body: JSON.stringify(rows),
      });
    } catch { /* cache best-effort */ }
  }

  return json({ previews });
});
