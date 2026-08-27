/* RC-14 — el registro público no puede reclamar un email que ya tiene dueño.
 *
 * QUÉ PROTEGE
 * -----------
 * `registrar-coach` es pública (quien se registra aún no tiene sesión). Su guard
 * de "email ya tomado" era `password_hash IS NULL → es una invitación, actívala`.
 * Pero `migrate-user-to-auth` vacía `password_hash` al migrar a Supabase Auth,
 * así que una cuenta viva quedaba indistinguible de una invitación pendiente.
 *
 * Cadena de toma de control que eso abría:
 *   1. POST registrar-coach con el email de la víctima + un password_hash propio
 *   2. el guard no dispara → la fila se sobrescribe con ese hash
 *   3. login.html: signInWithPassword falla (la pass de Auth no cambió)
 *   4. login.html cae a migrate-user-to-auth con el plaintext del atacante
 *   5. el hash coincide con el recién plantado → PUT /auth/v1/admin/users/<id>
 *      → la credencial de Auth queda bajo control del atacante
 *
 * El paso 2 es el único eslabón escribible sin credenciales. Esta prueba
 * demuestra que ya no se puede dar, por las TRES formas en que la víctima puede
 * estar representada en la base.
 *
 * Correr:  node --experimental-strip-types tests/rc14-registro-guard.mjs
 */
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';

const RAIZ = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const MOD = path.join(RAIZ, 'supabase/functions/_shared/auth/estado-cuenta.ts');
const FN = path.join(RAIZ, 'supabase/functions/registrar-coach/index.ts');

const { estadoCuenta, puedeReclamarse } = await import(MOD);

let fallos = 0;
const linea = (t, ok, extra = '') => {
  if (!ok) fallos++;
  console.log(`  ${ok ? 'PASS ' : 'FALLA'}  ${t.padEnd(58)} ${extra}`);
};

/* ─────────────────────────────────────────────────────────────────────────
 * 1. NEGATIVOS — cuentas ya provisionadas. Ninguna puede reclamarse.
 *    Los tres estados corresponden a las tres rutas de toma de control.
 * ───────────────────────────────────────────────────────────────────────── */
console.log('\n1 · NEGATIVOS — el email ya tiene dueño (no se puede reclamar)');

const NEGATIVOS = [
  // Ruta A — la diagnosticada: migrada a Auth, hash vaciado por clearLegacyHash.
  ['A · migrada a Auth (hash null + auth_id)', { password_hash: null, auth_id: 'auth-uuid' }, false],
  // Ruta B — auth_id todavía sin enlazar, pero la identidad de Auth ya existe.
  ['B · auth_id sin enlazar + existe en Auth', { password_hash: null, auth_id: null }, true],
  // Ruta C — ni siquiera hay fila en usuarios, pero sí identidad de Auth.
  ['C · sin fila en usuarios + existe en Auth', null, true],
  // Guard original (no debe romperse).
  ['cuenta legacy con contraseña propia', { password_hash: 'sha256...', auth_id: null }, false],
  ['legacy con contraseña + auth_id', { password_hash: 'sha256...', auth_id: 'auth-uuid' }, true],
  // Bordes: cadena vacía no es contraseña, pero auth_id sí cuenta.
  ['hash vacío pero con auth_id', { password_hash: '', auth_id: 'auth-uuid' }, false],
];

for (const [nombre, fila, enAuth] of NEGATIVOS) {
  const e = estadoCuenta(fila, enAuth);
  linea(nombre, e === 'provisionada' && !puedeReclamarse(e), `→ ${e}`);
}

/* ─────────────────────────────────────────────────────────────────────────
 * 2. POSITIVOS — invitación legítima y alta nueva siguen funcionando.
 *    Si esto se rompe, el fix habría cerrado el producto en vez del agujero.
 * ───────────────────────────────────────────────────────────────────────── */
console.log('\n2 · POSITIVOS — el flujo legítimo sigue abierto');

const POSITIVOS = [
  // Lo que crean crear-coach / agregar-coach-red / add-coach-to-org: fila sin
  // contraseña, sin auth_id y sin identidad de Auth todavía.
  ['invitación pendiente → activable', { password_hash: null, auth_id: null }, false, 'invitada'],
  ['invitación con hash vacío → activable', { password_hash: '', auth_id: null }, false, 'invitada'],
  ['invitación con auth_id vacío → activable', { password_hash: null, auth_id: '' }, false, 'invitada'],
  ['email totalmente nuevo → alta', null, false, 'libre'],
  ['undefined (sin fila) → alta', undefined, false, 'libre'],
];

for (const [nombre, fila, enAuth, esperado] of POSITIVOS) {
  const e = estadoCuenta(fila, enAuth);
  linea(nombre, e === esperado && puedeReclamarse(e), `→ ${e}`);
}

/* ─────────────────────────────────────────────────────────────────────────
 * 3. LA CADENA DE TOMA DE CONTROL — simulada de punta a punta.
 *    Modelamos los 5 pasos. El paso 2 (plantar el hash) es el único que un
 *    anónimo puede ejecutar; si se bloquea, la cadena nunca llega al paso 5.
 * ───────────────────────────────────────────────────────────────────────── */
console.log('\n3 · CADENA DE TOMA DE CONTROL — ¿puede el atacante plantar el hash?');

// Estados reales medidos en producción el 27-ago-2026 (solo lectura):
//   ruta A: 51 filas · ruta B: 0 filas (alcanzable) · ruta C: 21 identidades
const VICTIMAS = [
  ['coach migrado a Auth', { password_hash: null, auth_id: 'a1' }, false],
  ['owner migrado a Auth', { password_hash: null, auth_id: 'a2' }, false],
  ['cliente migrado a Auth', { password_hash: null, auth_id: 'a3' }, false],
  ['alta por Google sin auth_id enlazado', { password_hash: null, auth_id: null }, true],
  ['identidad de Auth sin fila en usuarios', null, true],
];

for (const [nombre, fila, enAuth] of VICTIMAS) {
  const puedePlantar = puedeReclamarse(estadoCuenta(fila, enAuth));
  // El paso 2 debe ser IMPOSIBLE → la cadena se corta antes del paso 5.
  linea(`paso 2 bloqueado · ${nombre}`, puedePlantar === false,
        puedePlantar ? '⚠ TOMA DE CONTROL POSIBLE' : 'cadena cortada');
}

/* ─────────────────────────────────────────────────────────────────────────
 * 4. CENTINELA DE REGRESIÓN — el predicado viejo no puede volver.
 *    Sin esto, un refactor podría reintroducir el bug y los tests de arriba
 *    seguirían pasando (prueban el módulo puro, no su uso).
 * ───────────────────────────────────────────────────────────────────────── */
console.log('\n4 · CENTINELA — registrar-coach usa el guard nuevo');

const src = fs.readFileSync(FN, 'utf8');

linea('importa estadoCuenta desde _shared/auth',
      /_shared\/auth\/estado-cuenta\.ts/.test(src) && /estadoCuenta\(/.test(src));

linea('NO decide con `existing.password_hash` a secas',
      !/if\s*\(\s*existing\s*&&\s*existing\.password_hash\s*\)/.test(src),
      'el guard viejo era exactamente eso');

linea('NO activa con `!existing.password_hash`',
      !/existing\s*&&\s*!\s*existing\.password_hash/.test(src),
      'esa condición era la rama de activación');

linea('la rama de activación exige estado invitada',
      /estado\s*===\s*"invitada"/.test(src));

linea('consulta la identidad de Auth antes de decidir',
      /identidadAuthExiste\s*\(\s*email\s*\)/.test(src));

linea('falla CERRADO si el admin API no responde',
      /auth_lookup_failed/.test(src) && /503/.test(src),
      'sin lookup no se reclama ningún email');

linea('pagina el admin API (no se queda en la 1ª página)',
      /AUTH_MAX_PAGES/.test(src) && /page=\$\{page\}/.test(src),
      'mirar solo 200 daría falso "no existe"');

linea('trae auth_id en el select de usuarios',
      /select=id,email,rol,nombre,activo,password_hash,auth_id,configuracion/.test(src));

/* ───────────────────────────────────────────────────────────────────────── */
console.log(`\n${fallos === 0 ? '✓ RC-14 OK — las tres rutas de toma de control quedan cerradas y el alta legítima sigue viva.' : `✗ ${fallos} fallo(s)`}\n`);
process.exit(fallos === 0 ? 0 : 1);
