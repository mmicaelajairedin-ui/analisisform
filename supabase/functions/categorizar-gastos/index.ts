// ===================================================================
// categorizar-gastos — recibe un extracto bancario (PDF en base64),
// se lo manda a Claude para clasificar los gastos por categoría y
// devuelve un JSON. Lo usa el panel del coach (nicho financiero).
//
// Body: { pdf_base64: "<base64 del PDF (con o sin prefijo data:)>" }
// Respuesta: { total, moneda, categorias:[{nombre,monto}], resumen }
//
// Secret requerido (Supabase → Edge Functions → Secrets):
//   ANTHROPIC_API_KEY — API key de Anthropic (sk-ant-...)
//
// Deploy:  supabase functions deploy categorizar-gastos --no-verify-jwt
// ===================================================================

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const CLAUDE_MODEL = "claude-sonnet-4-5";

const SYSTEM = `Sos un asistente financiero. Recibís el extracto bancario de un cliente (PDF).
Clasificá SOLO los gastos (egresos) en estas categorías exactas:
Vivienda, Alimentación, Transporte, Ocio, Servicios, Salud, Deudas, Ahorro, Otros.
Sumá el monto total por categoría (ignorá ingresos/abonos/transferencias recibidas).
Devolvé ÚNICAMENTE un JSON válido, sin texto antes ni después, con esta forma exacta:
{"total": <number>, "moneda": "<EUR|USD|ARS|...>", "categorias": [{"nombre":"Vivienda","monto":<number>}, ...], "resumen":"<1-2 frases con lo más relevante>"}
Reglas: montos como número sin símbolo ni separador de miles; incluí solo categorías con monto > 0; si no podés leer el PDF devolvé {"error":"no_legible"}.`;

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...CORS_HEADERS, "content-type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  try {
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY") || "";
    if (!apiKey) return json({ error: "ANTHROPIC_API_KEY no configurada" }, 500);

    const body = await req.json().catch(() => ({}));
    const pdf = String(body.pdf_base64 || "").replace(/^data:[^,]+,/, "");
    if (!pdf) return json({ error: "falta pdf_base64" }, 400);

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 1500,
        system: SYSTEM,
        messages: [{
          role: "user",
          content: [
            { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdf } },
            { type: "text", text: "Clasificá los gastos de este extracto y devolvé solo el JSON." },
          ],
        }],
      }),
    });

    if (!res.ok) {
      const e = await res.text();
      return json({ error: "claude_" + res.status, detail: e.slice(0, 220) }, 502);
    }
    const data = await res.json();
    const txt = (data?.content?.[0]?.text) || "";
    const m = txt.match(/\{[\s\S]*\}/);
    let out: any;
    try { out = JSON.parse(m ? m[0] : txt); } catch (_e) {
      return json({ error: "parse", raw: txt.slice(0, 300) }, 502);
    }
    return json(out, 200);
  } catch (e) {
    return json({ error: String(e).slice(0, 220) }, 500);
  }
});
