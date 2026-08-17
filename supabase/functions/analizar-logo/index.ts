import Anthropic from "https://esm.sh/@anthropic-ai/sdk";

const client = new Anthropic();

interface BrandingProposal {
  colorPrincipal: string;
  colorSecundario: string;
  colorAccento: string;
  colorFondo: string;
  colorTexto: string;
  razon: string;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Método no permitido", { status: 405 });
  }

  try {
    const { logoUrl } = await req.json();

    if (!logoUrl || typeof logoUrl !== "string") {
      return new Response("logoUrl requerida", { status: 400 });
    }

    // Validar que sea una URL válida
    try {
      new URL(logoUrl);
    } catch {
      return new Response("logoUrl inválida", { status: 400 });
    }

    // Llamar a Claude Vision para analizar el logo
    const response = await client.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "url",
                url: logoUrl,
              },
            },
            {
              type: "text",
              text: `Analiza este logo de empresa y propón una paleta de colores coherente y profesional para su identidad visual.

Devuelve SOLO un JSON válido (sin explicaciones adicionales ni markdown):
{
  "colorPrincipal": "#XXXXXX",
  "colorSecundario": "#XXXXXX",
  "colorAccento": "#XXXXXX",
  "colorFondo": "#XXXXXX",
  "colorTexto": "#XXXXXX",
  "razon": "Breve razón de la paleta propuesta"
}

Criterios:
- Color principal: que inspire confianza y refleje la marca
- Color secundario: complementario o análogo
- Color acento: para botones, elementos interactivos
- Color fondo: limpio, profesional, que contraste bien con el texto
- Color texto: legible, profesional, alto contraste

Todos los colores en formato hexadecimal (#RRGGBB).`,
            },
          ],
        },
      ],
    });

    // Extraer el texto de la respuesta
    const content = response.content[0];
    if (content.type !== "text") {
      throw new Error("Respuesta inválida de Claude");
    }

    // Parsear el JSON
    let proposal: BrandingProposal;
    try {
      // Buscar JSON en la respuesta (puede tener markdown o texto extra)
      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No se encontró JSON válido");
      }
      proposal = JSON.parse(jsonMatch[0]);
    } catch {
      console.error("Error parsing response:", content.text);
      throw new Error("No se pudo parsear la propuesta de colores");
    }

    // Validar que todos los campos sean colores hexadecimales válidos
    const hexRegex = /^#[0-9A-F]{6}$/i;
    const campos = [
      "colorPrincipal",
      "colorSecundario",
      "colorAccento",
      "colorFondo",
      "colorTexto",
    ];

    for (const campo of campos) {
      if (!hexRegex.test(proposal[campo as keyof BrandingProposal] || "")) {
        throw new Error(`Color inválido en ${campo}`);
      }
    }

    return new Response(JSON.stringify(proposal), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Error desconocido",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
