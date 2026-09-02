// tipos.ts — contrato compartido de Agenda Core.
//
// Lo consumen las Edge Functions de Pathway y, traducido, el adaptador de
// MultiCoach. Es la ÚNICA definición: si aquí no está, no viaja.
//
// Nada de este fichero importa Deno ni Node: son tipos y datos puros, para que
// las pruebas corran bajo Node sin andamio.

/** Rol global en `usuarios.rol`. No confundir con `rol_en_org`, que está
 *  relleno en 3 de 80 filas y no autoriza nada (medido el 2026-08-21). */
export type Rol = 'owner' | 'admin' | 'coach' | 'colaborador' | 'cliente' | 'empleado' | string;

/** Fila de `usuarios` reducida a lo que Agenda necesita para autorizar. */
export interface FilaUsuario {
  /** `usuarios.id` — NO es `auth.users.id`. Cadena de identidad: R-12, INC-010. */
  id: string;
  org_id: string | null;
  rol: Rol;
  /** Necesario para confirmar el respaldo por correo: el filtro `ilike` de
   *  PostgREST NO escapa `_`, que es comodín de LIKE. Ver `soloCorreoExacto`. */
  email?: string | null;
  /** `usuarios.activo`. Ausente se trata como activo: la columna es opcional
   *  en filas antiguas y negar por omisión dejaría fuera a coaches reales. */
  activo?: boolean | null;
}

/** Lo que viaja en el JWT verificado. `sub` es `auth.uid()`. */
export interface Jwt {
  sub: string;
  email?: string | null;
  /** Supabase lo emite en el JWT. Sin esto, el respaldo por correo es un
   *  vector de robo de cuenta: alguien registra el correo ajeno y hereda su
   *  organización y su rol. */
  email_verified?: boolean | null;
}

/** Alcance de lectura, decidido SIEMPRE en el servidor (R-14). */
export type Alcance = 'org' | 'propio';

export type MotivoRechazo =
  | 'sin_jwt'
  | 'email_no_verificado'
  | 'no_encontrado'
  | 'ambiguo'
  | 'inactivo';

export type Identidad =
  | {
      ok: true;
      usuarioId: string;
      orgId: string | null;
      rol: Rol;
      alcance: Alcance;
      /** Por dónde se resolvió. Sirve para medir cuántos siguen sin `auth_id`. */
      via: 'auth_id' | 'email';
    }
  | { ok: false; motivo: MotivoRechazo };

/** Estados reales de `citas.estado` en Pathway (citas.sql:16 + uso en panel). */
export type EstadoCita = 'pendiente' | 'confirmada' | 'completada' | 'cancelada' | string;

export type ProveedorVideo = 'meet' | 'sala' | 'zoom' | 'presencial';
export type EstadoVideo = 'ok' | 'pendiente' | 'sin_conexion' | 'no_aplica';

export interface Video {
  proveedor: ProveedorVideo | null;
  url: string | null;
  estado: EstadoVideo;
  /** Dónde es, solo en `presencial`. Vacío en el resto: una videollamada no
   *  tiene sitio. Sin este campo, `citas.lugar` se leía, se pasaba a
   *  `resolverVideo` y se tiraba ahí — así que una cita presencial llegaba a la
   *  Agenda y a MultiCoach sin dirección, y la pantalla no tenía qué pintar. */
  lugar: string;
}

/** Un evento tal como lo devuelve `agenda-list`. */
export interface EventoAgenda {
  /** Estable y derivado del `id` de la fila. Nunca `Math.random()` (P7). */
  id: string;
  cita_id: number;
  org_id: string | null;
  coach_id: string;
  coach_nombre: string;
  client_id: number | null;
  cliente_nombre: string | null;
  tipo: 'session' | 'availability';
  titulo: string;
  inicio: string;
  /** Siempre presente: si la fila no tiene `fin`, se deriva de la duración
   *  por defecto. Sin `fin` no hay solapes ni rejilla. */
  fin: string;
  estado: EstadoCita;
  grupal: boolean;
  video: Video;
}

/** `usuarios.configuracion` — el horario del coach vive aquí, no en una tabla.
 *  Verificado en `reservar.html:455-473` (`normDisp`). */
export interface ConfigCoach {
  /** Días laborables en convención JS: 0=domingo … 6=sábado.
   *  El defecto de Pathway es [1,2,3,4,5] = lunes a viernes. */
  days: number[];
  /** 'HH:MM' en la zona del coach. */
  from: string;
  to: string;
  /** Excepción por día: { "<weekday>": {from,to} }. Gana sobre from/to. */
  horarios: Record<string, { from: string; to: string }>;
  /** IANA. Vacío cae a 'Europe/Madrid', que es el defecto de Pathway. */
  tz: string;
  min_notice_h: number;
  buffer_min: number;
  /** Días completos bloqueados, 'YYYY-MM-DD' en la fecha del coach.
   *  ES EL ÚNICO MECANISMO DE BLOQUEO QUE HOY FUNCIONA. No se retira en
   *  esta fase: `huecosLibres` lo lee junto a `agenda_bloques`. */
  bloqueados: string[];
  /** Respaldo de vídeo propio del coach, si lo tiene configurado. */
  zoom_url?: string | null;
}

/** Un tramo ocupado, ya normalizado a epoch ms. Da igual de dónde venga:
 *  cita, bloqueo de `agenda_bloques`, o FreeBusy de Google. */
export interface Ocupado {
  inicio: number;
  fin: number;
  origen: 'cita' | 'bloque' | 'google';
}

export interface OpcionesHuecos {
  /** Ventana pedida, epoch ms. */
  desde: number;
  hasta: number;
  duracionMin: number;
  /** Inyectado, nunca `Date.now()` dentro: sin esto la función no es
   *  comprobable y las pruebas dependen del reloj. */
  ahora: number;
  /** Salto entre candidatos. Por defecto max(duracion, 15), igual que Pathway. */
  pasoMin?: number;
  /** Tope de días a recorrer. Protege de un rango absurdo. */
  maxDias?: number;
}

/** Config por defecto, idéntica a `normDisp(null)` de Pathway. */
export const CONFIG_POR_DEFECTO: ConfigCoach = {
  days: [1, 2, 3, 4, 5],
  from: '09:00',
  to: '18:00',
  horarios: {},
  tz: '',
  min_notice_h: 0,
  buffer_min: 0,
  bloqueados: [],
};

export const ZONA_POR_DEFECTO = 'Europe/Madrid';

/** Zona horaria derivada del pais que el coach elige en su perfil.
 *
 *  SEPTIEMBRE 2026 — `tz` es un campo avanzado (vive en
 *  `configuracion.disponibilidad.tz`) y NINGUN coach lo habia tocado, asi que
 *  todos caian en Europe/Madrid: a una coach de Costa Rica se le ofrecian sus
 *  09:00-18:00 *de Madrid*, o sea 01:00-10:00 suyas. El pais si lo elige todo
 *  el mundo al armar el perfil, asi que sale de ahi antes de asumir Madrid.
 *  Las claves son las mismas que ofrece el selector del panel (paisOpts). */
export const ZONA_POR_PAIS: Record<string, string> = {
  ES: 'Europe/Madrid',
  AR: 'America/Argentina/Buenos_Aires',
  MX: 'America/Mexico_City',
  CO: 'America/Bogota',
  CL: 'America/Santiago',
  UY: 'America/Montevideo',
  PE: 'America/Lima',
  VE: 'America/Caracas',
  EC: 'America/Guayaquil',
  CR: 'America/Costa_Rica',
  US: 'America/New_York',
};

/** Zona del coach: la que guardo > la de su pais > el defecto historico. */
export function zonaDeCoach(tz: unknown, pais: unknown): string {
  if (typeof tz === 'string' && tz.trim()) return tz.trim();
  const iso = String(pais ?? '').trim().toUpperCase();
  return ZONA_POR_PAIS[iso] || ZONA_POR_DEFECTO;
}

/** Duración de una cita cuando la fila no trae `fin`. Coincide con el defecto
 *  del alta de Pathway. */
export const DURACION_POR_DEFECTO_MIN = 60;
