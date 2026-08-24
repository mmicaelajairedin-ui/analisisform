/* Los correos nombran la modalidad REAL de la cita — y reprogramar no la cambia.
 *
 * Cuatro superficies decían «Entrar a Google Meet» para cualquier `meet_link`:
 * el email de confirmación del panel, el portal del cliente, `crear-cita-red` y
 * la agenda del empleado. La etiqueta salía del ENLACE, y un enlace no dice de
 * quién es. Una cita de Sala o de Zoom le prometía al cliente un Meet.
 *
 * Y `_notifResReprog` iba más lejos: reconstruía una Sala con
 * `_salaClientLink()` aunque la cita fuese Meet o Zoom, así que al reprogramar
 * el cliente recibía un enlace al que la coach no iba a entrar.
 *
 * Se ejecutan las funciones REALES de los ficheros. Sin red.
 *
 * Correr:  node --experimental-strip-types tests/emails-modalidad.mjs
 */
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const RAIZ = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const leer = (p) => fs.readFileSync(path.join(RAIZ, p), 'utf8');

globalThis.PWModalidad = require(path.join(RAIZ, 'pw-modalidad.js'));
const TS = await import(path.join(RAIZ, 'supabase/functions/_shared/agenda/modalidad.ts'));

/* Los comentarios explican el bug y por tanto NOMBRAN lo que se elimino
 * ("Google Meet", `_salaClientLink`). Estas comprobaciones miran el CODIGO, asi
 * que se quitan primero — si no, la propia explicacion del arreglo lo suspende. */
const soloCodigo = (src) => src
  .split('\n')
  .map((l) => l.replace(/^\s*(\/\/|\*|\/\*).*$/, '').replace(/\s\/\/[^'"`]*$/, ''))
  .join('\n');

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

const COACH = '99270bc1-bc56-4e0a-b978-3d58d3f8b848';
const sala = (id) => `https://pathwaycareercoach.com/sala.html?room=${encodeURIComponent('Pathway-' + COACH + '-' + id)}`;
const SALA = sala(101), SALA_NUEVA = sala(202);
const ZOOM = 'https://us05web.zoom.us/j/1234567890';
const MEET = 'https://meet.google.com/abc-defg-hij';

let fallos = 0;
const chk = (t, ok, extra = '') => { if (!ok) fallos++; console.log(`  ${ok ? 'PASS ' : 'FALLA'}  ${t.padEnd(46)}${extra}`); };

/* ── El botón real del panel ──────────────────────────────────────────── */
const panel = leer('panel-v2.html');
const _botonVideo = new Function('r', 'PWModalidad', 'PWI', 'esc',
  extraer(panel, '_botonVideo') + '\nreturn _botonVideo(r);');
const boton = (r) => _botonVideo(r, globalThis.PWModalidad,
  { svg: () => '<svg/>' }, (x) => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;'));

/* ── A–D · email de confirmación ──────────────────────────────────────── */
console.log('\nA–D · confirmación: la etiqueta sale del proveedor, no del enlace\n');
const CONFIRMA = [
  ['A · Meet',       { video_proveedor: 'meet', meet_link: MEET },  MEET, 'Entrar a Google Meet'],
  ['B · Sala',       { video_proveedor: 'sala', meet_link: SALA },  SALA, 'Entrar a la Sala de Pathway'],
  ['C · Zoom',       { video_proveedor: 'zoom', meet_link: ZOOM },  ZOOM, 'Entrar a la videollamada'],
  ['D · Presencial', { video_proveedor: 'presencial', meet_link: null, lugar: 'C/ Mayor 1' }, null, null],
];
for (const [titulo, cita, urlEsperada, etiquetaEsperada] of CONFIRMA) {
  const html = boton(cita);
  if (etiquetaEsperada) {
    chk(`${titulo} · etiqueta`, html.includes(etiquetaEsperada), `→ ${etiquetaEsperada}`);
    chk(`${titulo} · enlace`, html.includes(urlEsperada.replace(/&/g, '&amp;')), '');
    // Y lo que NO puede decir.
    if (cita.video_proveedor !== 'meet') chk(`${titulo} · NO dice Google Meet`, !html.includes('Google Meet'), '');
  } else {
    chk(`${titulo} · sin botón de vídeo`, !html.includes('<a href'), '');
    chk(`${titulo} · dice Presencial`, html.includes('Presencial'), '');
    chk(`${titulo} · con el lugar`, html.includes('C/ Mayor 1'), '');
  }
}

/* ── E–H · reprogramación: el enlace persistido, intacto ──────────────── */
console.log('\nE–H · reprogramar NO cambia modalidad ni enlace\n');
const REPROG = [
  ['E · Meet',       { video_proveedor: 'meet', meet_link: MEET }, MEET, 'Entrar a Google Meet'],
  ['F · Sala',       { video_proveedor: 'sala', meet_link: SALA }, SALA, 'Entrar a la Sala de Pathway'],
  ['G · Zoom',       { video_proveedor: 'zoom', meet_link: ZOOM }, ZOOM, 'Entrar a la videollamada'],
  ['H · Presencial', { video_proveedor: 'presencial', meet_link: null }, '', ''],
];
for (const [titulo, cita, urlEsperada, etiquetaEsperada] of REPROG) {
  // Lo que `_notifResReprog` calcula ahora: `PWModalidad.videoDeCita(r)`.
  const antes = globalThis.PWModalidad.videoDeCita({ ...cita, inicio: '2026-09-01T09:00:00.000Z' });
  const despues = globalThis.PWModalidad.videoDeCita({ ...cita, inicio: '2026-11-20T18:00:00.000Z' });
  chk(`${titulo} · mismo enlace tras mover`, antes.url === despues.url && despues.url === urlEsperada, `→ ${despues.url || '(sin enlace)'}`);
  chk(`${titulo} · misma etiqueta`, despues.etiqueta === etiquetaEsperada, `→ ${despues.etiqueta || '(ninguna)'}`);
  chk(`${titulo} · el proveedor no cambia`, despues.proveedor === cita.video_proveedor, '');
}
// La regresión concreta: Meet y Zoom NO pueden acabar en una Sala.
chk('E · Meet reprogramado NO acaba en sala.html', !globalThis.PWModalidad.videoDeCita({ video_proveedor: 'meet', meet_link: MEET }).url.includes('sala.html'), '');
chk('G · Zoom reprogramado NO acaba en sala.html', !globalThis.PWModalidad.videoDeCita({ video_proveedor: 'zoom', meet_link: ZOOM }).url.includes('sala.html'), '');

/* ── `_notifResReprog` ya no reconstruye la Sala ──────────────────────── */
console.log('\nEl código de reprogramación ya no fabrica una Sala\n');
const reprogSrc = panel.match(/function _notifResReprog[\s\S]*?\n\}/)[0];
chk('_notifResReprog usa videoDeCita', /PWModalidad\.videoDeCita\(r\)/.test(reprogSrc), '');
chk('_notifResReprog NO llama a _salaClientLink', !/_salaClientLink\(/.test(soloCodigo(reprogSrc)), '');
// El .ics adjunto y el boton de Google Calendar son parte del MISMO correo, y
// tenian el mismo fallo una capa mas abajo: los dos fabricaban una Sala.
chk('_resIcs usa el enlace persistido', /PWModalidad\.videoDeCita\(r\)\.url/.test(extraer(panel, '_resIcs')), '');
chk('_resIcs NO reconstruye una Sala', !/_salaClientLink\(/.test(soloCodigo(extraer(panel, '_resIcs'))), '');
chk('_gcalUrl nombra la modalidad real', /PWModalidad\.videoDeCita\(r\)/.test(extraer(panel, '_gcalUrl')), '');
chk('_gcalUrl sin "Google Meet" fijo', !/Google Meet/.test(soloCodigo(extraer(panel, '_gcalUrl'))), '');
const confirmaSrc = panel.match(/function _confirmCliente[\s\S]*?\n\}/)[0];
chk('_confirmCliente usa _botonVideo', /_botonVideo\(r\)/.test(confirmaSrc), '');
chk('_confirmCliente sin "Google Meet" fijo', !/Google Meet/.test(soloCodigo(confirmaSrc)), '');

/* ── Las otras dos superficies ────────────────────────────────────────── */
console.log('\nPortal del cliente, empleado y crear-cita-red\n');
const cli = leer('cliente.html');
chk('cliente.html · carga la regla compartida', /pw-modalidad\.js/.test(cli), '');
chk('cliente.html · lleva video_proveedor a la sesión', /video_proveedor:cita\.video_proveedor/.test(cli), '');
chk('cliente.html · sin "Entrar a Google Meet" fijo', !/Entrar a Google Meet/.test(cli), '');
chk('empleado.html · sin etiqueta "Google Meet"', !/push\('Google Meet'\)/.test(leer('empleado.html')), '');
const red = leer('supabase/functions/crear-cita-red/index.ts');
chk('crear-cita-red · usa videoDeCita', /videoDeCita\(\{ video_proveedor: proveedor/.test(red), '');
chk('crear-cita-red · sin "Google Meet" en el HTML', !/Entrar a Google Meet|<b>Google Meet:<\/b>/.test(soloCodigo(red)), '');

/* Y el gemelo del servidor decide igual que el del navegador. */
for (const cita of [
  { video_proveedor: 'meet', meet_link: MEET }, { video_proveedor: 'sala', meet_link: SALA },
  { video_proveedor: 'zoom', meet_link: ZOOM }, { video_proveedor: 'presencial', meet_link: null },
  { meet_link: MEET }, { video_proveedor: 'sala', meet_link: null },
]) {
  const a = globalThis.PWModalidad.videoDeCita(cita), b = TS.videoDeCita(cita);
  chk(`gemelo js↔ts · ${cita.video_proveedor || 'sin proveedor'}`,
    a.url === b.url && a.etiqueta === b.etiqueta && a.proveedor === b.proveedor, `→ ${b.etiqueta || '(ninguna)'}`);
}

/* ── I–O · la reprogramación cierra la cita vieja ─────────────────────── */
console.log('\nI–O · reprogramar cierra el evento viejo y abre uno nuevo\n');
const res = leer('reservar.html');
const bloque = res.match(/var _rp=qp\('reprog'\);[\s\S]*?\}catch\(e\)\{\}/)[0];
chk('I · cancela el evento de la cita vieja', /op:'cancelar'/.test(bloque), '');
chk('I · con el id de la cita VIEJA', /_vieja\.id/.test(bloque), '');
// La LLAMADA (`_cancelOld(2).then`), no la definicion, va antes de cancelar en
// Google: hace falta la fila para conocer el id de la cita vieja.
const bloqueCod = soloCodigo(bloque);
chk('I · después de tener la fila, no antes', bloqueCod.indexOf('_cancelOld(2).then') < bloqueCod.indexOf("op:'cancelar'"), '');

/* J, K: los cubre `sync-cita-to-gcal`, y su comportamiento está fijado en
 * calendar-ciclo-vida.mjs. Aquí se comprueba que reservar.html delega en él en
 * vez de tratar `google_event_id` por su cuenta. */
chk('J/K · delega en sync-cita-to-gcal', /functions\/v1\/sync-cita-to-gcal/.test(bloque), '');
chk('J/K · no toca google_event_id a mano', !/google_event_id/.test(soloCodigo(bloque)), '');

/* L–O: la cita nueva es OTRA fila, así que su Sala es otra. */
const _salaUrlDe = new Function(extraer(res, '_salaUrlDe') + '\nreturn _salaUrlDe;')();
chk('M · la Sala nueva usa el id nuevo', _salaUrlDe(COACH, 202) === SALA_NUEVA, '');
chk('N · la Sala vieja y la nueva son distintas', _salaUrlDe(COACH, 101) !== _salaUrlDe(COACH, 202), '');
chk('N · la vieja sigue siendo la vieja', _salaUrlDe(COACH, 101) === SALA, '');
chk('O · una cita, un id, una Sala', _salaUrlDe(COACH, 202) === _salaUrlDe(COACH, 202), '');

console.log(`\n${fallos === 0 ? '✓ Cada correo nombra la modalidad real, y reprogramar no la cambia.' : `✗ ${fallos} fallo(s).`}\n`);
process.exit(fallos === 0 ? 0 : 1);
