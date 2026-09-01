// notif-coach · envío de un email con reintento acotado ante límite de tasa.
//
// POR QUÉ EXISTE
// El run #15 (2026-08-31 14:38 UTC, el primero con AP2 en opt-out) mandó 38
// digests en 33 s y los 8 últimos no salieron:
//
//   ftcharlie95@gmail.com: RateLimitError: Rate limit exceeded for trace
//   01a058418a9b7703883af5768f6a6b93. Retry after 32872ms.
//
// Las 8 comparten el mismo `trace`, y el texto no lo produce `send-email`
// (que devuelve 502 con {ok:false,status,error}, nunca "RateLimitError"):
// es `String(e)` de un `fetch` que LANZÓ. Quien corta es la plataforma de
// Supabase, limitando las invocaciones anidadas notif-coach → send-email.
// El bucle las hacía seguidas y sin pausa, así que al llegar a ~30 se topaba
// con el límite y descartaba el resto. El propio error decía cuánto esperar.
//
// POR QUÉ REINTENTAR AQUÍ NO PUEDE DUPLICAR UN EMAIL
// Sólo se reintenta un RECHAZO EXPLÍCITO por límite de tasa. Un rechazo así
// es, por definición, un mensaje que el proveedor NO aceptó: la petición se
// corta en la puerta y nunca llega a Brevo. Cualquier otro fallo —corte de
// red, timeout, respuesta perdida, 5xx— es ambiguo: no sabemos si el mensaje
// se aceptó antes de que se perdiera la respuesta, así que NO se reintenta.
// Para un resumen semanal, un email que falta es molesto; uno duplicado
// erosiona la confianza en la plataforma. Ante la duda, no se reenvía.

/** Espera de reserva cuando el proveedor no dice cuánto esperar. */
export const ESPERA_POR_DEFECTO_MS = 30_000;
/** Techo por espera: el proveedor pide ~33 s; más que esto es sospechoso. */
export const ESPERA_MAX_MS = 45_000;
/** Reintentos por destinatario (además del intento inicial). */
export const REINTENTOS_MAX = 2;
/**
 * Presupuesto de pared para TODO el digest. El workflow llama con
 * `curl --max-time 200`: si nos pasamos, curl corta, el job sale en rojo y se
 * pierde el informe de lo que sí se envió. Al agotarse dejamos de esperar y
 * anotamos el fallo, que es mucho mejor que quedarnos sin respuesta.
 */
export const PRESUPUESTO_MS = 120_000;

export type Resultado =
  | { estado: "enviado"; intentos: number }
  | { estado: "error"; intentos: number; detalle: string };

export interface Entorno {
  fetchImpl: typeof fetch;
  dormir: (ms: number) => Promise<void>;
  ahora: () => number;
  /** Instante en que arrancó el digest, para medir el presupuesto. */
  inicio: number;
  reintentosMax?: number;
}

/**
 * Devuelve los ms a esperar si `fallo` es un rechazo explícito por límite de
 * tasa, o `null` si es cualquier otra cosa (→ no se reintenta).
 *
 * Acepta las dos formas en que puede llegar:
 *   - una excepción lanzada por `fetch` (lo observado en el run #15), cuyo
 *     `name` es RateLimitError y cuyo mensaje trae "Retry after 32872ms";
 *   - una respuesta HTTP 429, por si la plataforma lo devuelve en vez de
 *     lanzarlo; entonces manda la cabecera `Retry-After` (segundos) o
 *     `retry-after-ms`.
 *
 * No cubre el 502 de `send-email` (fallo de Brevo): es otra capa, no es lo
 * que rompió el run #15, y reintentarla a ciegas sería reintentar
 * indiscriminadamente.
 */
export function esperaPorLimiteDeTasa(fallo: unknown): number | null {
  const acotar = (ms: number) =>
    Math.max(0, Math.min(Math.round(ms), ESPERA_MAX_MS));

  if (!fallo) return null;
  const obj = fallo as {
    status?: number;
    headers?: { get?: (k: string) => string | null };
    name?: unknown;
    message?: unknown;
  };

  // "Retry after 32872ms." / "retry after 32 s" — el valor que pide el
  // proveedor manda sobre cualquier valor por defecto, asi que se busca
  // primero. El "ms" se prueba antes que el "s": si no, `32872ms` se leeria
  // como 32872 segundos.
  const deMensaje = (txt: string): number | null => {
    const enMs = txt.match(/retry[\s_-]?after[:\s]*(\d+(?:\.\d+)?)\s*ms/i);
    if (enMs) return acotar(Number(enMs[1]));
    const enSeg = txt.match(/retry[\s_-]?after[:\s]*(\d+(?:\.\d+)?)\s*s/i);
    if (enSeg) return acotar(Number(enSeg[1]) * 1000);
    return null;
  };

  const nombre = String(obj.name ?? "");
  const mensaje = String(obj.message ?? "");
  const esExcepcionDeLimite = /ratelimit/i.test(nombre) ||
    /\brate[ _-]?limit(ed|ing)?\b/i.test(mensaje) ||
    /\brate[ _-]?limit(ed|ing)?\b/i.test(String(fallo));
  const es429 = obj.status === 429;

  // Ni excepcion de limite de tasa ni 429 → no se reintenta.
  if (!esExcepcionDeLimite && !es429) return null;
  // Una respuesta HTTP que NO es 429 no es un limite de tasa, diga lo que diga
  // su cuerpo: es `send-email` fallando por otra cosa.
  if (typeof obj.status === "number" && !es429) return null;

  const delTexto = deMensaje(mensaje) ?? deMensaje(String(fallo));
  if (delTexto !== null) return delTexto;

  const ms = obj.headers?.get?.("retry-after-ms");
  if (ms && Number.isFinite(Number(ms))) return acotar(Number(ms));
  const seg = obj.headers?.get?.("retry-after");
  if (seg && Number.isFinite(Number(seg))) return acotar(Number(seg) * 1000);

  return ESPERA_POR_DEFECTO_MS;
}

/**
 * Manda UN email, reintentando sólo si el proveedor lo rechazó por límite de
 * tasa. Devuelve el desenlace y cuántos intentos costó.
 *
 * Nota sobre el coste en tiempo: el límite es una tasa, así que la espera del
 * primer destinatario que se topa con él recarga el cupo para los siguientes.
 * En la práctica el digest entero paga una espera, no una por email.
 */
export async function enviarConReintento(
  url: string,
  init: RequestInit,
  env: Entorno,
): Promise<Resultado> {
  const maxIntentos = (env.reintentosMax ?? REINTENTOS_MAX) + 1;
  let intentos = 0;
  let ultimo = "";

  while (intentos < maxIntentos) {
    intentos++;
    let fallo: unknown = null;
    try {
      const r = await env.fetchImpl(url, init);
      if (r.ok) return { estado: "enviado", intentos };
      fallo = r;
      ultimo = `send-email ${r.status}`;
    } catch (e) {
      fallo = e;
      ultimo = String(e).slice(0, 120);
    }

    const espera = esperaPorLimiteDeTasa(fallo);
    // No es límite de tasa → no se reintenta (podría duplicar el envío).
    if (espera === null) return { estado: "error", intentos, detalle: ultimo };
    if (intentos >= maxIntentos) break;

    // Si esperar nos saca del presupuesto, no esperamos: preferimos anotar el
    // fallo y devolver el informe a que curl corte la llamada entera.
    const transcurrido = env.ahora() - env.inicio;
    if (transcurrido + espera > PRESUPUESTO_MS) {
      return {
        estado: "error",
        intentos,
        detalle: `${ultimo} (sin tiempo para reintentar)`,
      };
    }
    await env.dormir(espera);
  }
  return { estado: "error", intentos, detalle: ultimo };
}
