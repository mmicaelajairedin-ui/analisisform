/* Prueba de equivalencia de la regla de modalidad.
 *
 * `pw-modalidad.js` (navegador) y `_shared/agenda/modalidad.ts` (Deno) son la
 * MISMA regla escrita dos veces, porque ninguna plataforma puede cargar el
 * fichero de la otra. Esta prueba es lo que convierte esa duplicación en algo
 * seguro: carga LAS DOS de verdad —no copias— y falla si difieren en un solo
 * caso.
 *
 * Correr:  node --experimental-strip-types tests/modalidad-equivalencia.mjs
 */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const RAIZ = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const JS = require(path.join(RAIZ, 'pw-modalidad.js'));
const TS = await import(path.join(RAIZ, 'supabase/functions/_shared/agenda/modalidad.ts'));

/* Los 8 casos del contrato, más los bordes que rompen una regex ingenua. */
const CASOS = [
  ['1 · meet',                       { proveedor: 'meet' },                     'meet'],
  ['2 · sala',                       { proveedor: 'sala' },                     'sala'],
  ['3 · zoom',                       { proveedor: 'zoom' },                     'zoom'],
  ['4 · presencial',                 { proveedor: 'presencial', lugar: 'C/ Mayor 1' }, 'presencial'],
  ['5 · video ausente (undefined)',  undefined,                                 'sala'],
  ['5 · video ausente (null)',       null,                                      'sala'],
  ['6 · proveedor desconocido',      { proveedor: 'skype' },                    'sala'],
  ['6 · proveedor vacío',            { proveedor: '' },                         'sala'],
  ['7 · malformado · cadena',        'meet',                                    'sala'],
  ['7 · malformado · array',         ['meet'],                                  'sala'],
  ['7 · malformado · número',        42,                                        'sala'],
  ['7 · malformado · objeto vacío',  {},                                        'sala'],
  ['7 · malformado · proveedor num', { proveedor: 1 },                          'sala'],
  ['7 · malformado · proveedor null',{ proveedor: null },                       'sala'],
  ['8 · zoom_url presente, video ausente', undefined,                           'sala'],
  ['borde · mayúsculas y espacios',  { proveedor: '  MEET ' },                  'meet'],
];

let fallos = 0;
const linea = (t, ok, extra) => {
  if (!ok) fallos++;
  console.log(`  ${ok ? 'PASS' : 'FALLA'}  ${t.padEnd(38)} ${extra}`);
};

console.log('\nLos 8 casos del contrato — y las dos implementaciones a la vez\n');
for (const [titulo, entrada, esperado] of CASOS) {
  const a = JS.modalidadElegida(entrada);
  const b = TS.modalidadElegida(entrada);
  linea(titulo, a === esperado && b === esperado && a === b, `js=${a} ts=${b} (esperado ${esperado})`);
}

/* El caso 8 merece su propia comprobación explícita: la regla NO puede mirar
 * `zoom_url` ni ninguna otra integración. Se le pasa una configuración entera
 * con todo lo que antes la habría desviado. */
console.log('\nCaso 8 en su forma real: la configuración completa de un coach\n');
const CFG_REAL = {
  zoom_url: 'https://us05web.zoom.us/launch/chat?src=direct_chat_link',
  gcal: { refresh_token: 'x', access_token: 'y' },
  disponibilidad: { days: [1, 2, 3, 4, 5], from: '09:00', to: '17:00' },
  // sin `video`
};
for (const [nombre, fn] of [['js', JS.modalidadElegida], ['ts', TS.modalidadElegida]]) {
  linea(`${nombre} · sin video, con zoom_url y gcal`, fn(CFG_REAL.video) === 'sala', `→ ${fn(CFG_REAL.video)}`);
}

/* Zoom explícito tiene que seguir funcionando: es una modalidad, no deuda. */
linea('zoom explícito sigue siendo zoom', JS.modalidadElegida({ proveedor: 'zoom' }) === 'zoom', '→ zoom');

/* `modalidad` no puede contradecir a `video_proveedor`. */
console.log('\n`citas.modalidad` derivada, nunca independiente\n');
for (const p of ['sala', 'meet', 'zoom', 'presencial']) {
  const a = JS.modalidadDeCita(p), b = TS.modalidadDeCita(p);
  const esperado = p === 'presencial' ? 'presencial' : 'online';
  linea(`modalidad de ${p}`, a === esperado && b === esperado, `→ ${a}`);
}

/* El lugar solo existe cuando la sesión es presencial. */
console.log('\n`lugar` solo en presencial\n');
const LUGARES = [
  [{ proveedor: 'presencial', lugar: '  C/ Mayor 1  ' }, 'C/ Mayor 1'],
  [{ proveedor: 'presencial' }, ''],
  [{ proveedor: 'meet', lugar: 'C/ Mayor 1' }, ''],
  [undefined, ''],
];
for (const [entrada, esperado] of LUGARES) {
  const a = JS.lugarElegido(entrada), b = TS.lugarElegido(entrada);
  linea(`lugar de ${JSON.stringify(entrada)}`.slice(0, 38), a === esperado && b === esperado, `→ ${JSON.stringify(a)}`);
}

/* Barrido: ninguna entrada, por rara que sea, puede salirse del contrato. */
console.log('\nBarrido: ninguna entrada se sale de las cuatro modalidades\n');
const RAROS = [0, -1, '', ' ', true, false, NaN, Infinity, [], {}, () => {}, Symbol.iterator,
  { proveedor: {} }, { proveedor: [] }, { proveedor: 'MEET' }, { proveedor: 'Presencial' },
  { PROVEEDOR: 'meet' }, { proveedor: ' zoom\n' }, new Date(), JSON, Math];
let barridoOk = true;
for (const r of RAROS) {
  let a, b;
  try { a = JS.modalidadElegida(r); } catch (e) { a = 'LANZÓ:' + e.message; }
  try { b = TS.modalidadElegida(r); } catch (e) { b = 'LANZÓ:' + e.message; }
  if (a !== b || !JS.PROVEEDORES.includes(a)) {
    barridoOk = false;
    console.log(`  FALLA  ${String(String(r)).slice(0, 30).padEnd(32)} js=${a} ts=${b}`);
  }
}
linea(`${RAROS.length} entradas hostiles`, barridoOk, 'ninguna lanza, ninguna se sale del contrato');

console.log(`\n${fallos === 0 ? '✓ Las dos implementaciones son la misma regla.' : `✗ ${fallos} divergencia(s).`}\n`);
process.exit(fallos === 0 ? 0 : 1);
