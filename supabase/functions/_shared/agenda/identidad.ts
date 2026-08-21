// identidad.ts — resuelve auth.uid() → usuario → org_id → alcance.
//
// POR QUÉ ESTÁ SEPARADO DE LA E/S: la decisión es pura y la consulta no. Así se
// puede probar cada rama sin base de datos, y —más importante— existe UN SOLO
// sitio donde vive la regla. Copiarla en cinco Edge Functions es exactamente
// como nacieron INC-009, INC-010 e INC-018.
//
// HECHOS MEDIDOS EN PRODUCCIÓN (2026-08-21, Fase 0):
//   · 0 de 80 usuarios tienen auth_id = id → comparar auth.uid() contra
//     usuarios.id no casa NUNCA. Las policies desplegadas hacen justo eso.
//   · 22 de 80 tienen auth_id NULL (27,5 %) → el respaldo por correo no es
//     opcional. INC-018, R-24.
//   · usuarios.auth_id es UNIQUE y hay índice único sobre LOWER(email)
//     → cada búsqueda devuelve 0 o 1 fila. La rama 'ambiguo' es defensiva.
//
// LO QUE ESTA FUNCIÓN NO HACE, A PROPÓSITO:
//   · No escribe `usuarios.auth_id` (curado perezoso). Eso toca la tabla de
//     identidad y está fuera de alcance en esta fase.
//   · No mira `rol_en_org`: relleno en 3 de 80 filas, no autoriza nada.

import type { FilaUsuario, Identidad, Jwt, Rol } from './tipos.ts';

/** Usuario tal como lo devuelve `GET /auth/v1/user` de Supabase Auth. */
export interface UsuarioAuth {
  id?: string | null;
  email?: string | null;
  email_confirmed_at?: string | null;
  confirmed_at?: string | null;
  user_metadata?: { email_verified?: boolean } | null;
}

/**
 * Traduce la respuesta de Auth al contrato interno.
 *
 * POR QUÉ NO SE DESCODIFICA EL JWT A MANO: Pathway despliega sus 78 funciones
 * con `--no-verify-jwt` —está en la cabecera de su workflow: «cada función se
 * autoriza sola por dentro»—. Con esa convención, leer el payload en base64 sin
 * comprobar la firma acepta CUALQUIER token fabricado: bastaría poner el `sub`
 * de otra persona para leer la agenda de su organización.
 *
 * Así que la identidad se resuelve preguntándole a Auth con el token recibido,
 * que es además lo que prescribe nuestra propia ARQUITECTURA.md.
 *
 * `email_verified` sale de que Auth confirme el correo. GoTrue lo expone como
 * `email_confirmed_at`; se aceptan las tres formas porque varían con la versión.
 */
export function identidadDeAuth(u: UsuarioAuth | null | undefined): Jwt | null {
  if (!u || !u.id) return null;
  const verificado = !!(u.email_confirmed_at || u.confirmed_at || u.user_metadata?.email_verified);
  return { sub: String(u.id), email: u.email ?? null, email_verified: verificado };
}

/** Roles que mandan sobre toda la organización.
 *
 *  `admin` va incluido y no es un descuido: el owner real de «Mi Empresa»
 *  tiene `rol='admin'` (INC-014, R-15), y las policies desplegadas de `citas`
 *  ya aceptan los dos. Excluirlo dejaría fuera al dueño operativo. */
const ROLES_DE_ORGANIZACION: ReadonlySet<Rol> = new Set(['owner', 'admin']);

export function esRolDeOrganizacion(rol: Rol): boolean {
  return ROLES_DE_ORGANIZACION.has(rol);
}

/**
 * Decide la identidad a partir del JWT y del resultado de las dos búsquedas.
 *
 * Quien llama hace la E/S y le pasa las filas. Esta función no consulta nada.
 *
 * @param jwt        Contenido del JWT YA VERIFICADO. `sub` es `auth.uid()`.
 * @param porAuthId  Filas de `usuarios WHERE auth_id = jwt.sub`.
 * @param porEmail   Filas de `usuarios WHERE LOWER(email) = LOWER(jwt.email)`.
 *                   `null` si no se llegó a consultar (no hizo falta).
 */
export function resolverIdentidad(
  jwt: Jwt | null | undefined,
  porAuthId: readonly FilaUsuario[],
  porEmail: readonly FilaUsuario[] | null,
): Identidad {
  if (!jwt || !jwt.sub) return { ok: false, motivo: 'sin_jwt' };

  if (porAuthId.length > 1) return { ok: false, motivo: 'ambiguo' };
  if (porAuthId.length === 1) return desdeFila(porAuthId[0], 'auth_id');

  // Sin auth_id: es el 27,5 % de los usuarios. Se resuelve por correo, PERO
  // solo si el proveedor confirma que ese correo es suyo. Sin esta condición,
  // registrarse con el correo de otra persona hereda su organización y su rol.
  if (!jwt.email || !jwt.email_verified) {
    return { ok: false, motivo: 'email_no_verificado' };
  }

  const filas = porEmail ?? [];
  if (filas.length > 1) return { ok: false, motivo: 'ambiguo' };
  if (filas.length === 1) return desdeFila(filas[0], 'email');

  return { ok: false, motivo: 'no_encontrado' };
}

function desdeFila(u: FilaUsuario, via: 'auth_id' | 'email'): Identidad {
  // Dar de baja a alguien tiene que cerrarle la puerta. Hoy el handoff no lo
  // comprueba (S3, en PENDIENTES) y por eso un usuario inactivo sigue entrando.
  // Aquí sí se comprueba: es autorización de una función nueva, no Auth.
  // `undefined`/`null` = activo, porque la columna puede faltar en filas viejas
  // y negar por omisión dejaría fuera a coaches reales.
  if (u.activo === false) return { ok: false, motivo: 'inactivo' };

  const alcance = esRolDeOrganizacion(u.rol) && u.org_id ? 'org' : 'propio';
  return { ok: true, usuarioId: u.id, orgId: u.org_id, rol: u.rol, alcance, via };
}

/**
 * Deja solo las filas cuyo correo coincide EXACTAMENTE, sin distinguir
 * mayúsculas.
 *
 * POR QUÉ HACE FALTA: el respaldo por correo consulta con
 * `email=ilike.<valor>`, y PostgREST **no escapa `_`**, que en SQL LIKE es un
 * comodín de un carácter. Un correo como `mi_correo@x.com` también casaría con
 * `miXcorreo@x.com`. Si el usuario real no estuviera por ese correo pero otro sí
 * casara el comodín, se resolvería a LA PERSONA EQUIVOCADA y se le entregaría su
 * organización.
 *
 * El `ilike` acota; esto confirma. Barato y sin depender de cómo escape el
 * cliente HTTP.
 */
export function soloCorreoExacto(
  filas: readonly FilaUsuario[],
  correo: string,
): FilaUsuario[] {
  const buscado = correo.trim().toLowerCase();
  if (!buscado) return [];
  return filas.filter((u) => (u.email ?? '').trim().toLowerCase() === buscado);
}

/** Filtro de lectura que corresponde a una identidad ya resuelta.
 *
 *  Lo devuelve el servidor y NO lo negocia el cliente: si un coach pide el
 *  `coach_id` de un compañero, `coachId` sigue siendo el suyo. R-14. */
export interface FiltroLectura {
  alcance: 'org' | 'propio';
  /** Solo con alcance 'org'. */
  orgId: string | null;
  /** Solo con alcance 'propio'. */
  coachId: string | null;
  /** Con alcance 'propio' y organización, además ve los eventos grupales. */
  incluirGrupalesDeOrg: boolean;
}

export function filtroDeLectura(
  id: Extract<Identidad, { ok: true }>,
  coachPedido?: string | null,
): FiltroLectura {
  if (id.alcance === 'org') {
    return {
      alcance: 'org',
      orgId: id.orgId,
      // Filtrar por un coach concreto es una preferencia de vista y se respeta,
      // pero nunca amplía: sigue acotado a la organización.
      coachId: coachPedido && coachPedido !== 'todos' ? coachPedido : null,
      incluirGrupalesDeOrg: false,
    };
  }
  // Alcance propio: se IGNORA lo que pida el cliente.
  return {
    alcance: 'propio',
    orgId: id.orgId,
    coachId: id.usuarioId,
    incluirGrupalesDeOrg: !!id.orgId,
  };
}
