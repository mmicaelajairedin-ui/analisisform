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

const SYSTEM = `Sos un analista financiero meticuloso. Recibís el extracto bancario de un cliente (PDF), que puede cubrir UNO o VARIOS meses.
Tu trabajo: revisar TODOS los movimientos de gasto (egresos) y clasificarlos con precisión, agrupados POR MES.

CATEGORÍAS EXACTAS (usá estos nombres, sin inventar otros):
- Vivienda: alquiler, hipoteca, expensas, comunidad, seguro del hogar.
- Alimentación: supermercados, almacén, verdulería, carnicería, panadería (Mercadona, Carrefour, Dia, Lidl, Coto, etc.). OJO: comida en bares/restaurantes/delivery NO va acá, va en Ocio.
- Transporte: combustible/nafta, transporte público, peajes, parking, taxi, Uber/Cabify, mantenimiento del auto, seguro del auto.
- Ocio: restaurantes, bares, cafeterías, delivery (Glovo, Uber Eats, PedidosYa), cine, viajes, hoteles, ropa, regalos, hobbies, streaming de entretenimiento (Netflix, Spotify, Disney+, HBO).
- Servicios: luz, gas, agua, internet, teléfono/móvil, suscripciones de software/productividad (iCloud, Google, ChatGPT), gimnasio.
- Salud: farmacia, médico, dentista, óptica, obra social/seguro de salud, psicólogo.
- Deudas: pago de tarjeta de crédito, cuotas de préstamos, financiaciones, intereses.
- Ahorro: transferencias a cuenta de ahorro/inversión propia, plazo fijo, fondos, compra de dólares/cripto para ahorrar, aportes a plan de pensión.
- Otros: SOLO si realmente no encaja en ninguna de las anteriores. Minimizá su uso: tratá de clasificar cada movimiento; "Otros" es el último recurso, no un cajón de sastre.

REGLAS DE PRECISIÓN:
- Revisá CADA línea del extracto; no te saltees movimientos. Inferí la categoría por el nombre del comercio/concepto.
- Ignorá ingresos, sueldos, abonos, devoluciones y transferencias RECIBIDAS. Una transferencia ENVIADA a ahorro/inversión propia SÍ es "Ahorro"; una transferencia enviada a otra persona, clasificála por su concepto si se entiende, si no "Otros".
- Si un comercio es ambiguo, elegí la categoría más probable según el nombre; no lo mandes a "Otros" por las dudas.

Devolvé ÚNICAMENTE un JSON válido, sin texto antes ni después, con esta forma exacta:
{"moneda":"<EUR|USD|ARS|...>","meses":[{"mes":"YYYY-MM","total":<number>,"categorias":[{"nombre":"Vivienda","monto":<number>}, ...]}, ...],"categorias":[{"nombre":"Vivienda","monto":<number>}, ...],"total":<number>,"resumen":"<1-2 frases con lo más relevante>"}
- "meses": un objeto por cada mes presente, del más antiguo al más reciente. Incluí solo categorías con monto > 0.
- "categorias" y "total": el PROMEDIO MENSUAL (suma de todos los meses / cantidad de meses), para representar un mes típico.
- Montos como número, sin símbolo ni separador de miles.
- Si no podés leer el PDF devolvé {"error":"no_legible"}.`;

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
