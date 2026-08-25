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

/** Etiqueta del botón, por proveedor. Presencial no tiene: no es que falte, es
 *  que no hay videollamada. Gemelo de `ETIQUETA` en `pw-modalidad.js`. */
export const ETIQUETA: Record<string, string> = {
  meet: 'Entrar a Google Meet',
  sala: 'Entrar a la Sala de Pathway',
  zoom: 'Entrar a la videollamada',
};

/**
 * El vídeo de UNA CITA YA CREADA: qué proveedor, qué enlace y cómo se llama el
 * botón. Todo sale de la fila; nada se vuelve a decidir.
 *
 * Vive aquí y no repetido en cada superficie porque la etiqueta se derivaba del
 * ENLACE en cuatro sitios distintos, y por eso una cita de Sala o de Zoom decía
 * «Entrar a Google Meet». El enlace no dice de quién es; el proveedor sí.
 *
 * NO consulta `zoom_url`, ni `gcal`, ni `configuracion.video`: la cita ya tiene
 * su decisión tomada y reconstruirla sería inventarse otra.
 */
export function videoDeCita(
  cita: { video_proveedor?: string | null; meet_link?: string | null; modalidad?: string | null } | null | undefined,
): { proveedor: string | null; url: string; etiqueta: string } {
  const prov = String((cita && cita.video_proveedor) || '').trim().toLowerCase();
  // `modalidad` vale de respaldo para las citas anteriores al proveedor.
  if (prov === 'presencial' || (cita && cita.modalidad === 'presencial')) {
    return { proveedor: 'presencial', url: '', etiqueta: '' };
  }
  const url = String((cita && cita.meet_link) || '').trim();
  if (!/^https?:\/\//i.test(url)) return { proveedor: prov || null, url: '', etiqueta: '' };
  // Con enlace pero sin proveedor declarado —citas viejas— hay videollamada y no
  // se sabe de quién: se dice eso, en vez de atribuírsela a Google.
  return { proveedor: prov || null, url, etiqueta: ETIQUETA[prov] || 'Entrar a la videollamada' };
}

/**
 * ¿Esta URL es una SALA de Zoom a la que se puede entrar?
 *
 * Existe porque `zoom_url` aceptaba casi cualquier cosa —la comprobación era
 * `if(url.indexOf("zoom.us")<0 && url.indexOf("http")<0) rechazar`, un `&&`, así
 * que bastaba con UNA de las dos— y por ahí entró un enlace de CHAT
 * (`/launch/chat`) que se envió a clientes como si fuera la videollamada.
 *
 * Se aceptan las tres formas que abren una reunión: `/j/<id>`, `/w/<id>` y
 * `/my/<slug>`. Se rechaza `/s/<id>` a propósito aunque sea de Zoom: es el
 * enlace de ANFITRIÓN, y compartirlo deja que cualquiera empiece la reunión.
 *
 * Gemelo de `zoomEsSala` en `pw-modalidad.js`.
 */
export function zoomEsSala(url: unknown): boolean {
  const u = String(url == null ? '' : url).trim();
  if (!/^https:\/\//i.test(u)) return false;
  const m = u.match(/^https:\/\/([^/?#]+)(\/[^?#]*)?/i);
  if (!m) return false;
  const host = m[1].toLowerCase().replace(/:\d+$/, '');
  if (!/(^|\.)zoom\.us$/.test(host) && !/(^|\.)zoomgov\.com$/.test(host)) return false;
  const ruta = m[2] || '';
  return /^\/(j|w)\/\d{6,}/.test(ruta) || /^\/my\/[A-Za-z0-9._-]+/.test(ruta);
}

/** El lugar, solo si la sesión es presencial. */
export function lugarElegido(cfgVideo: unknown): string {
  if (modalidadElegida(cfgVideo) !== 'presencial') return '';
  const l = (cfgVideo as { lugar?: unknown } | null)?.lugar;
  return typeof l === 'string' ? l.trim() : '';
}
