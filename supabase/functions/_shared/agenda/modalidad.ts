// modalidad.ts — QUIÉN decide la modalidad de una sesión, lado servidor.
//
// GEMELO DE `/pw-modalidad.js`. Es una transliteración literal, no una segunda
// implementación: mismo orden de comprobaciones, mismos valores, mismo respaldo.
//
// Existen dos ficheros y no uno por una razón de plataforma, no de diseño: las
// pantallas (`reservar.html`, `panel-v2.html`) cargan scripts clásicos desde
// Cloudflare Pages y las Edge Functions corren en Deno, que no puede cargar ese
// fichero. La alternativa —que cada lado resolviese "a su manera"— es justo el
// problema que este paso cierra.
//
// Que las dos coincidan NO se confía a la buena voluntad:
// `tests/modalidad-equivalencia.mjs` ejecuta LAS DOS con la misma batería de
// casos y falla si divergen en uno solo. Al tocar una, tocar la otra y correr
// esa prueba.
//
// LA REGLA:  usuarios.configuracion.video.proveedor  →  citas.video_proveedor
//
// La elección del coach es la ÚNICA entrada. No se consulta `zoom_url`, ni
// `meet_link`, ni `configuracion.gcal`, ni ninguna integración externa: mirar
// una integración para adivinar la modalidad es lo que hacía que un coach que
// solo había pegado su enlace de Zoom acabara mandándolo como si lo hubiera
// elegido.
//
// SIN ELECCIÓN → SALA. Deliberado. "No ha elegido" no es "eligió Zoom".

import type { ProveedorVideo } from './tipos.ts';

/** Las cuatro modalidades del contrato. No hay una quinta. */
export const PROVEEDORES: readonly ProveedorVideo[] = ['sala', 'meet', 'zoom', 'presencial'];

/** El valor seguro. Ver "SIN ELECCIÓN → SALA" arriba. */
export const POR_DEFECTO: ProveedorVideo = 'sala';

/**
 * La modalidad que eligió el coach.
 *
 * Total: cualquier entrada devuelve un proveedor válido. Ausente, malformada o
 * desconocida caen a `sala` — nunca lanza y nunca devuelve null, para que ningún
 * consumidor tenga que inventarse su propio respaldo (que es como nacieron las
 * cuatro cascadas).
 *
 * @param cfgVideo `usuarios.configuracion.video`, tal cual venga.
 */
export function modalidadElegida(cfgVideo: unknown): ProveedorVideo {
  if (!cfgVideo || typeof cfgVideo !== 'object' || Array.isArray(cfgVideo)) return POR_DEFECTO;
  const p = (cfgVideo as { proveedor?: unknown }).proveedor;
  if (typeof p !== 'string') return POR_DEFECTO;
  const clave = p.trim().toLowerCase();
  return (PROVEEDORES as readonly string[]).includes(clave)
    ? (clave as ProveedorVideo)
    : POR_DEFECTO;
}

/**
 * ¿Se puede CUMPLIR lo elegido?
 *
 * Pregunta distinta de «qué eligió», y por eso va aparte: Meet sin Google
 * conectado y Zoom sin URL utilizable no se sostienen, y ofrecerlos sería
 * prometer un enlace que no va a llegar. Cuando no se puede cumplir se atiende
 * en la Sala, que es el valor seguro.
 *
 * Recibe BOOLEANOS, no integraciones: quien llama declara lo que tiene. Así
 * esta regla sigue sin consultar `zoom_url`, `gcal` ni nada externo — que es
 * justo lo que la mantiene idéntica en el navegador y en el servidor.
 */
export function modalidadCumplible(
  proveedor: ProveedorVideo,
  capacidades: { gcal?: boolean; zoomUrl?: boolean } | null | undefined,
): ProveedorVideo {
  const c = capacidades || {};
  if (proveedor === 'meet' && !c.gcal) return POR_DEFECTO;
  if (proveedor === 'zoom' && !c.zoomUrl) return POR_DEFECTO;
  return proveedor;
}

/**
 * `citas.modalidad` derivada del proveedor. Las dos columnas no pueden
 * contradecirse: una cita presencial con `modalidad='online'` es exactamente el
 * tipo de fila que rompe el correo y el calendario.
 */
export function modalidadDeCita(proveedor: ProveedorVideo): 'presencial' | 'online' {
  return proveedor === 'presencial' ? 'presencial' : 'online';
}

/** El lugar, solo si la sesión es presencial. */
export function lugarElegido(cfgVideo: unknown): string {
  if (modalidadElegida(cfgVideo) !== 'presencial') return '';
  const l = (cfgVideo as { lugar?: unknown } | null)?.lugar;
  return typeof l === 'string' ? l.trim() : '';
}
