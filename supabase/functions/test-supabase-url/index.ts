// Test Edge Function — Compara ambas URLs (proxy vs directo)
// Fin: Determinar qué URL funciona y cuál devuelve 403
//
// Deploy:
//   supabase functions deploy test-supabase-url --no-verify-jwt
//
// Test:
//   curl https://api.pathwaycareercoach.com/functions/v1/test-supabase-url

Deno.serve(async (req) => {
  const PROXY_URL = "https://api.pathwaycareercoach.com";
  const DIRECT_URL = "https://ddxnrsnjdvtqhxunxbwj.supabase.co";

  // Keys (usar la anon key del proyecto)
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

  const results = {
    proxy: { url: "", headers: {}, status: 0, statusText: "", response: "", error: "" },
    direct: { url: "", headers: {}, status: 0, statusText: "", response: "", error: "" },
  };

  // ── Test 1: Proxy ──
  try {
    const proxyUrl = `${PROXY_URL}/rest/v1/usuarios?slug=eq.micaela-jairedin&select=id,nombre,slug&limit=1`;
    const headers = {
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
      "Content-Type": "application/json",
    };

    results.proxy.url = proxyUrl;
    results.proxy.headers = headers;

    console.log(`[test-url] PROXY request:`);
    console.log(`  URL: ${proxyUrl}`);
    console.log(`  Headers: apikey=${ANON_KEY.substring(0, 20)}..., Authorization=Bearer...`);

    const proxyRes = await fetch(proxyUrl, { headers });
    results.proxy.status = proxyRes.status;
    results.proxy.statusText = proxyRes.statusText;
    const proxyBody = await proxyRes.text();
    results.proxy.response = proxyBody.substring(0, 500); // limitar tamaño

    console.log(`[test-url] PROXY response:`);
    console.log(`  Status: ${proxyRes.status} ${proxyRes.statusText}`);
    console.log(`  Body (primeros 500 chars): ${results.proxy.response}`);
  } catch (e) {
    results.proxy.error = String(e);
    console.log(`[test-url] PROXY error: ${String(e)}`);
  }

  // ── Test 2: Directo ──
  try {
    const directUrl = `${DIRECT_URL}/rest/v1/usuarios?slug=eq.micaela-jairedin&select=id,nombre,slug&limit=1`;
    const headers = {
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
      "Content-Type": "application/json",
    };

    results.direct.url = directUrl;
    results.direct.headers = headers;

    console.log(`[test-url] DIRECT request:`);
    console.log(`  URL: ${directUrl}`);
    console.log(`  Headers: apikey=${ANON_KEY.substring(0, 20)}..., Authorization=Bearer...`);

    const directRes = await fetch(directUrl, { headers });
    results.direct.status = directRes.status;
    results.direct.statusText = directRes.statusText;
    const directBody = await directRes.text();
    results.direct.response = directBody.substring(0, 500); // limitar tamaño

    console.log(`[test-url] DIRECT response:`);
    console.log(`  Status: ${directRes.status} ${directRes.statusText}`);
    console.log(`  Body (primeros 500 chars): ${results.direct.response}`);
  } catch (e) {
    results.direct.error = String(e);
    console.log(`[test-url] DIRECT error: ${String(e)}`);
  }

  // ── Análisis ──
  console.log(`[test-url] ANALYSIS:`);
  console.log(`  Proxy: ${results.proxy.status === 200 ? "✅ OK" : `❌ ${results.proxy.status} ${results.proxy.error || results.proxy.statusText}`}`);
  console.log(`  Direct: ${results.direct.status === 200 ? "✅ OK" : `❌ ${results.direct.status} ${results.direct.error || results.direct.statusText}`}`);

  return new Response(JSON.stringify(results, null, 2), {
    headers: { "Content-Type": "application/json" },
    status: 200,
  });
});
