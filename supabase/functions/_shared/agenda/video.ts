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
}

/**
 * URL de la Sala de Pathway. Determinista: no se almacena en ninguna parte.
 *
 * FÓRMULA CANÓNICA DE LA PLATAFORMA. El room se deriva de `cita_id`, no de
 * `inicio`, porque un identificador que cambia no sirve: con la hora, al
 * reprogramar cambiaba el enlace y el que el cliente tenía en su correo
 * llevaba a una sala vacía. Es el mismo error que P7.
 *
 * Desde agosto de 2026 la usan también `reservar.html::_salaUrlDe`,
 * `panel-v2.html::_agSalaUrl` / `::_salaClientLink` y `recordatorios-citas`.
 * Antes cada una derivaba del `inicio`, así que `agenda-list` devolvía una
 * sala distinta de la que iba en el correo. Si aparece una quinta copia de
 * esta cadena en otro sitio, es un error: debe salir de aquí.
 *
 * Se unificó cuando no había ninguna cita futura con enlace de Sala ya
 * enviado, así que ningún correo pendiente se rompió.
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
 *   3. La Sala de Pathway, que es el respaldo que no puede fallar: no depende
 *      de Google, ni del token del coach, ni de la red hacia un tercero.
 *
 * ESTA FUNCIÓN NO ELIGE MODALIDAD. Lee la que ya se decidió al crear la cita
 * (`video_proveedor`, que sale de `modalidad.ts` a partir de
 * `usuarios.configuracion.video`) y resuelve el ENLACE que le corresponde.
 * Volver a elegir aquí es lo que hacía que la agenda contradijera al correo.
 *
 * Tenía un paso 3 que caía a `zoom_url` cuando no había enlace guardado. Se
 * quitó por dos motivos: el contrato dice que sin elección la modalidad es
 * Sala, nunca Zoom; y la rama estaba muerta desde siempre, porque
 * `consulta.ts` nunca le pasó `zoom_url`.
 */
export function resolverVideo(
  e: EntradaVideo,
  origenSala: string = ORIGEN_SALA_POR_DEFECTO,
): Video {
  if (e.modalidad === 'presencial') {
    // El lugar viaja con el resto: es el "enlace" de una sesión presencial.
    return { proveedor: 'presencial', url: null, estado: 'no_aplica', lugar: String(e.lugar || '').trim() };
  }

  if (esUrl(e.meet_link)) {
    const declarado = e.video_proveedor && PROVEEDORES.has(e.video_proveedor)
      ? (e.video_proveedor as ProveedorVideo)
      : null;
    // Sin `video_proveedor` NO se adivina. Antes se asumía Meet —porque es quien
    // escribía `meet_link`— y eso etiquetaba como «Google Meet» citas de Sala y
    // de Zoom de antes del selector. El enlace guardado sí se sabe y se entrega;
    // el proveedor va `null`, que es lo que el tipo `Video` prevé para «hay
    // videollamada, no sé de quién». Adivinar es lo que estamos quitando.
    return { proveedor: declarado, url: e.meet_link, estado: 'ok', lugar: '' };
  }

  // Sin enlace guardado. Si Google quedó pendiente o sin conexión,
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
    lugar: '',
  };
}
