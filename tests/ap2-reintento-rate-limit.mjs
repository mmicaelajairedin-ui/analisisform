/* AP2 — el resumen semanal no se pierde por un limite de tasa.
 *
 * QUE PROTEGE
 * -----------
 * El run #15 (2026-08-31 14:38 UTC), el primero con AP2 en opt-out, salio en
 * `success` pero la entrega fue incompleta:
 *
 *   {"coaches":40,"enviados":30,"saltados":2,"errores":[8 x RateLimitError]}
 *
 *   ftcharlie95@gmail.com: RateLimitError: Rate limit exceeded for trace
 *   01a058418a9b7703883af5768f6a6b93. Retry after 32872ms.
 *
 * Las 8 comparten `trace`, y ese texto no lo produce `send-email` (devuelve
 * 502 con {ok:false,status,error}): es un `fetch` que LANZO. Quien corta es la
 * plataforma, limitando las invocaciones anidadas notif-coach -> send-email.
 * El bucle no reintentaba, asi que 8 de 40 coaches se quedaron sin resumen.
 *
 * Estas pruebas fijan el arreglo Y sus limites: que reintente el limite de
 * tasa, que NO reintente nada mas (un reintento a ciegas duplicaria emails) y
 * que la cuenta final siga cuadrando.
 *
 * Correr:  node --experimental-strip-types tests/ap2-reintento-rate-limit.mjs
 */
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const RAIZ = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const MOD = path.join(RAIZ, 'supabase/functions/notif-coach/enviar.ts');
const {
  enviarConReintento, esperaPorLimiteDeTasa,
  ESPERA_POR_DEFECTO_MS, ESPERA_MAX_MS, REINTENTOS_MAX, PRESUPUESTO_MS,
} = await import(MOD);

let fallos = 0;
const linea = (t, ok, extra = '') => {
  if (!ok) fallos++;
  console.log(`  ${ok ? 'PASS ' : 'FALLA'}  ${t.padEnd(58)} ${extra}`);
};

/* Utilidades ------------------------------------------------------------ */

// El error EXACTO del run #15, tal y como llego a produccion.
const rateLimitReal = () => {
  const e = new Error(
    'Rate limit exceeded for trace 01a058418a9b7703883af5768f6a6b93. ' +
    'Retry after 32872ms.');
  e.name = 'RateLimitError';
  return e;
};

const ok = () => ({ ok: true, status: 200 });
const noOk = (status) => ({ ok: false, status, headers: new Headers() });

/** Entorno de prueba: reloj y sueno falsos, para no esperar 30 s de verdad. */
function entorno(opts = {}) {
  const dormido = [];
  let reloj = 0;
  return {
    dormido,
    get transcurrido() { return reloj; },
    env: {
      fetchImpl: opts.fetchImpl,
      dormir: async (ms) => { dormido.push(ms); reloj += ms; },
      ahora: () => reloj,
      inicio: 0,
      ...(opts.reintentosMax !== undefined ? { reintentosMax: opts.reintentosMax } : {}),
    },
    // Avanza el reloj sin dormir (para simular tiempo ya consumido).
    avanzar: (ms) => { reloj += ms; },
  };
}

/* ─────────────────────────────────────────────────────────────────────────
 * 1. RateLimitError -> espera -> envio correcto
 * ───────────────────────────────────────────────────────────────────────── */
console.log('\n1 · RateLimitError → espera → se envia');

{
  let n = 0;
  const e = entorno({ fetchImpl: async () => { n++; if (n === 1) throw rateLimitReal(); return ok(); } });
  const r = await enviarConReintento('u', {}, e.env);
  linea('el email acaba enviandose', r.estado === 'enviado', `estado=${r.estado}`);
  linea('costo exactamente 2 intentos', r.intentos === 2, `intentos=${r.intentos}`);
  linea('espero UNA vez', e.dormido.length === 1, `esperas=${e.dormido.length}`);
  linea('respeto el "Retry after 32872ms" del proveedor',
    e.dormido[0] === 32872, `espero=${e.dormido[0]}ms`);
}

{
  // Dos rechazos seguidos: agota los reintentos y aun asi entrega.
  let n = 0;
  const e = entorno({ fetchImpl: async () => { n++; if (n <= 2) throw rateLimitReal(); return ok(); } });
  const r = await enviarConReintento('u', {}, e.env);
  linea('aguanta dos rechazos seguidos y entrega', r.estado === 'enviado', `intentos=${r.intentos}`);
  linea('no gasta mas reintentos de los permitidos',
    r.intentos === REINTENTOS_MAX + 1, `max=${REINTENTOS_MAX + 1}`);
}

{
  // Rechazo permanente: se rinde, no entra en bucle infinito.
  let n = 0;
  const e = entorno({ fetchImpl: async () => { n++; throw rateLimitReal(); } });
  const r = await enviarConReintento('u', {}, e.env);
  linea('si nunca deja de rechazar, se rinde', r.estado === 'error', `estado=${r.estado}`);
  linea('llamo al proveedor 1 + REINTENTOS_MAX veces',
    n === REINTENTOS_MAX + 1, `llamadas=${n}`);
  linea('el error conserva el texto del proveedor',
    /RateLimitError/.test(r.detalle), r.detalle.slice(0, 40));
}

/* ─────────────────────────────────────────────────────────────────────────
 * 2. Error que NO es limite de tasa -> NO se reintenta
 *    (un reintento a ciegas es lo que podria duplicar un email)
 * ───────────────────────────────────────────────────────────────────────── */
console.log('\n2 · Cualquier otro fallo NO se reintenta');

for (const [nombre, lanzar] of [
  ['corte de red ("Failed to fetch")', () => { throw new TypeError('Failed to fetch'); }],
  ['timeout / abort', () => { const e = new Error('The signal has been aborted'); e.name = 'AbortError'; throw e; }],
  ['500 de send-email', () => noOk(500)],
  ['502 de send-email (fallo de Brevo)', () => noOk(502)],
  ['400 payload invalido', () => noOk(400)],
]) {
  let n = 0;
  const e = entorno({ fetchImpl: async () => { n++; return lanzar(); } });
  const r = await enviarConReintento('u', {}, e.env);
  linea(nombre, r.estado === 'error' && n === 1 && e.dormido.length === 0,
    `llamadas=${n} esperas=${e.dormido.length}`);
}

{
  // La respuesta se pierde DESPUES de que el proveedor pudo aceptarla: es el
  // caso ambiguo. No se reintenta — un digest duplicado es peor que uno que
  // falta. Esta es la garantia anti-duplicado del punto 4.
  let n = 0;
  const e = entorno({ fetchImpl: async () => { n++; throw new Error('connection reset by peer'); } });
  const r = await enviarConReintento('u', {}, e.env);
  linea('respuesta perdida (ambigua) → NO se reenvia',
    r.estado === 'error' && n === 1, `llamadas=${n}`);
}

/* ─────────────────────────────────────────────────────────────────────────
 * 3. Clasificacion: que cuenta como limite de tasa y cuanto se espera
 * ───────────────────────────────────────────────────────────────────────── */
console.log('\n3 · Clasificacion del fallo y espera sugerida');

linea('el error real del run #15 se reconoce',
  esperaPorLimiteDeTasa(rateLimitReal()) === 32872);
linea('sin "Retry after" → backoff conservador',
  esperaPorLimiteDeTasa(Object.assign(new Error('rate limit exceeded'), { name: 'RateLimitError' }))
    === ESPERA_POR_DEFECTO_MS, `${ESPERA_POR_DEFECTO_MS}ms`);
linea('una espera absurda se acota al techo',
  esperaPorLimiteDeTasa(Object.assign(new Error('Retry after 999999ms'), { name: 'RateLimitError' }))
    === ESPERA_MAX_MS, `${ESPERA_MAX_MS}ms`);
{
  const h = new Headers({ 'retry-after': '5' });
  linea('HTTP 429 con Retry-After en segundos',
    esperaPorLimiteDeTasa({ status: 429, headers: h }) === 5000);
}
{
  const h = new Headers({ 'retry-after-ms': '1200' });
  linea('HTTP 429 con retry-after-ms',
    esperaPorLimiteDeTasa({ status: 429, headers: h }) === 1200);
}
linea('HTTP 429 sin cabecera → backoff conservador',
  esperaPorLimiteDeTasa({ status: 429, headers: new Headers() }) === ESPERA_POR_DEFECTO_MS);
{
  // Si el error llega con `status` Y mensaje, gana el valor concreto del
  // proveedor, no el backoff por defecto.
  const e = Object.assign(new Error('Rate limit exceeded. Retry after 7500ms.'),
    { name: 'RateLimitError', status: 429, headers: new Headers({ 'retry-after': '99' }) });
  linea('con status + mensaje, manda el "Retry after" concreto',
    esperaPorLimiteDeTasa(e) === 7500, `${esperaPorLimiteDeTasa(e)}ms`);
}
{
  // Un cuerpo que menciona "rate limit" pero con status 500 NO es un rechazo
  // por limite de tasa: es send-email fallando por otra cosa.
  const r = { status: 500, headers: new Headers(), message: 'rate limit downstream' };
  linea('un 500 que menciona "rate limit" NO se reintenta',
    esperaPorLimiteDeTasa(r) === null);
}
linea('un 502 NO es limite de tasa', esperaPorLimiteDeTasa(noOk(502)) === null);
linea('un corte de red NO es limite de tasa',
  esperaPorLimiteDeTasa(new TypeError('Failed to fetch')) === null);
linea('null/undefined no rompen el clasificador',
  esperaPorLimiteDeTasa(null) === null && esperaPorLimiteDeTasa(undefined) === null);

/* ─────────────────────────────────────────────────────────────────────────
 * 4. Presupuesto de tiempo: nunca dejar que curl corte la llamada
 * ───────────────────────────────────────────────────────────────────────── */
console.log('\n4 · Presupuesto de tiempo (curl --max-time 200)');

{
  const e = entorno({ fetchImpl: async () => { throw rateLimitReal(); } });
  e.avanzar(PRESUPUESTO_MS - 1000);          // casi agotado
  const r = await enviarConReintento('u', {}, e.env);
  linea('si no cabe la espera, no espera', e.dormido.length === 0, `esperas=${e.dormido.length}`);
  linea('y lo anota como error explicito',
    r.estado === 'error' && /sin tiempo para reintentar/.test(r.detalle), r.detalle.slice(-32));
}

/* ─────────────────────────────────────────────────────────────────────────
 * 5. El digest completo: opt-out, test/demo, sin email, y la cuenta final
 *    Reproduce el bucle de index.ts sobre la foto real del run #15.
 * ───────────────────────────────────────────────────────────────────────── */
console.log('\n5 · Digest completo — filtros y cuenta final');

/** Mismo filtrado que index.ts (AP2): sale salvo baja explicita. */
function seSalta(u) {
  const cfg = u.configuracion || {};
  const notifs = cfg.notifs || {};
  if (notifs.weeklyReport === false || !u.email) return true;
  if (cfg.cuenta_test === true || cfg.demo === true) return true;
  return false;
}

async function digest(coaches, fetchImpl) {
  const res = { coaches: coaches.length, enviados: 0, saltados: 0, reintentos: 0, errores: [] };
  const e = entorno({ fetchImpl });
  for (const u of coaches) {
    if (seSalta(u)) { res.saltados++; continue; }
    const r = await enviarConReintento(u.email, {}, e.env);
    res.reintentos += r.intentos - 1;
    if (r.estado === 'enviado') res.enviados++;
    else res.errores.push(`${u.email}: ${r.detalle}`);
  }
  return res;
}

{
  const coaches = [
    { email: 'a@x.com' },
    { email: 'b@x.com', configuracion: { notifs: { weeklyReport: false } } },  // opt-out
    { email: 'c@x.com', configuracion: { notifs: { weeklyReport: true } } },   // opt-in explicito
    { email: 'd@x.com', configuracion: { cuenta_test: true } },                // cuenta de prueba
    { email: 'e@x.com', configuracion: { demo: true } },                       // demo
    { email: '', nombre: 'sin email' },                                        // sin email
    { email: 'g@x.com', configuracion: {} },                                   // sin notifs
  ];
  const recibieron = [];
  const r = await digest(coaches, async (url) => { recibieron.push(url); return ok(); });

  linea('opt-out (weeklyReport=false) NO recibe', !recibieron.includes('b@x.com'),
    recibieron.join(' '));
  linea('cuenta de prueba y demo NO reciben',
    !recibieron.includes('d@x.com') && !recibieron.includes('e@x.com'));
  linea('un opt-in explicito SI recibe', recibieron.includes('c@x.com'));
  linea('sin `notifs` configurado SI recibe (opt-out, no opt-in)',
    recibieron.includes('g@x.com'));
  linea('se envia a los 3 que corresponden', r.enviados === 3, `enviados=${r.enviados}`);
  linea('se saltan los 4 excluidos', r.saltados === 4, `saltados=${r.saltados}`);
  linea('sin errores', r.errores.length === 0);
  linea('enviados + saltados + errores = coaches',
    r.enviados + r.saltados + r.errores.length === r.coaches, `${r.coaches}`);
}

{
  // La foto del run #15: 40 coaches, 2 saltados, y el limite pega a partir del
  // 31. Con el arreglo, los 8 que se perdian ahora entran.
  const coaches = Array.from({ length: 40 }, (_, i) => ({ email: `c${i}@x.com` }));
  coaches[7].configuracion = { notifs: { weeklyReport: false } };
  coaches[19].configuracion = { cuenta_test: true };

  let intentosCrudos = 0, cupo = 30;
  const r = await digest(coaches, async () => {
    intentosCrudos++;
    // Cupo que se agota y se recarga cuando alguien espera (como una tasa real).
    if (cupo <= 0) { cupo = 8; throw rateLimitReal(); }
    cupo--;
    return ok();
  });

  linea('los 38 destinatarios reciben (antes: 30)', r.enviados === 38, `enviados=${r.enviados}`);
  linea('los 2 saltados siguen saltados', r.saltados === 2, `saltados=${r.saltados}`);
  linea('cero errores (antes: 8 RateLimitError)', r.errores.length === 0,
    r.errores.slice(0, 1).join('') || '—');
  linea('la cuenta cuadra', r.enviados + r.saltados + r.errores.length === 40, `${r.coaches}`);
  linea('los reintentos quedan contabilizados', r.reintentos > 0, `reintentos=${r.reintentos}`);
}

{
  // Mezcla: un limite de tasa recuperable y un 502 que no lo es. Cada uno a lo
  // suyo, y la suma sigue cuadrando.
  const coaches = [{ email: 'a@x.com' }, { email: 'b@x.com' }, { email: 'c@x.com' }];
  let n = 0;
  const r = await digest(coaches, async () => {
    n++;
    if (n === 1) throw rateLimitReal();  // a → reintenta y entra
    if (n === 3) return noOk(502);       // b → no se reintenta
    return ok();                          // c
  });
  linea('el recuperable entra, el 502 no', r.enviados === 2 && r.errores.length === 1,
    `enviados=${r.enviados} errores=${r.errores.length}`);
  linea('el 502 no genero reintentos', r.reintentos === 1, `reintentos=${r.reintentos}`);
  linea('la cuenta cuadra con errores mezclados',
    r.enviados + r.saltados + r.errores.length === r.coaches);
}

console.log(`\n${fallos === 0 ? 'TODO OK' : `${fallos} FALLO(S)`}\n`);
process.exit(fallos === 0 ? 0 : 1);
