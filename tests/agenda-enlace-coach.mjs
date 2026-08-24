/* La Agenda del coach muestra el enlace ya resuelto — y no inventa ninguno.
 *
 * `_agResLink()` devolvía `""` incondicionalmente desde julio de 2026, así que
 * el coach no veía enlace para NINGUNA modalidad mientras el cliente sí lo
 * recibía por correo. Y `_agEventoAFila()` tiraba `video_proveedor` y convertía
 * la URL de la Sala en null, con lo que el dato ni siquiera llegaba a la UI.
 *
 * Estas pruebas extraen las funciones REALES de `panel-v2.html` —no copias— y
 * comprueban las dos mitades: que el campo sobrevive al mapeo, y que la interfaz
 * lo consume sin volver a decidir nada.
 *
 * Correr:  node tests/agenda-enlace-coach.mjs
 */
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';

const RAIZ = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const panel = fs.readFileSync(path.join(RAIZ, 'panel-v2.html'), 'utf8');

/** Extrae una función por nombre contando llaves. Nada se reescribe a mano. */
function extraer(nombre) {
  const i = panel.indexOf('function ' + nombre + '(');
  if (i < 0) throw new Error('no encontrada: ' + nombre);
  let n = 0;
  for (let k = panel.indexOf('{', i); k < panel.length; k++) {
    if (panel[k] === '{') n++;
    else if (panel[k] === '}' && --n === 0) return panel.slice(i, k + 1);
  }
  throw new Error('no cierra: ' + nombre);
}

const API = new Function(
  extraer('_agResLink') + extraer('_agEsPresencial') + extraer('_agVideoEstado') + extraer('_agEventoAFila') +
  '\nreturn { _agResLink, _agEsPresencial, _agVideoEstado, _agEventoAFila };')();

const COACH = '99270bc1-bc56-4e0a-b978-3d58d3f8b848';
const SALA = `https://pathwaycareercoach.com/sala.html?room=${encodeURIComponent('Pathway-' + COACH + '-101')}`;
const SALA_OTRA = `https://pathwaycareercoach.com/sala.html?room=${encodeURIComponent('Pathway-' + COACH + '-999')}`;
const ZOOM = 'https://us05web.zoom.us/j/1234567890';
const ZOOM_OTRO = 'https://us05web.zoom.us/j/9999999999';
const MEET = 'https://meet.google.com/abc-defg-hij';

let fallos = 0;
const chk = (t, ok, extra = '') => { if (!ok) fallos++; console.log(`  ${ok ? 'PASS ' : 'FALLA'}  ${t.padEnd(46)}${extra}`); };

/* ── Las 4 modalidades ────────────────────────────────────────────────── */
console.log('\nLas cuatro modalidades — enlace y estado\n');
const MODALIDADES = [
  ['Meet',       { video_proveedor: 'meet',       meet_link: MEET }, MEET, 'ok'],
  ['Sala',       { video_proveedor: 'sala',       meet_link: SALA }, SALA, 'ok'],
  ['Zoom',       { video_proveedor: 'zoom',       meet_link: ZOOM }, ZOOM, 'ok'],
  ['Presencial', { video_proveedor: 'presencial', meet_link: null }, '',   'presencial'],
];
for (const [nombre, cita, urlEsperada, estadoEsperado] of MODALIDADES) {
  const url = API._agResLink(cita), est = API._agVideoEstado(cita);
  chk(`${nombre} · enlace`, url === urlEsperada, `→ ${url || '(sin botón)'}`);
  chk(`${nombre} · estado`, est === estadoEsperado, `→ ${est}`);
}

/* ── La UI no puede inventar ──────────────────────────────────────────── */
console.log('\nLa interfaz nunca fabrica un enlace\n');
const NO_INVENTA = [
  ['enlace vacío con proveedor sala',     { video_proveedor: 'sala', meet_link: null },  '', 'sin-enlace'],
  ['enlace vacío con proveedor meet',     { video_proveedor: 'meet', meet_link: '' },    '', 'sin-enlace'],
  ['enlace vacío con proveedor zoom',     { video_proveedor: 'zoom', meet_link: '   ' }, '', 'sin-enlace'],
  ['proveedor desconocido, con enlace',   { video_proveedor: 'skype', meet_link: MEET }, MEET, 'ok'],
  ['proveedor desconocido, sin enlace',   { video_proveedor: 'skype', meet_link: null }, '', 'sin-enlace'],
  ['cita antigua (sin proveedor)',        { meet_link: null },                            '', 'sin-enlace'],
  ['cita antigua con enlace guardado',    { meet_link: SALA },                            SALA, 'ok'],
  ['enlace que no es URL',                { video_proveedor: 'zoom', meet_link: 'pregúntame' }, '', 'sin-enlace'],
  ['presencial aunque traiga enlace',     { video_proveedor: 'presencial', meet_link: MEET },   '', 'presencial'],
  ['presencial por modalidad, sin prov.', { modalidad: 'presencial', meet_link: MEET },         '', 'presencial'],
  ['cita nula',                           null,                                            '', 'sin-enlace'],
];
for (const [nombre, cita, urlEsperada, estadoEsperado] of NO_INVENTA) {
  const url = API._agResLink(cita), est = API._agVideoEstado(cita);
  chk(nombre, url === urlEsperada && est === estadoEsperado, `→ ${url || '(sin botón)'} · ${est}`);
}

/* Nada de lo que devuelve puede salir de lo que se le dio. */
console.log('\nEl enlace SIEMPRE sale de `meet_link`, de ningún otro sitio\n');
const CONTAMINADA = {
  video_proveedor: 'zoom', meet_link: ZOOM,
  // Todo lo que una cascada antigua habría mirado:
  configuracion: { zoom_url: ZOOM_OTRO, video: { proveedor: 'meet' }, gcal: { refresh_token: 'x' } },
  zoom_url: ZOOM_OTRO, coach_id: COACH, id: 101, inicio: '2026-09-01T09:00:00.000Z',
};
chk('ignora zoom_url de la fila', API._agResLink(CONTAMINADA) === ZOOM, `→ ${API._agResLink(CONTAMINADA)}`);
chk('ignora configuracion.video', !API._agResLink(CONTAMINADA).includes('meet.google'));
chk('no reconstruye una sala', !API._agResLink({ video_proveedor: 'sala', meet_link: null, coach_id: COACH, id: 101 }));

/* ── Reprogramada: el enlace es el de la fila, no el de la hora ───────── */
console.log('\nCita reprogramada — el enlace no depende de la hora\n');
const antes = { video_proveedor: 'sala', meet_link: SALA, inicio: '2026-09-01T09:00:00.000Z', id: 101, coach_id: COACH };
const despues = { ...antes, inicio: '2026-10-15T17:30:00.000Z' };
chk('mismo enlace tras mover la cita', API._agResLink(antes) === API._agResLink(despues), `→ ${API._agResLink(despues)}`);
chk('y es el que se persistió', API._agResLink(despues) === SALA);
chk('otra cita = otra sala', API._agResLink({ video_proveedor: 'sala', meet_link: SALA_OTRA }) === SALA_OTRA);

/* ── El mapeo agenda-list → fila no puede perder el campo ─────────────── */
console.log('\n`_agEventoAFila` conserva lo que resolvió el servidor\n');
const EVENTOS = [
  ['meet',       { proveedor: 'meet', url: MEET, estado: 'ok' },        'meet',       MEET, 'online'],
  ['sala',       { proveedor: 'sala', url: SALA, estado: 'ok' },        'sala',       SALA, 'online'],
  ['zoom',       { proveedor: 'zoom', url: ZOOM, estado: 'ok' },        'zoom',       ZOOM, 'online'],
  ['presencial', { proveedor: 'presencial', url: null, estado: 'no_aplica' }, 'presencial', null, 'presencial'],
];
for (const [nombre, video, provEsperado, urlEsperada, modEsperada] of EVENTOS) {
  const fila = API._agEventoAFila({ cita_id: 101, coach_id: COACH, inicio: '2026-09-01T09:00:00.000Z', titulo: 'S', video });
  chk(`${nombre} · video_proveedor sobrevive`, fila.video_proveedor === provEsperado, `→ ${fila.video_proveedor}`);
  chk(`${nombre} · meet_link sobrevive`, fila.meet_link === urlEsperada, `→ ${fila.meet_link ?? 'null'}`);
  chk(`${nombre} · modalidad derivada`, fila.modalidad === modEsperada, `→ ${fila.modalidad}`);
  // Y el ciclo completo: lo que el servidor resolvió es lo que la UI pinta.
  chk(`${nombre} · la UI pinta ese mismo enlace`, API._agResLink(fila) === (urlEsperada || ''), '');
}

/* Un evento sin vídeo resuelto no se convierte en nada inventado. */
const pelada = API._agEventoAFila({ cita_id: 7, coach_id: COACH, inicio: '2026-09-01T09:00:00.000Z' });
chk('evento sin `video` → sin enlace', API._agResLink(pelada) === '' && pelada.video_proveedor === null, `→ ${pelada.meet_link}`);

console.log(`\n${fallos === 0 ? '✓ La Agenda del coach consume el dato resuelto y no inventa nada.' : `✗ ${fallos} fallo(s).`}\n`);
process.exit(fallos === 0 ? 0 : 1);
