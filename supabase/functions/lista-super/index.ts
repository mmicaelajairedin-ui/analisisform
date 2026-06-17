// ===================================================================
// lista-super — recibe el plan de comidas semanal de un cliente (texto)
// y devuelve una LISTA DE COMPRAS agrupada por sección del súper, generada
// con Claude. La usa el portal del cliente (nicho fitness), columna derecha
// de la sección Nutrición.
//
// Body: { plan: "<texto del plan de comidas de toda la semana>" }
// Respuesta: { categorias:[{nombre, items:[...]}], nota }
//
// Secret requerido (Supabase → Edge Functions → Secrets):
//   ANTHROPIC_API_KEY — API key de Anthropic (sk-ant-...)
//
// Deploy:  supabase functions deploy lista-super --no-verify-jwt
//
// NOTA DE MODELO: usa claude-opus-4-8 (default recomendado). Es una extracción
// simple y de bajo volumen (se cachea en el cliente). Para abaratar, se puede
// cambiar CLAUDE_MODEL a "claude-haiku-4-5" — es una sola línea.
// ===================================================================

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const CLAUDE_MODEL = "claude-opus-4-8";

const SYSTEM = `Sos un asistente de nutrición práctico. Recibís el PLAN DE COMIDAS semanal de una persona (texto libre, día por día, puede incluir pautas).
Tu trabajo: armar una LISTA DE COMPRAS del súper, lista para usar, con los ingredientes que esa persona necesita comprar para cumplir el plan.

REGLAS:
- Extraé los ingredientes/alimentos mencionados en el plan. Deducí lo razonable (ej. "tostadas" → pan integral; "yogur con granola" → yogur + granola).
- AGRUPÁ los ítems por sección del supermercado. Usá solo estas secciones, en este orden, e incluí únicamente las que tengan ítems:
  "Frutas y verduras", "Carnes y pescados", "Lácteos y huevos", "Panadería y cereales", "Almacén y secos", "Bebidas", "Otros".
- UNIFICÁ duplicados (si "pollo" aparece varios días, va una sola vez). No pongas cantidades exactas; si ayuda, una referencia simple ("pollo (para 3 comidas)").
- Items concisos, en español neutro, en singular o plural natural. Máximo ~8 ítems por sección.
- Si el plan está vacío o no se entiende, devolvé {"categorias":[],"nota":"Tu coach todavía no cargó un plan de comidas."}.

Devolvé ÚNICAMENTE un JSON válido, sin texto antes ni después, con esta forma exacta:
{"categorias":[{"nombre":"Frutas y verduras","items":["Banana","Espinaca"]}, ...],"nota":"<1 frase opcional, ej. recordá revisar lo que ya tenés en casa>"}`;

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
    const plan = String(body.plan || "").trim().slice(0, 6000);
    if (!plan) return json({ categorias: [], nota: "Tu coach todavía no cargó un plan de comidas." }, 200);

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 1200,
        system: SYSTEM,
        messages: [{
          role: "user",
          content: "Plan de comidas de la semana:\n\n" + plan + "\n\nArmá la lista de compras y devolvé solo el JSON.",
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
    let out: unknown;
    try { out = JSON.parse(m ? m[0] : txt); } catch (_e) {
      return json({ error: "parse", raw: txt.slice(0, 300) }, 502);
    }
    return json(out, 200);
  } catch (e) {
    return json({ error: String(e).slice(0, 220) }, 500);
  }
});
