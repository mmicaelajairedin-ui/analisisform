/* RC-12 — Workflow 01: el alta de coach termina en un estado usable.
 *
 * LOS DOS DEFECTOS QUE CIERRA
 * ---------------------------
 * 1. La ruta feliz pasaba por la ruta de error. `registro.html` intentaba
 *    primero un POST/PATCH anónimo contra `usuarios` con `rol='coach'`. Ninguna
 *    policy de INSERT lo admite, así que el 403 estaba garantizado y solo el
 *    `catch` llegaba a `registrar-coach`. Cualquier retoque en el manejo de
 *    códigos de estado tumbaba todas las altas.
 *
 * 2. El alta no dejaba identidad. `registrar-coach` creaba la fila de
 *    `usuarios` pero nunca la identidad de Auth: `auth_id` quedaba NULL hasta
 *    que la persona pasara por login.html. Y el alta redirige DIRECTO al panel,
 *    saltándose el login — así que la coach llegaba con `mj_user` en
 *    localStorage y SIN sesión de Auth. `PWAUTH.tokenSync()` devolvía null,
 *    todo caía a la anon key y `usuarios_self_update` (lower(email)=pw_email())
 *    no matcheaba ninguna fila: no podía guardar su perfil ni su configuración.
 *
 * LA CADENA QUE SE VERIFICA
 * -------------------------
 *   UI (registro) → registrar-coach → usuarios → Auth + auth_id
 *   → signInWithPassword → sesión → panel → persistencia
 *
 * Se comprueba de forma estática sobre el código: la ejecución real requiere
 * desplegar `registrar-coach` y escribir en producción, que no está autorizado.
 *
 * Correr:  node --experimental-strip-types tests/rc12-alta-coach.mjs
 */
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';

const RAIZ = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const leer = (f) => fs.readFileSync(path.join(RAIZ, f), 'utf8');

const FN = leer('supabase/functions/registrar-coach/index.ts');
const PAGINAS = [['registro.html', leer('registro.html')], ['registro-en.html', leer('registro-en.html')]];

let fallos = 0;
const linea = (t, ok, extra = '') => {
  if (!ok) fallos++;
  console.log(`  ${ok ? 'PASS ' : 'FALLA'}  ${t.padEnd(56)} ${extra}`);
};

/* ─────────────────────────────────────────────────────────────────────────
 * 1. UI → API — la llamada primaria, sin pasar por un 4xx
 * ───────────────────────────────────────────────────────────────────────── */
console.log('\n1 · UI → API — el alta llama a la function directamente');

for (const [nombre, src] of PAGINAS) {
  // El alta ya no escribe `usuarios` desde el navegador.
  linea(`${nombre}: no hay POST/PATCH anónimo a usuarios en el alta`,
        !/rest\/v1\/usuarios\?select=id,email,rol,nombre,activo,configuracion/.test(src) &&
        !/rest\/v1\/usuarios\?id=eq\.'\s*\+\s*encodeURIComponent\(activatingRow\.id\)/.test(src),
        'era el POST/PATCH que garantizaba el 403');

  linea(`${nombre}: llama a registrar-coach`, /functions\/v1\/registrar-coach/.test(src));

  // El fallback ya no puede ser el camino: no debe existir una rama que solo
  // llegue a la function desde un 401/403.
  linea(`${nombre}: la function NO cuelga de un 401/403`,
        !/res\.status\s*===\s*401\s*\|\|\s*res\.status\s*===\s*403/.test(src),
        'esa condición era la puerta al camino real');
}

/* ─────────────────────────────────────────────────────────────────────────
 * 2. API → DB → Auth — la function crea fila E identidad
 * ───────────────────────────────────────────────────────────────────────── */
console.log('\n2 · API → DB → Auth — la function deja identidad, no solo fila');

linea('acepta el plaintext solo para estrenar la identidad',
      /const password = \(body\.password \|\| ""\)\.toString\(\);/.test(FN));

linea('no persiste el plaintext en ningún sitio',
      !/password_hash:\s*password\b/.test(FN) && !/password:\s*password\s*[,}]\s*\)\s*;?\s*\/\/\s*persist/i.test(FN));

linea('crea la identidad de Auth (provisionarAuth)', /async function provisionarAuth\(/.test(FN));

linea('enlaza auth_id en la fila de usuarios',
      /body: JSON\.stringify\(\{ auth_id: authId \}\)/.test(FN));

linea('devuelve auth_id al cliente',
      (FN.match(/auth_id: authId/g) || []).length >= 2, 'en created y en activated');

// ── Frontera RC-14: esta function NUNCA puede sobrescribir credenciales ajenas.
// Se localizan TODOS los usos del admin API y se mira el método de cada uno.
// Sin `method:` explícito, fetch usa GET.
const metodosAdmin = [...FN.matchAll(/\/auth\/v1\/admin\/users/g)].map((m) => {
  const ventana = FN.slice(m.index, m.index + 260);
  return (ventana.match(/method:\s*"(\w+)"/) || [, 'GET'])[1];
});

// Guard del propio test: si no encuentra los call-sites, no está auditando nada.
// (identidadAuthExiste → GET paginado, provisionarAuth → POST crear)
linea('el test localiza los usos del admin API',
      metodosAdmin.length >= 2,
      `encontrados: ${metodosAdmin.length}`);

linea('solo usa POST/GET contra /auth/v1/admin/users',
      metodosAdmin.length >= 2 && metodosAdmin.every((m) => m === 'POST' || m === 'GET'),
      `métodos: ${metodosAdmin.join(', ') || '(ninguno)'}`);

linea('nunca PUT/PATCH sobre una identidad existente',
      metodosAdmin.length >= 2 && !metodosAdmin.includes('PUT') && !metodosAdmin.includes('PATCH'),
      'PUT sería sobrescribir la credencial de otro (RC-14)');

/* ─────────────────────────────────────────────────────────────────────────
 * 3. Respuesta → UI — sesión autenticada antes del panel
 * ───────────────────────────────────────────────────────────────────────── */
console.log('\n3 · respuesta → UI — sesión real antes de redirigir');

for (const [nombre, src] of PAGINAS) {
  linea(`${nombre}: abre sesión con signInWithPassword`,
        /signInWithPassword\(\{\s*email:\s*email,\s*password:\s*password\s*\}\)/.test(src));

  linea(`${nombre}: solo entra al panel si hay sesión`,
        /_authOk\s*\?\s*'panel-v2\.html\?welcome=1'/.test(src),
        'sin sesión el panel no puede escribir');

  linea(`${nombre}: sin sesión manda a login (ruta de reparación real)`,
        /_authOk[\s\S]{0,120}login(-en)?\.html\?email=/.test(src),
        'no es un fallback decorativo');

  linea(`${nombre}: mj_user guarda auth_id`,
        /auth_id:\s*coach\.auth_id\s*\|\|\s*null/.test(src));
}

/* ─────────────────────────────────────────────────────────────────────────
 * 4. NO-MOCKS — el cierre no puede apoyarse en datos inventados
 * ───────────────────────────────────────────────────────────────────────── */
console.log('\n4 · sin mocks ni fixtures en el camino del alta');

for (const [nombre, src] of PAGINAS) {
  const alta = src.slice(src.indexOf('RC-12 —'), src.indexOf('primerLogin'));
  linea(`${nombre}: el alta no fabrica un coach de mentira`,
        !/coach\s*=\s*\{/.test(alta) && !/MOCK|FAKE|dummy/i.test(alta));
}

linea('la function no inventa auth_id cuando falla',
      /if \(!r\.ok\) return null;/.test(FN) && !/authId\s*=\s*["'`]/.test(FN),
      'devuelve null y se degrada al camino de login');

/* ─────────────────────────────────────────────────────────────────────────
 * 5. REGRESIÓN — RC-14 sigue cerrado después de los cambios de RC-12
 * ───────────────────────────────────────────────────────────────────────── */
console.log('\n5 · regresión — RC-14 sigue en pie');

const { estadoCuenta } = await import(path.join(RAIZ, 'supabase/functions/_shared/auth/estado-cuenta.ts'));

linea('el guard de RC-14 sigue delante del alta',
      FN.indexOf('estadoCuenta(existing, existeEnAuth)') < FN.indexOf('provisionarAuth(email, password'),
      'primero se decide si el email tiene dueño');

linea('provisionarAuth es inalcanzable para un email con dueño',
      /if \(estado === "provisionada"\)[\s\S]{0,140}409/.test(FN));

for (const [n, fila, enAuth] of [
  ['ruta A · migrada a Auth', { password_hash: null, auth_id: 'a1' }, false],
  ['ruta B · Google sin enlazar', { password_hash: null, auth_id: null }, true],
  ['ruta C · Auth sin fila', null, true],
]) {
  linea(`${n} sigue rechazada`, estadoCuenta(fila, enAuth) === 'provisionada');
}

linea('la invitación legítima sigue activándose',
      estadoCuenta({ password_hash: null, auth_id: null }, false) === 'invitada');

/* ───────────────────────────────────────────────────────────────────────── */
console.log(`\n${fallos === 0 ? '✓ RC-12 OK — el alta llega a identidad, sesión y panel con persistencia; RC-14 intacto.' : `✗ ${fallos} fallo(s)`}\n`);
process.exit(fallos === 0 ? 0 : 1);
