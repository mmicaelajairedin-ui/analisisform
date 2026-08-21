// consulta.ts — construcción de la consulta de lectura y traducción de filas.
//
// POR QUÉ ESTÁ FUERA DE LA EDGE FUNCTION: aquí es donde vive el aislamiento
// entre organizaciones. Dejarlo incrustado entre `fetch` y `Deno.serve` lo hace
// imposible de probar sin desplegar, y es justo la parte que no puede fallar.
// Con esto, el requisito «un coach que pide la agenda de otro recibe la suya»
// se comprueba en un segundo y sin base de datos.

import { DURACION_POR_DEFECTO_MIN, type EstadoCita, type EventoAgenda } from './tipos.ts';
import type { FiltroLectura } from './identidad.ts';
import { resolverVideo, ORIGEN_SALA_POR_DEFECTO } from './video.ts';

/** Columnas que la agenda necesita, y solo esas.
 *
 *  Fuera a propósito: `email`, `telefono`, `respuestas` y `notas_llamada`.
 *  `citas` guarda datos personales (INC-025) y una agenda no los necesita para
 *  pintar una semana. Lo que no se pide no se puede filtrar por accidente. */
export const COLUMNAS_AGENDA =
  'id,org_id,coach_id,client_id,nombre,tipo,inicio,fin,estado,grupal,modalidad,lugar,meet_link,video_proveedor,gcal_estado';

export interface OpcionesConsulta {
  desdeIso: string;
  hastaIso: string;
  incluirCanceladas?: boolean;
}

/**
 * Query string de PostgREST para un filtro ya resuelto por el servidor.
 *
 * Devuelve `null` cuando el alcance no puede producir resultados —alcance de
 * organización sin organización—, para que quien llama devuelva lista vacía en
 * vez de lanzar una consulta sin filtro. Una consulta sin `WHERE` sobre `citas`
 * con `service_role` devolvería la tabla entera: ese es exactamente el fallo
 * que no puede ocurrir.
 */
export function construirConsulta(f: FiltroLectura, opts: OpcionesConsulta): string | null {
  let ambito: string;

  if (f.alcance === 'org') {
    if (!f.orgId) return null;
    ambito = `org_id=eq.${encodeURIComponent(f.orgId)}`;
    // Filtrar por un coach concreto es preferencia de vista: acota, nunca amplía.
    if (f.coachId) ambito += `&coach_id=eq.${encodeURIComponent(f.coachId)}`;
  } else {
    if (!f.coachId) return null;
    const propio = `coach_id.eq.${encodeURIComponent(f.coachId)}`;
    ambito = f.incluirGrupalesDeOrg && f.orgId
      // Lo suyo, más los eventos grupales de su organización.
      ? `or=(${propio},and(org_id.eq.${encodeURIComponent(f.orgId)},grupal.is.true))`
      : `coach_id=eq.${encodeURIComponent(f.coachId)}`;
  }

  // El rango acota por `inicio`, así que una fila con `inicio` NULL no casa
  // ninguna comparación y queda fuera por construcción. Es lo que mantiene la
  // cita 71 —confirmada y sin hora— fuera de la agenda sin borrarla.
  const rango =
    `inicio=gte.${encodeURIComponent(opts.desdeIso)}&inicio=lte.${encodeURIComponent(opts.hastaIso)}`;
  const canceladas = opts.incluirCanceladas ? '' : '&estado=neq.cancelada';

  return `${ambito}&${rango}${canceladas}&select=${COLUMNAS_AGENDA}&order=inicio.asc`;
}

export interface FilaCita {
  id: number | string;
  org_id?: string | null;
  coach_id?: string | null;
  client_id?: number | null;
  nombre?: string | null;
  tipo?: string | null;
  inicio: string;
  fin?: string | null;
  estado?: EstadoCita | null;
  grupal?: boolean | null;
  modalidad?: string | null;
  lugar?: string | null;
  meet_link?: string | null;
  video_proveedor?: string | null;
  gcal_estado?: string | null;
}

/**
 * Fila de `citas` → `EventoAgenda`.
 *
 * `fin` SIEMPRE sale con valor: si la fila no lo trae —y ninguna de las 64
 * actuales lo trae, porque la columna la añade M1— se deriva de la duración por
 * defecto. Sin `fin` no hay rejilla ni detección de solapes.
 *
 * Lo que NO se hace: rellenar `fin` en la base para el histórico. La duración
 * real de esas citas no está guardada en ninguna parte, así que escribirla
 * sería inventar el dato que falta. Se deriva al leer, donde es una suposición
 * visible y reversible, y no un valor que parece un hecho.
 */
export function traducirEvento(
  c: FilaCita,
  nombreCoach: string,
  origenSala: string = ORIGEN_SALA_POR_DEFECTO,
): EventoAgenda {
  const citaId = Number(c.id);
  const coachId = String(c.coach_id ?? '');
  const inicio = String(c.inicio);
  const finMs = new Date(inicio).getTime() + DURACION_POR_DEFECTO_MIN * 60_000;

  return {
    // Estable y derivado del id de la fila. Nunca `Math.random()` (P7): sin un
    // identificador estable no se puede editar ni cancelar desde la agenda.
    id: `citas:${citaId}`,
    cita_id: citaId,
    org_id: c.org_id ?? null,
    coach_id: coachId,
    coach_nombre: nombreCoach || '—',
    client_id: c.client_id ?? null,
    cliente_nombre: c.nombre ?? null,
    tipo: 'session',
    titulo: c.tipo || 'Sesión',
    inicio,
    fin: c.fin ? String(c.fin) : new Date(finMs).toISOString(),
    estado: c.estado ?? 'pendiente',
    grupal: c.grupal === true,
    video: resolverVideo(
      {
        cita_id: citaId,
        coach_id: coachId,
        modalidad: c.modalidad,
        lugar: c.lugar,
        meet_link: c.meet_link,
        video_proveedor: c.video_proveedor,
        gcal_estado: c.gcal_estado,
        grupal: c.grupal,
      },
      origenSala,
    ),
  };
}
