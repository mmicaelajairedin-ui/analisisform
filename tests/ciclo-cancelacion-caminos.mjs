/* Ningún camino puede cambiar el estado o la hora de una cita sin decírselo a
 * Google. Si aparece uno nuevo, esta prueba lo caza.
 *
 * Cuatro sitios mueven o cancelan citas, y hasta el paso 5 NINGUNO tocaba
 * Google: cancelar dejaba el evento vivo ocupando el hueco en el calendario de
 * la coach, y reprogramar desde `gestionar-cita` creaba una cita nueva con su
 * propio evento y abandonaba el anterior.
 *
 * Lo que se comprueba no es que la llamada exista en el fichero —eso lo cumple
 * cualquier `grep`— sino que esté EMPAREJADA con la mutación concreta y con la
 * operación correcta, y que no haya un quinto camino sin emparejar.
 *
 * Correr:  node tests/ciclo-cancelacion-caminos.mjs
 */
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';

const RAIZ = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const leer = (p) => fs.readFileSync(path.join(RAIZ, p), 'utf8');

let fallos = 0;
const chk = (t, ok, extra = '') => { if (!ok) fallos++; console.log(`  ${ok ? 'PASS ' : 'FALLA'}  ${t.padEnd(52)}${extra}`); };

/** El trozo de código que rodea a una mutación, para ver con qué va acompañada. */
function entorno(src, ancla, radio = 900) {
  const i = src.indexOf(ancla);
  if (i < 0) return null;
  return src.slice(Math.max(0, i - 120), i + radio);
}

console.log('\nLos cuatro caminos que mueven o cancelan una cita\n');

/* ── 1 · panel-v2 · la coach cancela ──────────────────────────────────── */
const panel = leer('panel-v2.html');
const cancelaPanel = entorno(panel, 'if(act==="res-confirm"||act==="res-cancel")', 1800);
chk('1 · panel · cancelar avisa a Google', /_gcalAvisar\(_rid,"cancelar"\)/.test(cancelaPanel), '');
chk('1 · panel · solo al cancelar, no al confirmar',
  cancelaPanel.indexOf('_gcalAvisar(_rid,"cancelar")') > cancelaPanel.indexOf('act==="res-cancel"'), '');

/* ── 2 · panel-v2 · la coach mueve la hora ────────────────────────────── */
const mueve = entorno(panel, 'if(act==="res-hora-save")', 1800);
chk('2 · panel · mover avisa a Google', /_gcalAvisar\(_rid,"mover"\)/.test(mueve), '');
chk('2 · panel · con op "mover", no "crear"', !/_gcalAvisar\(_rid,"crear"\)/.test(mueve), '');

/* El helper no puede hablar con Google por su cuenta: delega. */
const helper = panel.match(/function _gcalAvisar\([\s\S]*?\n\}/)[0];
chk('   · _gcalAvisar delega en sync-cita-to-gcal', /functions\/v1\/sync-cita-to-gcal/.test(helper), '');
chk('   · no llama a gcal-push directamente', !/gcal-push/.test(helper), '');

/* ── 3 · gestionar-cita · el cliente cancela ──────────────────────────── */
const gest = leer('gestionar-cita.html');
const doCancel = gest.match(/function doCancel\([\s\S]*?\n\}/)[0];
chk('3 · cliente · cancelar avisa a Google', /_gcalCancelar\(\)/.test(doCancel), '');
const gcalCancelar = gest.match(/function _gcalCancelar\([\s\S]*?\n\}/)[0];
chk('3 · cliente · con op cancelar', /op:'cancelar'/.test(gcalCancelar), '');
chk('3 · cliente · sobre la cita real', /CITA\.id/.test(gcalCancelar), '');

/* ── 4 · editar-cita-red · la red edita o cancela ─────────────────────── */
const red = leer('supabase/functions/editar-cita-red/index.ts');
chk('4 · red · cancelar → op cancelar', /action === "cancel" \? "cancelar"/.test(red), '');
chk('4 · red · mover → op mover', /patch\.inicio \? "mover" : null/.test(red), '');
chk('4 · red · después de escribir la fila',
  red.indexOf('update_failed') < red.indexOf('sync-cita-to-gcal'), '');

/* ── 4b · reservar.html?reprog · sustituye una cita por otra ──────────── */
const res = leer('reservar.html');
const reprog = res.match(/var _rp=qp\('reprog'\);[\s\S]*?\}catch\(e\)\{\}/)[0];
chk('4b · reprog · cancela el evento de la cita vieja', /op:'cancelar'/.test(reprog), '');
chk('4b · reprog · con el id de la VIEJA, no el de la nueva', /_vieja\.id/.test(reprog), '');

console.log('\nNo hay un quinto camino sin emparejar\n');

/* Los comentarios NOMBRAN lo que se quito ("gcal-push"), asi que estas
 * comprobaciones miran el CODIGO. */
const soloCodigo = (src) => src
  .split('\n')
  .map((l) => l.replace(/^\s*(\/\/|\*|\/\*).*$/, '').replace(/\s\/\/[^'"`]*$/, ''))
  .join('\n');

/* Mover o cancelar una cita es ESCRIBIR `estado` o `inicio`. Escribir notas no
 * lo es, y por eso `sala.html` no tiene que avisar a Google: guarda el resultado
 * de la sesion, no la mueve. La deteccion mira el CUERPO de cada escritura, no
 * si el fichero contiene la palabra PATCH en alguna parte. */
function mueveOCancela(src) {
  const cod = soloCodigo(src);
  const marcas = [
    // `[^)]` no vale: la URL se arma con `encodeURIComponent(...)`, que trae
    // parentesis dentro.
    /_sbw\(\s*["'`]citas[\s\S]{0,300}?["'`]PATCH["'`]\s*,\s*\{[^}]*(estado|inicio)\s*:/,
    /citas[^\n]{0,300}?method:\s*['"]PATCH['"][\s\S]{0,400}?body:[^\n]{0,200}(estado|inicio)\s*:/,
    /patch\.(estado|inicio)\s*=/,
    /cancelar_cita_by_token/,
  ];
  return marcas.some((r) => r.test(cod));
}

const FICHEROS = [
  'panel-v2.html', 'gestionar-cita.html', 'reservar.html', 'cliente.html',
  'empleado.html', 'sala.html', 'pathway-fit-cliente.html', 'pathway-fin-cliente.html',
  'supabase/functions/editar-cita-red/index.ts',
  'supabase/functions/crear-cita-red/index.ts',
  'supabase/functions/agenda-red-cliente/index.ts',
];

const mueven = [];
for (const f of FICHEROS) {
  const src = leer(f);
  const muta = mueveOCancela(src);
  const avisa = /sync-cita-to-gcal/.test(soloCodigo(src));
  if (muta) mueven.push(f);
  chk(`${f}`, !muta || avisa,
    muta ? (avisa ? 'mueve o cancela → avisa' : '  ← MUEVE SIN AVISAR A GOOGLE') : 'no mueve ni cancela');
}
chk('son exactamente los cuatro caminos auditados', mueven.length === 4, `→ ${mueven.length}: ${mueven.map((f) => f.split('/').pop()).join(', ')}`);

/* `sala.html` si escribe en `citas`, y por eso merece la comprobacion explicita:
 * lo que escribe son las notas de la sesion, no su estado ni su hora. */
const patchSala = entorno(leer('sala.html'), "rest/v1/citas?id=eq.'+encodeURIComponent(CITA)", 600) || '';
chk('sala.html · escribe notas, no estado ni hora', !/\b(estado|inicio)\s*[:=]/.test(patchSala), '');

console.log('\nY una cita cancelada nunca deja el evento vivo\n');

/* La garantía final la da `sync-cita-to-gcal`, ya probada en
 * calendar-ciclo-vida.mjs. Aquí solo se fija que los cuatro caminos usan ESA
 * puerta y no otra — nadie habla con `gcal-push` por su cuenta. */
const directos = FICHEROS.filter((f) => /gcal-push/.test(soloCodigo(leer(f))));
chk('ningún camino llama a gcal-push directamente', directos.length === 0, directos.join(', '));

console.log(`\n${fallos === 0 ? '✓ Cuatro caminos, una sola puerta a Google, ningún evento huérfano.' : `✗ ${fallos} fallo(s).`}\n`);
process.exit(fallos === 0 ? 0 : 1);
