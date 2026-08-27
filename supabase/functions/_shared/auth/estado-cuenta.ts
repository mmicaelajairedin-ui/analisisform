// ===================================================================
// estado-cuenta.ts — ¿este email está libre, invitado, o ya provisionado?
//
// RC-14 (toma de control de cuenta vía `registrar-coach`).
//
// EL BUG QUE CIERRA ESTE MÓDULO
// -----------------------------
// `registrar-coach` es pública por diseño: quien se registra todavía no tiene
// cuenta, así que no puede presentar sesión. Su único guard era:
//
//     if (existing && existing.password_hash) → 409 email_taken
//
// es decir, usaba `password_hash IS NULL` como sinónimo de "fila invitada,
// actívala". Pero `migrate-user-to-auth` PONE `password_hash = null` al migrar
// a Supabase Auth (`clearLegacyHash`). Desde ese momento una cuenta REAL y en
// uso es indistinguible de una invitación pendiente.
//
// Cadena de toma de control que eso habilitaba:
//   1. El atacante llama a `registrar-coach` con el email de la víctima y un
//      `password_hash` suyo.
//   2. El guard no dispara (password_hash es null) → la fila se sobrescribe.
//   3. El atacante entra por login.html: signInWithPassword falla (la
//      contraseña de Auth no cambió).
//   4. login.html cae a `migrate-user-to-auth` con el plaintext del atacante:
//      su SHA-256 coincide con el hash recién plantado → verificación OK.
//   5. `migrate-user-to-auth` hace PUT /auth/v1/admin/users/<id> con esa
//      contraseña → la credencial de Auth queda bajo control del atacante.
//
// POR QUÉ NO ALCANZA CON MIRAR `auth_id`
// --------------------------------------
// El paso 5 solo necesita que exista una identidad de Auth con ese email. La
// fila de `usuarios` puede estar en tres estados distintos y los tres llevan al
// mismo sitio:
//
//   A. password_hash NULL + auth_id presente   → rama de activación
//   B. password_hash NULL + auth_id NULL, pero SÍ hay auth.users con ese email
//      (p. ej. alta por Google que todavía no enlazó auth_id) → rama de activación
//   C. no hay fila en `usuarios` en absoluto, pero SÍ hay auth.users con ese
//      email (alta por OAuth que nunca creó fila) → rama de alta nueva
//
// Cerrar solo A deja B y C abiertas — misma cadena, distinto discriminante. Por
// eso la señal correcta NO es la forma de la fila, sino: **¿ya existe una
// identidad de Auth para este email?** Si existe, el email está tomado, venga
// de donde venga.
//
// LA REGLA
// --------
//   'provisionada' → hay credencial (hash propio, auth_id, o identidad de Auth).
//                    Nadie puede reclamar este email desde el registro público.
//   'invitada'     → fila creada por un alta privilegiada (crear-coach,
//                    agregar-coach-red…), sin contraseña, sin auth_id y sin
//                    identidad de Auth. La persona invitada puede activarla.
//   'libre'        → no existe nada con ese email. Alta nueva.
//
// El parámetro `existeEnAuth` lo resuelve quien llama contra el admin API de
// GoTrue, y DEBE fallar cerrado: si no se puede consultar, no se activa nada.
// Ver `registrar-coach/index.ts`.
//
// Puro y sin dependencias a propósito: `tests/rc14-estado-cuenta.mjs` lo importa
// tal cual desde node y verifica las tres rutas sin tocar red ni producción.
// ===================================================================

/** Fila de `usuarios` en lo que importa para decidir si el email está tomado. */
export interface FilaCuenta {
  password_hash?: string | null;
  auth_id?: string | null;
}

/**
 * 'libre'         → se puede crear la cuenta.
 * 'invitada'      → se puede activar la fila existente.
 * 'provisionada'  → el email ya tiene dueño; el registro público debe rechazarlo.
 */
export type EstadoCuenta = "libre" | "invitada" | "provisionada";

/**
 * Decide el estado de un email para el registro PÚBLICO.
 *
 * @param fila         fila de `usuarios` con ese email, o null/undefined si no hay.
 * @param existeEnAuth si ya hay una identidad en auth.users con ese email.
 *
 * Cualquiera de las tres señales de credencial marca 'provisionada'. Se
 * evalúan en orden de coste, pero el resultado no depende del orden.
 */
export function estadoCuenta(
  fila: FilaCuenta | null | undefined,
  existeEnAuth: boolean,
): EstadoCuenta {
  // Ruta C: sin fila en `usuarios` pero con identidad de Auth. Crear la fila
  // aquí dejaría plantar un password_hash que `migrate-user-to-auth` aceptaría
  // como prueba de identidad sobre esa cuenta de Auth.
  if (!fila) return existeEnAuth ? "provisionada" : "libre";

  // Guard original: la cuenta tiene contraseña propia en la tabla vieja.
  if (fila.password_hash) return "provisionada";

  // Ruta A: ya migrada a Auth — `clearLegacyHash` vació el hash, pero la cuenta
  // está viva y enlazada.
  if (fila.auth_id) return "provisionada";

  // Ruta B: auth_id todavía sin enlazar, pero la identidad de Auth ya existe.
  if (existeEnAuth) return "provisionada";

  // Invitación legítima: la creó un alta privilegiada y nadie la activó aún.
  return "invitada";
}

/** ¿Este estado permite que el registro público escriba sobre el email? */
export function puedeReclamarse(estado: EstadoCuenta): boolean {
  return estado !== "provisionada";
}
