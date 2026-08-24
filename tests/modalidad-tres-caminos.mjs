/* Los tres caminos que crean una cita tienen que dar el MISMO proveedor.
 *
 * Antes daban tres respuestas distintas para la misma configuración:
 *   · reservar.html   respetaba `configuracion.video`… salvo que no existiera,
 *                     y entonces se iba a `zoom_url`.
 *   · panel-v2        no escribía `video_proveedor` en absoluto.
 *   · crear-cita-red  tampoco.
 *
 * Esta prueba extrae la decisión REAL de cada camino —el código tal cual está
 * en los ficheros, no una copia— y comprueba que las tres coinciden.
 *
 * Correr:  node --experimental-strip-types tests/modalidad-tres-caminos.mjs
 */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const RAIZ = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const leer = (p) => fs.readFileSync(path.join(RAIZ, p), 'utf8');

globalThis.PWModalidad = require(path.join(RAIZ, 'pw-modalidad.js'));
const TS = await import(path.join(RAIZ, 'supabase/functions/_shared/agenda/modalidad.ts'));

/** Extrae una función por nombre, contando llaves. Nada se reescribe a mano. */
function extraer(src, nombre) {
  const i = src.indexOf('function ' + nombre + '(');
  if (i < 0) throw new Error('no encontrada: ' + nombre);
  let n = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) {
    if (src[k] === '{') n++;
    else if (src[k] === '}' && --n === 0) return src.slice(i, k + 1);
  }
  throw new Error('no cierra: ' + nombre);
}

/* ── Camino 1 · reservar.html ─────────────────────────────────────────── */
const _videoPlan = new Function('CUR', 'PWModalidad',
  extraer(leer('reservar.html'), '_videoPlan') + '\nreturn _videoPlan();');
const camino1 = (cfg) => _videoPlan({ configuracion: cfg }, globalThis.PWModalidad).proveedor;

/* ── Camino 2 · panel-v2.html ─────────────────────────────────────────── */
/* La línea real del alta, extraída del fichero. `_vidProv` se compone de las
 * dos piezas reales del panel: la regla compartida + la normalización. */
const panel = leer('panel-v2.html');
const lineaAlta = panel.match(/var _aprov=\(_amod==="presencial"\).+?;/s);
if (!lineaAlta) throw new Error('no se encontró la línea de alta del panel');
const camino2 = (cfg, { modForm = 'online', gcalOk = true, zoomUrl = '' } = {}) => {
  const _vidNormalizar = new Function('p', '_vidGcalOk', '_vidZoomUrl',
    extraer(panel, '_vidNormalizar').replace(/^function _vidNormalizar\(p\)\{/, '') .replace(/\}$/, ''));
  const norm = (p) => _vidNormalizar(p, () => gcalOk, () => zoomUrl);
  const _vidProv = () => norm(globalThis.PWModalidad.modalidadElegida(cfg.video || {}));
  return new Function('_amod', '_vidProv', 'PWModalidad', lineaAlta[0] + '\nreturn _aprov;')(
    modForm, _vidProv, globalThis.PWModalidad);
};

/* ── Camino 3 · crear-cita-red ────────────────────────────────────────── */
/* Las tres líneas reales de la Edge Function. */
const red = leer('supabase/functions/crear-cita-red/index.ts');
const bloqueRed = red.match(/const proveedor: ProveedorVideo = body\.modalidad === "presencial"\s*\n\s*\? "presencial"\s*\n\s*: \(elegido === "presencial" \? "sala" : elegido\);/);
if (!bloqueRed) throw new Error('no se encontró el bloque de crear-cita-red');
const camino3 = (cfg, { modForm = 'online', gcalOk = true, zoomUrl = '' } = {}) => {
  const elegido = TS.modalidadCumplible(TS.modalidadElegida(cfg.video),
    { gcal: gcalOk, zoomUrl: /^https?:\/\//i.test(String(zoomUrl)) });
  const src = bloqueRed[0].replace(/: ProveedorVideo/, '').replace(/body\.modalidad/g, 'mod');
  return new Function('mod', 'elegido', src + '\nreturn proveedor;')(modForm, elegido);
};

/* ── La batería ───────────────────────────────────────────────────────── */
const ZOOM_SALA = 'https://us05web.zoom.us/j/1234567890';
const ZOOM_CHAT = 'https://us05web.zoom.us/launch/chat?src=direct_chat_link';

const CASOS = [
  ['video={proveedor:"meet"}',            { video: { proveedor: 'meet' } },                        {}, 'meet'],
  ['video={proveedor:"sala"}',            { video: { proveedor: 'sala' } },                        {}, 'sala'],
  ['video={proveedor:"zoom"} + URL sala', { video: { proveedor: 'zoom' }, zoom_url: ZOOM_SALA },   { zoomUrl: ZOOM_SALA }, 'zoom'],
  ['video={proveedor:"presencial"}',      { video: { proveedor: 'presencial', lugar: 'C/ Mayor 1' } }, { modForm: 'presencial' }, 'presencial'],
  ['video ausente',                       {},                                                      {}, 'sala'],
  ['proveedor desconocido',               { video: { proveedor: 'skype' } },                       {}, 'sala'],
  ['video malformado (cadena)',           { video: 'meet' },                                       {}, 'sala'],
  ['zoom_url presente, video AUSENTE',    { zoom_url: ZOOM_CHAT },                                 { zoomUrl: ZOOM_CHAT }, 'sala'],
];

let fallos = 0;
console.log('\nMisma configuración, tres caminos de alta\n');
console.log('  ' + 'caso'.padEnd(38) + 'reservar'.padEnd(13) + 'panel'.padEnd(13) + 'crear-cita-red'.padEnd(16) + 'esperado');
console.log('  ' + '─'.repeat(94));
for (const [titulo, cfg, opts, esperado] of CASOS) {
  const a = camino1(cfg), b = camino2(cfg, opts), c = camino3(cfg, opts);
  const ok = a === b && b === c && a === esperado;
  if (!ok) fallos++;
  console.log(`  ${ok ? ' ' : '✗'} ${titulo.padEnd(36)}${a.padEnd(13)}${b.padEnd(13)}${c.padEnd(16)}${esperado}`);
}

/* Zoom elegido pero sin URL utilizable no se puede cumplir: se atiende en la
 * Sala en vez de dar un botón roto. Los tres caminos, igual. */
console.log('\nZoom elegido sin URL válida — no se promete lo que no se puede dar\n');
const sinUrl = { video: { proveedor: 'zoom' } };
for (const [n, v] of [['reservar', camino1(sinUrl)], ['panel', camino2(sinUrl, { zoomUrl: '' })], ['crear-cita-red', camino3(sinUrl, { zoomUrl: '' })]]) {
  const ok = v === 'sala';
  if (!ok) fallos++;
  console.log(`  ${ok ? ' ' : '✗'} ${n.padEnd(38)}${v}`);
}

/* Meet elegido sin Google conectado: misma historia, mismos tres. */
console.log('\nMeet elegido sin Google conectado\n');
const sinGcal = { video: { proveedor: 'meet' } };
for (const [n, v] of [['panel', camino2(sinGcal, { gcalOk: false })], ['crear-cita-red', camino3(sinGcal, { gcalOk: false })]]) {
  const ok = v === 'sala';
  if (!ok) fallos++;
  console.log(`  ${ok ? ' ' : '✗'} ${n.padEnd(38)}${v}`);
}

/* ── El reintento no puede fabricar una cita "legacy" ─────────────────────
 *
 * `recordatorios-citas` tiene una rama de compatibilidad para las citas sin
 * `video_proveedor`: las anteriores al selector. Esa rama vuelve a adivinar —
 * `meet_link || zoom_url || sala`— y es justo lo que estamos quitando de todas
 * partes. Solo es aceptable si NINGUNA cita nueva puede entrar por ahí.
 *
 * Los tres caminos reintentan el INSERT cuando falla, soltando las columnas que
 * podrían no existir todavía. Si en ese reintento se soltase `video_proveedor`,
 * un fallo transitorio pariría una cita nueva con proveedor NULL.
 */
console.log('\nEl reintento del INSERT conserva la modalidad\n');

const REINTENTOS = [
  ['reservar.html', leer('reservar.html'),
    // `video_proveedor` se asigna FUERA de cualquier `if(withResp)`.
    (src) => {
      // Sobre el CODIGO: el comentario que explica el arreglo menciona
      // `if(withResp)` y falsearia la comparacion de posiciones.
      const cod = src
        .split('\n')
        .map((l) => l.replace(/^\s*(\/\/|\*|\/\*).*$/, '').replace(/\s\/\/[^'"`]*$/, ''))
        .join('\n');
      const bloque = cod.match(/var b=\{ coach_id:_cid[\s\S]*?return fetch\(SB\+'\/rest\/v1\/citas'/)[0];
      const asigna = bloque.indexOf('b.video_proveedor=');
      const guarda = bloque.indexOf('if(withResp)');
      return asigna > 0 && (guarda < 0 || asigna < guarda);
    }],
  ['panel-v2.html', leer('panel-v2.html'),
    (src) => /_sbw\("citas","POST",Object\.assign\(\{\},_agBody,\{modalidad:_amod,video_proveedor:_aprov\}\)\)/.test(src)],
  ['crear-cita-red', leer('supabase/functions/crear-cita-red/index.ts'),
    (src) => /insert\(\{ \.\.\.base, modalidad, video_proveedor: proveedor \}\)/.test(src)],
];

for (const [nombre, src, comprueba] of REINTENTOS) {
  const ok = comprueba(src);
  if (!ok) fallos++;
  console.log(`  ${ok ? 'PASS ' : 'FALLA'}  ${nombre.padEnd(38)}${ok ? 'el reintento lleva video_proveedor' : '  ← puede parir una cita legacy'}`);
}

/* Y la rama legacy sigue existiendo — para las citas de verdad antiguas. */
const rec = leer('supabase/functions/recordatorios-citas/index.ts');
const tieneLegacy = /Citas anteriores al selector/.test(rec);
if (!tieneLegacy) fallos++;
console.log(`  ${tieneLegacy ? 'PASS ' : 'FALLA'}  ${'la rama legacy sigue, para las viejas'.padEnd(38)}${tieneLegacy ? '66 citas la necesitan' : ''}`);

console.log(`\n${fallos === 0 ? '✓ Los tres caminos deciden lo mismo.' : `✗ ${fallos} divergencia(s).`}\n`);
process.exit(fallos === 0 ? 0 : 1);