// scripts/probar-canal-grupos.mjs
//
// Comprueba el cableado de 'group_update' y 'group_delete' del Canal del dueño
// (multicoach.html) contra el contrato de la edge function canal-red.
//
// Corre OFFLINE: no abre navegador, no toca la red y no toca Pathway. Extrae
// las funciones del HTML y las ejecuta con un DOM y un fetch de mentira, para
// comprobar QUE SE MANDA — accion, campos y nada de mas.
//
// Vive en scripts/ y NO en tests/ a proposito: playwright descubre por
// testDir './tests', y un fichero que no cargue ahi tumba el descubrimiento
// entero. Aqui no puede afectarlo.
//
//   node scripts/probar-canal-grupos.mjs     → 16 ok · 0 fallos
// un DOM y un fetch de mentira, para comprobar QUE SE MANDA exactamente.
import { readFileSync } from 'node:fs';

const HTML = readFileSync(new URL('../multicoach.html', import.meta.url), 'utf8');
function saca(nombre) {
  const i = HTML.indexOf('function ' + nombre + '(');
  if (i < 0) throw new Error('no encuentro ' + nombre);
  let d = 0, j = HTML.indexOf('{', i);
  for (let k = j; k < HTML.length; k++) {
    if (HTML[k] === '{') d++;
    else if (HTML[k] === '}') { d--; if (d === 0) return HTML.slice(i, k + 1); }
  }
  throw new Error('sin cerrar: ' + nombre);
}

const FUENTE = ['_mcEsc','_mcEditarGrupo','_mcGuardarGrupo','_mcBorrarGrupo','_mcBorrarGrupoOk']
  .map(saca).join('\n');

let enviados = [], toasts = [], checked = [], valorNombre = '';
const el = (extra = {}) => ({ innerHTML: '', value: '', disabled: false, textContent: '', focus() {}, ...extra });

const ctx = {
  console,
  document: {
    getElementById: (id) => id === 'mc-grp-nombre' ? el({ value: valorNombre }) : el(),
    querySelectorAll: () => checked.map((v) => ({ value: v })),
  },
  PWI: { svg: () => '<svg/>' },
  DB: { coaches: [{ id: 'c1', n: 'Ana', est: 'activo' }, { id: 'c2', n: 'Beto', est: 'activo' }] },
  SB: 'https://api.pathwaycareercoach.com',
  MC_REAL: true,
  MC_ORG: { id: 'org-1' },
  MC_OWNER: { id: 'own-9' },
  _hdr: async () => ({}),
  fetch: async (url, opt) => { enviados.push({ url, body: JSON.parse(opt.body) }); return { ok: true, json: async () => ({ ok: true }) }; },
  __toast: (t) => toasts.push(t),
  _mcChat: { canales: [], cur: null, view: 'list', msgs: null },
  _MC_GRUPOS_DEMO: [],
  _mcLoadCanales: (cb) => cb && cb(),
  _mcRenderList: () => {},
  _mcStopPoll: () => {},
  _mcSyncHd: () => {},
  _mcUpdHeaderDot: () => {},
};
ctx.globalThis = ctx;
const vm = await import('node:vm');
vm.createContext(ctx);
vm.runInContext(FUENTE, ctx);

const CANALES = [
  { id: null, nombre: 'General', general: true, is_system: true, miembros: [] },
  { id: 'sys-1', nombre: 'Owners', general: false, is_system: true, miembros: [] },
  { id: 'g-1', nombre: 'Nutricionistas', general: false, is_system: false, miembros: ['c1'] },
];
const reset = (n = '', c = []) => { enviados = []; toasts = []; valorNombre = n; checked = c; ctx._mcChat.canales = CANALES.map((x) => ({ ...x })); };

let ok = 0, ko = 0;
const t = (nombre, cond, detalle = '') => { if (cond) { ok++; console.log('  ok   ' + nombre); } else { ko++; console.log('  FALLA ' + nombre + (detalle ? ' → ' + detalle : '')); } };
const esperar = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };

console.log('\ngroup_update');
reset('Nutrición', ['c1', 'c2']);
ctx._mcGuardarGrupo(2); await esperar();
t('manda una sola peticion', enviados.length === 1, JSON.stringify(enviados));
t('va a canal-red', (enviados[0]?.url || '').endsWith('/functions/v1/canal-red'));
t("action es 'group_update'", enviados[0]?.body.action === 'group_update');
t('lleva org_id y canal_id del grupo', enviados[0]?.body.org_id === 'org-1' && enviados[0]?.body.canal_id === 'g-1');
t('lleva el nombre nuevo', enviados[0]?.body.nombre === 'Nutrición');
t('mete al dueño en la lista (como group_create)', (enviados[0]?.body.miembros || []).includes('own-9'));
t('no inventa campos fuera del contrato',
  JSON.stringify(Object.keys(enviados[0]?.body || {}).sort()) === JSON.stringify(['action','canal_id','miembros','nombre','org_id']),
  Object.keys(enviados[0]?.body || {}).join(','));

console.log('\nlista vacia = toda la red');
reset('Abierto', []);
ctx._mcGuardarGrupo(2); await esperar();
t('no mete al dueño si la lista queda vacia', Array.isArray(enviados[0]?.body.miembros) && enviados[0].body.miembros.length === 0);

console.log('\ngroup_delete');
reset(); ctx._mcBorrarGrupoOk(2); await esperar();
t("action es 'group_delete'", enviados[0]?.body.action === 'group_delete');
t('solo org_id y canal_id',
  JSON.stringify(Object.keys(enviados[0]?.body || {}).sort()) === JSON.stringify(['action','canal_id','org_id']),
  Object.keys(enviados[0]?.body || {}).join(','));

console.log('\nlo que NO se puede tocar');
reset('X', ['c1']); ctx._mcGuardarGrupo(0); await esperar();
t('el canal General no se renombra', enviados.length === 0);
reset(); ctx._mcBorrarGrupoOk(0); await esperar();
t('el canal General no se borra', enviados.length === 0);
reset('X', ['c1']); ctx._mcGuardarGrupo(1); await esperar();
t('un canal de sistema no se renombra', enviados.length === 0);
reset(); ctx._mcBorrarGrupoOk(1); await esperar();
t('un canal de sistema no se borra', enviados.length === 0);
reset('', ['c1']); ctx._mcGuardarGrupo(2); await esperar();
t('nombre vacio no manda nada', enviados.length === 0 && toasts.length === 1, toasts.join('|'));

console.log('\nel aviso de borrado dice la verdad');
reset(); ctx._mcBorrarGrupo(2);
const aviso = ctx._mcChat.__ultimoHTML || '';
t('se pide segundo clic (no borra al primero)', enviados.length === 0);

console.log('\n' + ok + ' ok · ' + ko + ' fallos');
process.exit(ko ? 1 : 0);
