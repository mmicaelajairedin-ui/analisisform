/* Google Calendar respeta la modalidad ya decidida — los 6 escenarios.
 *
 * Ejecuta las funciones REALES de `gcal-push` y `sync-cita-to-gcal` con `fetch`
 * interceptado: no hay red, no hay Google, no hay Supabase. Se observa qué
 * habría pedido cada una y qué habría escrito en la fila.
 *
 * Lo que estas pruebas impiden que vuelva (INC-2):
 *   · pedir un Google Meet en toda cita, sea cual sea la modalidad;
 *   · escribir el `hangoutLink` encima del enlace que el cliente ya recibió.
 *
 * Correr:  node --experimental-strip-types tests/calendar-modalidades.mjs
 */
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const RAIZ = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const COACH = '99270bc1-bc56-4e0a-b978-3d58d3f8b848';
const CITA_ID = 101;
const SALA = `https://pathwaycareercoach.com/sala.html?room=${encodeURIComponent('Pathway-' + COACH + '-' + CITA_ID)}`;
const ZOOM = 'https://us05web.zoom.us/j/1234567890';
const MEET = 'https://meet.google.com/abc-defg-hij';
const EVENT_ID = 'gcal_evt_xyz789';

/* ── El entorno falso ─────────────────────────────────────────────────────
 * `Deno` se monta UNA vez, antes de importar nada: las Edge Functions leen sus
 * variables de entorno y llaman a `Deno.serve` al cargar el modulo, y Node no
 * vuelve a ejecutar un modulo ya importado. Cada funcion se carga una sola vez
 * y se guarda su handler; lo que cambia por escenario es el `fetch`.            */
const HANDLERS = {};
globalThis.Deno = {
  env: { get: (k) => ({ SUPABASE_URL: 'https://sb.test', SUPABASE_SERVICE_ROLE_KEY: 'svc', GOOGLE_CLIENT_ID: 'id', GOOGLE_CLIENT_SECRET: 'sec' }[k] || '') },
  serve: (h) => { globalThis.__ultimoHandler = h; },
};

function montarEntorno({ cita, googleDaMeet, googleCae = false }) {
  const visto = { conferencia: null, urlPush: null, location: null, patches: [], gevKeys: null };

  globalThis.fetch = async (url, opts = {}) => {
    const u = String(url);
    // El token de Google viaja como URLSearchParams, no como JSON: parsear a lo
    // bruto reventaba el stub y `accessToken` lo veia como "token_failed".
    let body = null;
    if (typeof opts.body === 'string') { try { body = JSON.parse(opts.body); } catch { body = null; } }
    const ok = (d) => ({ ok: true, status: 200, json: async () => d, text: async () => JSON.stringify(d) });

    // Lectura de la cita
    if (u.includes('/rest/v1/citas?id=eq.') && u.includes('select=*')) return ok([cita]);
    // Escritura de la cita
    if (u.includes('/rest/v1/citas?id=eq.')) { visto.patches.push(body); return ok(null); }
    // Token de Google del coach
    if (u.includes('/rest/v1/gcal_tokens')) return ok([{ coach_id: COACH, token: { refresh_token: 'r', access_token: 'a', expiry: Date.now() + 9e6 } }]);
    if (u.includes('/rest/v1/usuarios')) return ok([{ id: COACH, configuracion: { gcal: { refresh_token: 'r' } } }]);
    if (u.includes('oauth2.googleapis.com')) return ok({ access_token: 'a', expires_in: 3600 });

    // gcal-push llamado por sync
    if (u.includes('/functions/v1/gcal-push')) {
      visto.conferencia = body?.event?.conferencia;
      visto.location = body?.event?.location;
      if (googleCae) return { ok: false, status: 502, json: async () => ({ reason: 'coach_no_gcal_write' }) };
      return ok({ ok: true, event_id: EVENT_ID, hangoutLink: googleDaMeet ? MEET : '' });
    }

    // La API de Google Calendar, vista desde gcal-push
    if (u.includes('googleapis.com/calendar')) {
      visto.urlPush = u;
      visto.gevKeys = Object.keys(body || {});
      return ok({ id: EVENT_ID, ...(googleDaMeet && u.includes('conferenceDataVersion=1')
        ? { conferenceData: { entryPoints: [{ entryPointType: 'video', uri: MEET }] } } : {}) });
    }
    throw new Error('fetch no previsto: ' + u);
  };

  return visto;
}

/* El fichero REAL se importa una vez; despues se reutiliza su handler. */
async function correr(fichero, payload, entorno) {
  if (!HANDLERS[fichero]) {
    delete globalThis.__ultimoHandler;
    await import(pathToFileURL(path.join(RAIZ, fichero)).href);
    if (typeof globalThis.__ultimoHandler !== 'function') throw new Error('sin handler: ' + fichero);
    HANDLERS[fichero] = globalThis.__ultimoHandler;
  }
  const res = await HANDLERS[fichero](new Request('https://x/f', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload),
  }));
  return { cuerpo: await res.json(), visto: entorno };
}

const citaBase = { id: CITA_ID, coach_id: COACH, nombre: 'Sesión', inicio: '2026-09-01T09:00:00.000Z', grupal: false };

/* ── Los escenarios ───────────────────────────────────────────────────── */
const ESCENARIOS = [
  { id: 'A', titulo: 'Meet · Google DEVUELVE hangoutLink',
    cita: { ...citaBase, modalidad: 'online', video_proveedor: 'meet', meet_link: null },
    googleDaMeet: true,
    espera: { conferencia: true, proveedor: 'meet', url: MEET, patchProv: 'meet', patchLink: MEET } },

  { id: 'B', titulo: 'Meet · Google NO devuelve hangoutLink',
    cita: { ...citaBase, modalidad: 'online', video_proveedor: 'meet', meet_link: null },
    googleDaMeet: false,
    espera: { conferencia: true, proveedor: 'sala', url: SALA, patchProv: 'sala', patchLink: SALA } },

  { id: 'C', titulo: 'Sala · sin enlace guardado todavía',
    cita: { ...citaBase, modalidad: 'online', video_proveedor: 'sala', meet_link: null },
    googleDaMeet: true,
    espera: { conferencia: false, proveedor: 'sala', url: SALA, patchProv: undefined, patchLink: SALA } },

  { id: 'C2', titulo: 'Sala · con enlace ya enviado al cliente',
    cita: { ...citaBase, modalidad: 'online', video_proveedor: 'sala', meet_link: SALA },
    googleDaMeet: true,
    espera: { conferencia: false, proveedor: 'sala', url: SALA, patchProv: undefined, patchLink: undefined } },

  { id: 'D', titulo: 'Zoom · el enlace del coach no se toca',
    cita: { ...citaBase, modalidad: 'online', video_proveedor: 'zoom', meet_link: ZOOM },
    googleDaMeet: true,
    espera: { conferencia: false, proveedor: 'zoom', url: ZOOM, patchProv: undefined, patchLink: undefined } },

  { id: 'E', titulo: 'Presencial · ni conferencia ni enlace',
    cita: { ...citaBase, modalidad: 'presencial', video_proveedor: 'presencial', lugar: 'C/ Mayor 1', meet_link: null },
    googleDaMeet: true,
    espera: { conferencia: false, proveedor: 'presencial', url: '', patchProv: undefined, patchLink: undefined, location: 'C/ Mayor 1' } },
];

let fallos = 0;
const chk = (t, ok, extra = '') => { if (!ok) fallos++; console.log(`    ${ok ? 'PASS ' : 'FALLA'}  ${t.padEnd(44)}${extra}`); };

console.log('\n╔══ Los 5 escenarios de creación ═══════════════════════════════════════\n');
const guardados = {};
for (const e of ESCENARIOS) {
  console.log(`  ${e.id} · ${e.titulo}`);
  const ent = montarEntorno({ cita: e.cita, googleDaMeet: e.googleDaMeet });
  const { cuerpo, visto } = await correr('supabase/functions/sync-cita-to-gcal/index.ts', { cita_id: CITA_ID }, ent);
  const patch = Object.assign({}, ...visto.patches);
  guardados[e.id] = { cuerpo, patch, visto };

  chk('¿pide conferenceData a Google?', visto.conferencia === e.espera.conferencia, `→ ${visto.conferencia}`);
  chk('proveedor final', cuerpo.proveedor === e.espera.proveedor, `→ ${cuerpo.proveedor}`);
  chk('enlace final', cuerpo.url === e.espera.url, `→ ${cuerpo.url || '(vacío)'}`);
  chk('video_proveedor persistido', patch.video_proveedor === e.espera.patchProv, `→ ${patch.video_proveedor ?? '(no se escribe)'}`);
  chk('meet_link persistido', patch.meet_link === e.espera.patchLink, `→ ${patch.meet_link ?? '(no se escribe)'}`);
  chk('google_event_id persistido', patch.google_event_id === EVENT_ID, `→ ${patch.google_event_id ?? '(ninguno)'}`);
  if (e.espera.location !== undefined) chk('location del evento', visto.location === e.espera.location, `→ ${visto.location}`);
  console.log('');
}

/* ── F · una sincronización POSTERIOR no puede pisar nada ─────────────── */
console.log('╔══ F · sincronizar OTRA VEZ una cita ya resuelta ══════════════════════\n');
const REPETIR = [
  ['meet ya resuelto',       { ...citaBase, modalidad: 'online', video_proveedor: 'meet', meet_link: MEET }, MEET],
  ['sala ya resuelta',       { ...citaBase, modalidad: 'online', video_proveedor: 'sala', meet_link: SALA }, SALA],
  ['zoom ya resuelto',       { ...citaBase, modalidad: 'online', video_proveedor: 'zoom', meet_link: ZOOM }, ZOOM],
  ['presencial ya resuelta', { ...citaBase, modalidad: 'presencial', video_proveedor: 'presencial', lugar: 'C/ Mayor 1', meet_link: null }, ''],
];
for (const [nombre, cita, urlEsperada] of REPETIR) {
  const ent = montarEntorno({ cita, googleDaMeet: true });
  const { cuerpo, visto } = await correr('supabase/functions/sync-cita-to-gcal/index.ts', { cita_id: CITA_ID }, ent);
  const patch = Object.assign({}, ...visto.patches);
  const pisado = patch.meet_link !== undefined && patch.meet_link !== cita.meet_link;
  chk(nombre, !pisado && cuerpo.url === urlEsperada, `enlace → ${cuerpo.url || '(vacío)'}${pisado ? '  ¡PISADO!' : ''}`);
}

/* ── La invariante que el contrato exige que sea imposible ────────────── */
console.log('\n╔══ Estados imposibles ═════════════════════════════════════════════════\n');
for (const id of ['A', 'B']) {
  const { cuerpo } = guardados[id];
  chk(`${id} · no queda meet con enlace de Sala`,
    !(cuerpo.proveedor === 'meet' && cuerpo.url.includes('sala.html')), `${cuerpo.proveedor} + ${cuerpo.url.slice(0, 42)}`);
  chk(`${id} · no queda meet sin enlace de Meet`,
    !(cuerpo.proveedor === 'meet' && !cuerpo.url.includes('meet.google.com')), '');
}
chk('D · zoom nunca acaba en meet', guardados.D.cuerpo.proveedor === 'zoom' && guardados.D.cuerpo.url === ZOOM);
chk('C · sala nunca acaba en meet', guardados.C.cuerpo.proveedor === 'sala' && !guardados.C.cuerpo.url.includes('meet.google'));
chk('E · presencial nunca acaba en meet', guardados.E.cuerpo.proveedor === 'presencial' && guardados.E.cuerpo.url === '');

/* ── gcal-push directamente: el cuerpo y la URL que arma ──────────────── */
console.log('\n╔══ gcal-push · qué le manda a Google ══════════════════════════════════\n');
for (const [nombre, conferencia, esperaConf] of [['con conferencia', true, true], ['sin conferencia', false, false]]) {
  const ent = montarEntorno({ cita: citaBase, googleDaMeet: true });
  const { visto, cuerpo } = await correr('supabase/functions/gcal-push/index.ts', {
    coach_id: COACH, op: 'create',
    event: { summary: 'S', startISO: citaBase.inicio, endISO: '2026-09-01T10:00:00.000Z', conferencia },
  }, ent);
  const tieneConf = (visto.gevKeys || []).includes('conferenceData');
  const urlConf = String(visto.urlPush || '').includes('conferenceDataVersion=1');
  chk(`${nombre} · conferenceData en el cuerpo`, tieneConf === esperaConf, `→ ${tieneConf}`);
  chk(`${nombre} · conferenceDataVersion en la URL`, urlConf === esperaConf, `→ ${urlConf}`);
}

console.log(`\n${fallos === 0 ? '✓ Calendar respeta la modalidad en los 6 escenarios.' : `✗ ${fallos} fallo(s).`}\n`);
process.exit(fallos === 0 ? 0 : 1);
