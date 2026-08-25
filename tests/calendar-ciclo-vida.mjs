/* El ciclo de vida del evento de Google: crear → mover → cancelar.
 *
 * Una cita tiene UN evento, y `citas.google_event_id` es la referencia estable.
 * Lo que estas pruebas impiden:
 *   · que reprogramar cree un segundo evento y deje el primero vivo;
 *   · que cancelar deje un evento fantasma en el calendario del coach;
 *   · que actualizar cambie la modalidad, el room de la Sala o el enlace;
 *   · que una cita histórica sin id se "arregle" fabricando un duplicado.
 *
 * Se ejecutan las funciones REALES con `fetch` interceptado. Sin red.
 *
 * Correr:  node --experimental-strip-types tests/calendar-ciclo-vida.mjs
 */
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const RAIZ = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const COACH = '99270bc1-bc56-4e0a-b978-3d58d3f8b848';
const ID = 101;
const SALA = `https://pathwaycareercoach.com/sala.html?room=${encodeURIComponent('Pathway-' + COACH + '-' + ID)}`;
const ZOOM = 'https://us05web.zoom.us/j/1234567890';
const MEET = 'https://meet.google.com/abc-defg-hij';
const MEET2 = 'https://meet.google.com/zzz-yyyy-xxx';
const EVT = 'gcal_evt_original';

globalThis.Deno = {
  env: { get: (k) => ({ SUPABASE_URL: 'https://sb.test', SUPABASE_SERVICE_ROLE_KEY: 'svc' }[k] || '') },
  serve: (h) => { globalThis.__h = h; },
};

/** Base de datos falsa de UNA cita, más el registro de lo que se le pidió a Google. */
function mundo(cita, { googleDa = MEET, estadoGoogle = 200 } = {}) {
  const fila = { ...cita };
  const log = { pushes: [], creados: 0, actualizados: 0, borrados: 0 };
  globalThis.fetch = async (url, opts = {}) => {
    const u = String(url);
    let body = null;
    if (typeof opts.body === 'string') { try { body = JSON.parse(opts.body); } catch { /* no json */ } }
    const ok = (d) => ({ ok: true, status: 200, json: async () => d });

    if (u.includes('/rest/v1/citas?id=eq.') && u.includes('select=*')) return ok([{ ...fila }]);
    if (u.includes('/rest/v1/citas?id=eq.')) { Object.assign(fila, body); return ok(null); }

    if (u.includes('/functions/v1/gcal-push')) {
      log.pushes.push(body);
      if (body.op === 'cancel') { log.borrados++; return ok({ ok: estadoGoogle === 410 || estadoGoogle === 200 }); }
      if (estadoGoogle !== 200) return ok({ ok: false, reason: 'write_failed', status: estadoGoogle });
      if (body.op === 'update') log.actualizados++; else log.creados++;
      // Google solo devuelve conferencia si se le pidió.
      return ok({ ok: true, event_id: body.event_id || EVT, hangoutLink: body.event.conferencia ? googleDa : '' });
    }
    throw new Error('fetch no previsto: ' + u);
  };
  return { fila, log };
}

let H = null;
async function sync(payload) {
  if (!H) { await import(pathToFileURL(path.join(RAIZ, 'supabase/functions/sync-cita-to-gcal/index.ts')).href); H = globalThis.__h; }
  const r = await H(new Request('https://x/f', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) }));
  return r.json();
}

let fallos = 0;
const chk = (t, ok, extra = '') => { if (!ok) fallos++; console.log(`    ${ok ? 'PASS ' : 'FALLA'}  ${t.padEnd(48)}${extra}`); };

const base = { id: ID, coach_id: COACH, nombre: 'Sesión', inicio: '2026-09-01T09:00:00.000Z', grupal: false, google_event_id: null };

/* ── A–D · el ciclo completo de las cuatro modalidades ────────────────── */
const CICLOS = [
  ['A · Meet',       { modalidad: 'online', video_proveedor: 'meet', meet_link: null }, MEET, true],
  ['B · Sala',       { modalidad: 'online', video_proveedor: 'sala', meet_link: null }, SALA, false],
  ['C · Zoom',       { modalidad: 'online', video_proveedor: 'zoom', meet_link: ZOOM }, ZOOM, false],
  ['D · Presencial', { modalidad: 'presencial', video_proveedor: 'presencial', lugar: 'C/ Mayor 1', meet_link: null }, '', false],
];

console.log('\n╔══ A–D · crear → mover → cancelar, por modalidad ══════════════════════\n');
for (const [titulo, extra, urlEsperada, esperaConferencia] of CICLOS) {
  console.log(`  ${titulo}`);
  const { fila, log } = mundo({ ...base, ...extra });

  // CREAR
  const c = await sync({ cita_id: ID, op: 'crear' });
  chk('crear · guarda google_event_id', fila.google_event_id === EVT, `→ ${fila.google_event_id}`);
  chk('crear · pide conferencia solo si es Meet', log.pushes[0].event.conferencia === esperaConferencia, `→ ${log.pushes[0].event.conferencia}`);
  chk('crear · enlace resuelto', (c.url || '') === urlEsperada, `→ ${c.url || '(vacío)'}`);
  const idTrasCrear = fila.google_event_id, enlaceTrasCrear = fila.meet_link;

  // MOVER (reprogramación): cambia la hora en la fila y se sincroniza
  fila.inicio = '2026-10-15T17:30:00.000Z';
  const m = await sync({ cita_id: ID, op: 'mover' });
  const push = log.pushes[log.pushes.length - 1];
  chk('mover · actualiza, NO crea', push.op === 'update' && log.creados === 1, `creados=${log.creados} actualizados=${log.actualizados}`);
  chk('mover · usa el mismo google_event_id', push.event_id === EVT, `→ ${push.event_id}`);
  chk('mover · el id no cambia', fila.google_event_id === idTrasCrear, `→ ${fila.google_event_id}`);
  chk('mover · el proveedor no cambia', (m.proveedor || fila.video_proveedor) === extra.video_proveedor, `→ ${m.proveedor}`);
  chk('mover · el enlace persistido no se pisa', fila.meet_link === enlaceTrasCrear, `→ ${fila.meet_link ?? 'null'}`);
  chk('mover · no pide conferencia nueva', push.event.conferencia === false, `→ ${push.event.conferencia}`);
  chk('mover · la HORA sí viaja a Google', push.event.startISO === '2026-10-15T17:30:00.000Z', '');
  if (extra.video_proveedor === 'sala') chk('mover · la Sala es la MISMA', fila.meet_link === SALA, '');

  // CANCELAR
  const x = await sync({ cita_id: ID, op: 'cancelar' });
  chk('cancelar · borra ese evento', log.borrados === 1 && x.cancelado === true, `borrados=${log.borrados}`);
  chk('cancelar · usa el mismo id', log.pushes[log.pushes.length - 1].event_id === EVT, '');
  chk('cancelar · limpia el id muerto', fila.google_event_id === null, `→ ${fila.google_event_id}`);
  chk('un solo evento en toda su vida', log.creados === 1, `creados=${log.creados}`);
  console.log('');
}

/* ── E · google_event_id NULL ─────────────────────────────────────────── */
console.log('╔══ E · cita histórica SIN google_event_id ════════════════════════════\n');
{
  const { fila, log } = mundo({ ...base, video_proveedor: 'sala', meet_link: SALA, google_event_id: null });
  const m = await sync({ cita_id: ID, op: 'mover' });
  chk('mover sin id · NO crea nada', log.creados === 0 && log.pushes.length === 0, `pushes=${log.pushes.length}`);
  chk('mover sin id · lo dice', m.ok === true && m.reason === 'sin_evento', `→ ${m.reason}`);
  chk('mover sin id · no inventa un id', fila.google_event_id === null, '');

  const x = await sync({ cita_id: ID, op: 'cancelar' });
  chk('cancelar sin id · no llama a Google', log.borrados === 0, '');
  chk('cancelar sin id · lo dice', x.ok === true && x.reason === 'sin_evento', `→ ${x.reason}`);

  const c = await sync({ cita_id: ID, op: 'crear' });
  chk('crear sin id · SÍ crea (es su trabajo)', log.creados === 1, `creados=${log.creados}`);
}

/* ── F · el evento ya no existe en Google ─────────────────────────────── */
console.log('\n╔══ F · el evento fue borrado a mano en Google ════════════════════════\n');
{
  const { fila, log } = mundo({ ...base, video_proveedor: 'sala', meet_link: SALA, google_event_id: EVT }, { estadoGoogle: 404 });
  const m = await sync({ cita_id: ID, op: 'mover' });
  chk('no crea un sustituto a ciegas', log.creados === 0, `creados=${log.creados}`);
  chk('lo dice', m.ok === false && m.reason === 'evento_inexistente', `→ ${m.reason}`);
  chk('limpia el id muerto', fila.google_event_id === null, `→ ${fila.google_event_id}`);
  chk('el enlace de la cita sigue intacto', fila.meet_link === SALA, '');
}

/* ── G · doble reprogramación ─────────────────────────────────────────── */
console.log('\n╔══ G · reprogramar dos veces ════════════════════════════════════════\n');
{
  const { fila, log } = mundo({ ...base, video_proveedor: 'meet', meet_link: null });
  await sync({ cita_id: ID, op: 'crear' });
  const idOriginal = fila.google_event_id, meetOriginal = fila.meet_link;
  fila.inicio = '2026-10-01T10:00:00.000Z'; await sync({ cita_id: ID, op: 'mover' });
  fila.inicio = '2026-11-02T12:00:00.000Z'; await sync({ cita_id: ID, op: 'mover' });
  chk('sigue habiendo UN solo evento', log.creados === 1 && log.actualizados === 2, `creados=${log.creados} actualizados=${log.actualizados}`);
  chk('el id nunca cambió', fila.google_event_id === idOriginal, `→ ${fila.google_event_id}`);
  chk('el enlace de Meet nunca cambió', fila.meet_link === meetOriginal && fila.meet_link === MEET, `→ ${fila.meet_link}`);
  chk('el proveedor sigue siendo meet', fila.video_proveedor === 'meet', `→ ${fila.video_proveedor}`);
}

/* ── H · cancelar después de reprogramar ──────────────────────────────── */
console.log('\n╔══ H · cancelar después de haber reprogramado ═══════════════════════\n');
{
  const { fila, log } = mundo({ ...base, video_proveedor: 'zoom', meet_link: ZOOM });
  await sync({ cita_id: ID, op: 'crear' });
  fila.inicio = '2026-10-01T10:00:00.000Z'; await sync({ cita_id: ID, op: 'mover' });
  const x = await sync({ cita_id: ID, op: 'cancelar' });
  chk('borra el evento que se movió', x.cancelado === true && log.borrados === 1, '');
  chk('con el id original', log.pushes[log.pushes.length - 1].event_id === EVT, '');
  chk('nunca hubo un segundo evento', log.creados === 1, `creados=${log.creados}`);
  chk('el enlace de Zoom jamás se tocó', fila.meet_link === ZOOM, `→ ${fila.meet_link}`);
}

/* ── I · re-sincronizar ───────────────────────────────────────────────── */
console.log('\n╔══ I · volver a sincronizar (op por defecto) ════════════════════════\n');
for (const [nombre, extra, enlace] of [
  ['meet', { video_proveedor: 'meet', meet_link: MEET }, MEET],
  ['sala', { video_proveedor: 'sala', meet_link: SALA }, SALA],
  ['zoom', { video_proveedor: 'zoom', meet_link: ZOOM }, ZOOM],
  ['presencial', { modalidad: 'presencial', video_proveedor: 'presencial', meet_link: null }, null],
]) {
  const { fila, log } = mundo({ ...base, ...extra, google_event_id: EVT }, { googleDa: MEET2 });
  await sync({ cita_id: ID });   // sin op → "crear", pero ya hay evento
  chk(`${nombre} · actualiza en vez de crear`, log.creados === 0 && log.actualizados === 1, `creados=${log.creados}`);
  chk(`${nombre} · el enlace no se pisa`, (fila.meet_link ?? null) === enlace, `→ ${fila.meet_link ?? 'null'}`);
  chk(`${nombre} · el proveedor no cambia`, fila.video_proveedor === extra.video_proveedor, `→ ${fila.video_proveedor}`);
  chk(`${nombre} · el id no cambia`, fila.google_event_id === EVT, '');
}

/* ── J · nunca dos eventos para la misma cita ─────────────────────────── */
console.log('\n╔══ J · doce operaciones seguidas, un solo evento ════════════════════\n');
{
  const { fila, log } = mundo({ ...base, video_proveedor: 'sala', meet_link: null });
  await sync({ cita_id: ID, op: 'crear' });
  for (let i = 0; i < 5; i++) { fila.inicio = `2026-10-0${i + 1}T10:00:00.000Z`; await sync({ cita_id: ID, op: 'mover' }); }
  for (let i = 0; i < 5; i++) await sync({ cita_id: ID });   // re-sincronizaciones
  chk('creados = 1', log.creados === 1, `→ ${log.creados}`);
  chk('actualizados = 10', log.actualizados === 10, `→ ${log.actualizados}`);
  chk('la Sala es la misma tras 10 cambios', fila.meet_link === SALA, `→ ${fila.meet_link}`);
  chk('ninguna operación pidió conferencia', log.pushes.every((p) => p.event.conferencia === false), '');
}

console.log(`\n${fallos === 0 ? '✓ Un evento por cita, estable, y las modalidades se conservan.' : `✗ ${fallos} fallo(s).`}\n`);
process.exit(fallos === 0 ? 0 : 1);
