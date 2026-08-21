// video.ts — resolvedor común de videollamada.
//
// REGLA DE ARQUITECTURA: el frontend NO decide cómo se construye una URL de
// vídeo. Recibe { proveedor, url, estado } ya resuelto y solo lo pinta.
//
// Es lo que hoy no se cumple, y se nota:
//   · `reservar.html:936-957` resuelve bien — Zoom → Meet → Sala, con respaldo
//     garantizado. Es la implementación de referencia y de aquí sale esta.
//   · `panel-v2.html:_agResLink` devuelve "" desde julio de 2026 (DEPRECATED),
//     así que en la pestaña de Reservas NO se pinta ningún enlace de vídeo —
//     ni Sala ni Meet— y `meet_link` ni se consulta.
// Dos superficies, dos respuestas distintas a la misma pregunta. Con un
// resolvedor único eso deja de poder pasar.
//
// NO llama a Google. Resuelve con lo que ya está guardado en la fila más la
// configuración del coach. Crear el evento y obtener el `hangoutLink` es Fase 2.

import type { EstadoVideo, ProveedorVideo, Video } from './tipos.ts';

/** Origen público de la Sala. Se pasa como parámetro para no incrustar el
 *  dominio en la lógica y poder probarla sin depender de producción. */
export const ORIGEN_SALA_POR_DEFECTO = 'https://pathwaycareercoach.com';

export interface EntradaVideo {
  cita_id: number;
  coach_id: string;
  modalidad?: string | null;
  lugar?: string | null;
  /** El enlace efectivo ya guardado. Puede ser de Meet o de Zoom: el nombre de
   *  la columna miente un poco y renombrarla toca cinco superficies vivas. */
  meet_link?: string | null;
  video_proveedor?: string | null;
  gcal_estado?: string | null;
  grupal?: boolean | null;
  /** `usuarios.configuracion.zoom_url` del coach, si lo tiene. */
  zoom_url?: string | null;
}

/**
 * URL de la Sala de Pathway. Determinista: no se almacena en ninguna parte.
 *
 * CAMBIO RESPECTO A LO QUE HAY HOY: el room se deriva de `cita_id`, no de
 * `inicio`. Hoy es `Pathway-<coach_id>-<epoch_ms_de_inicio>`
 * (`panel-v2.html:_agSalaUrl`, `reservar.html:908-912`), así que **al
 * reprogramar una cita el enlace cambia** y el que el cliente tiene en su
 * correo lleva a una sala vacía. Es el mismo error que P7: un identificador
 * que no sobrevive a un cambio.
 *
 * El momento de cambiarlo es AHORA y no más tarde: se ha medido que no existe
 * ni una sola cita futura en la tabla, así que no hay ningún correo pendiente
 * cuyo enlace se vaya a romper. Dentro de un mes, sí lo habría.
 */
export function urlSala(
  citaId: number,
  coachId: string,
  grupal = false,
  origen: string = ORIGEN_SALA_POR_DEFECTO,
): string {
  const room = `Pathway-${coachId}-${citaId}`;
  return `${origen}/sala.html?room=${encodeURIComponent(room)}${grupal ? '&grupal=1' : ''}`;
}

const esUrl = (v: unknown): v is string => typeof v === 'string' && /^https?:\/\//i.test(v);

const PROVEEDORES: ReadonlySet<string> = new Set(['meet', 'sala', 'zoom', 'presencial']);

/**
 * Resuelve el vídeo de una cita. Orden deliberado:
 *
 *   1. `modalidad = 'presencial'` → no hay vídeo, y no es un fallo.
 *   2. Un enlace YA GUARDADO gana sobre todo lo demás. Es el que el cliente
 *      recibió por correo; sustituirlo lo mandaría a una sala distinta de la
 *      que tiene delante.
 *   3. El Zoom propio del coach, si lo tiene configurado.
 *   4. La Sala de Pathway, que es el respaldo que no puede fallar: no depende
 *      de Google, ni del token del coach, ni de la red hacia un tercero.
 *
 * El punto 2 es la única diferencia con `reservar.html`, y es intencionada:
 * allí se resuelve ANTES de que exista ningún enlace guardado, así que Zoom va
 * primero sin contradecir nada.
 */
export function resolverVideo(
  e: EntradaVideo,
  origenSala: string = ORIGEN_SALA_POR_DEFECTO,
): Video {
  if (e.modalidad === 'presencial') {
    return { proveedor: 'presencial', url: null, estado: 'no_aplica' };
  }

  if (esUrl(e.meet_link)) {
    const declarado = e.video_proveedor && PROVEEDORES.has(e.video_proveedor)
      ? (e.video_proveedor as ProveedorVideo)
      : null;
    // Sin `video_proveedor` se asume Meet: es quien escribe `meet_link` hoy
    // (`sync-cita-to-gcal:87-93`) y la columna se llama así por eso.
    return { proveedor: declarado ?? 'meet', url: e.meet_link, estado: 'ok' };
  }

  if (esUrl(e.zoom_url)) {
    return { proveedor: 'zoom', url: e.zoom_url, estado: 'ok' };
  }

  // Sin enlace guardado y sin Zoom. Si Google quedó pendiente o sin conexión,
  // se dice — pero igualmente se entrega la Sala, para que nadie se quede sin
  // sitio al que entrar.
  const estado: EstadoVideo = e.gcal_estado === 'sin_conexion'
    ? 'sin_conexion'
    : e.gcal_estado === 'pendiente'
      ? 'pendiente'
      : 'ok';

  return {
    proveedor: 'sala',
    url: urlSala(e.cita_id, e.coach_id, e.grupal === true, origenSala),
    estado,
  };
}
