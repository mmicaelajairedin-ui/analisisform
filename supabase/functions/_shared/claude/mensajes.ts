// ===================================================================
// _shared/claude/mensajes.ts — UNA sola forma de llamar a Claude desde
// las Edge Functions de texto de Pathway.
//
// POR QUÉ EXISTE
//
// `claude-sonnet-4-5` se RETIRA el 30-11-2026 (página oficial de
// deprecaciones de Anthropic): pasada esa fecha, sus peticiones fallan. El
// reemplazo recomendado es `claude-sonnet-5-5`. Cuatro funciones lo usaban,
// cada una con su copia de `callClaude`: generar-informe, ia-pathway,
// recomendar-coach y generar-perfil-coach. Cambiar el nombre del modelo en
// las cuatro NO basta, por dos razones de la guía de migración:
//
//   1. Sonnet 5.5 piensa por defecto (adaptativo) y la respuesta puede
//      EMPEZAR por un bloque `thinking` con el texto vacío. Las cuatro leían
//      `content[0].text`, así que habrían devuelto "" → informe en blanco,
//      JSON sin parsear o el chat contestando «No estoy segura…».
//   2. `thinking: {type: "disabled"}` da 400 en Sonnet 5.5. El ajuste
//      equivalente a «sin razonamiento extendido», que es como corrían con
//      Sonnet 4.5, es `{type: "between_tools"}`, válido con effort `high` o
//      menor. Sin herramientas, la respuesta trae solo texto.
//
// Las dos cosas viven AQUÍ y no cuatro veces: una regla copiada en cuatro
// ficheros se desalinea y git mezcla sin avisar (R-61 de MultiCoach).
//
// QUÉ NO CAMBIA, a propósito: el prompt de sistema, los mensajes y el
// `max_tokens` de cada llamada los sigue poniendo cada función, igual que
// antes. Y el CONTRATO de salida es el mismo: un string, "" si no hay texto.
// Una respuesta vacía o un rechazo siguen así el MISMO camino de error que
// cada función ya tenía para una respuesta ilegible — no se inventa ninguno
// nuevo — pero ahora quedan escritos en el log con su motivo.
// ===================================================================

export const MODELO_CLAUDE = "claude-sonnet-5-5";

// Se conserva la versión que ya enviaban las cuatro funciones. Cambiar de
// versión de API es otra migración, con sus propias roturas.
export const VERSION_API = "2023-06-01";

// El ajuste que reproduce cómo corrían con Sonnet 4.5: sin razonamiento
// extendido. `high` es el defecto del modelo y el máximo que admite
// `between_tools`; la guía recomienda empezar ahí cuando la carga no es
// agéntica ni sensible a la latencia.
export const AJUSTE_RAZONAMIENTO = {
  thinking: { type: "between_tools" },
  output_config: { effort: "high" },
} as const;

export type MensajeClaude = { role: string; content: string };

export interface PeticionClaude {
  system: string;
  messages: MensajeClaude[];
  maxTokens: number;
  apiKey: string;
  // Para el log: qué función llama. No viaja a la API.
  origen?: string;
}

/** El cuerpo exacto que se envía. Exportado para que la prueba lo vigile. */
export function cuerpoClaude(p: PeticionClaude): Record<string, unknown> {
  return {
    model: MODELO_CLAUDE,
    max_tokens: p.maxTokens,
    system: p.system,
    messages: p.messages,
    ...AJUSTE_RAZONAMIENTO,
  };
}

/**
 * El texto de una respuesta de la API, leído por TIPO de bloque y nunca por
 * posición. Une todos los bloques `text` en orden; los `thinking` se ignoran.
 * Devuelve "" si no hay texto, igual que el `content[0].text || ""` de antes.
 */
export function textoDeRespuesta(data: unknown, origen = "claude"): string {
  const d = (data || {}) as { content?: unknown; stop_reason?: unknown; stop_details?: unknown };
  const bloques = Array.isArray(d.content) ? d.content : [];
  const texto = bloques
    .filter((b) => b && (b as { type?: unknown }).type === "text" && typeof (b as { text?: unknown }).text === "string")
    .map((b) => (b as { text: string }).text)
    .join("");

  // Un rechazo llega como HTTP 200 con `stop_reason: "refusal"`. No se pinta
  // nada nuevo al usuario: cae al mismo camino que una respuesta vacía. Pero
  // queda escrito, con su categoría, para que no sea un fallo invisible.
  if (d.stop_reason === "refusal") {
    const cat = (d.stop_details as { category?: unknown } | null)?.category ?? null;
    console.warn(`[${origen}] Claude rechazó la petición (refusal, categoría: ${cat})`);
  } else if (d.stop_reason === "max_tokens") {
    console.warn(`[${origen}] Claude cortó la respuesta por max_tokens`);
  } else if (!texto) {
    console.warn(`[${origen}] Claude respondió sin bloques de texto (stop_reason: ${String(d.stop_reason)})`);
  }
  return texto;
}

/**
 * Error HTTP de la API. El `message` es `Claude API <status>: <cuerpo>`, el
 * formato que ya usaban generar-informe, recomendar-coach y
 * generar-perfil-coach; `status` y `cuerpo` van aparte para quien tenga otro
 * formato propio (ia-pathway).
 */
export class ErrorClaudeHttp extends Error {
  status: number;
  cuerpo: string;
  constructor(status: number, cuerpo: string) {
    super(`Claude API ${status}: ${cuerpo.slice(0, 300)}`);
    this.status = status;
    this.cuerpo = cuerpo;
  }
}

/** Llama a la API y devuelve el texto (o "" si no hay). Lanza `ErrorClaudeHttp` si no es 2xx. */
export async function llamarClaude(p: PeticionClaude): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": p.apiKey,
      "anthropic-version": VERSION_API,
      "content-type": "application/json",
    },
    body: JSON.stringify(cuerpoClaude(p)),
  });
  if (!res.ok) throw new ErrorClaudeHttp(res.status, await res.text());
  return textoDeRespuesta(await res.json(), p.origen);
}
