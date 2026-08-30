/**
 * editar-coach-red · mc_permisos — prueba de contrato, sin red y sin base.
 *
 * QUÉ PRUEBA Y POR QUÉ
 *
 * `usuarios.configuracion` es un JSONB COMPARTIDO. Ahí viven claves de Pathway
 * —`member_role`, `no_da_clases`, `servicios`, `especialidad`,
 * `pendiente_activacion`, `stripe_account_id`— y, desde este cambio, también
 * `mc_permisos`, que es de MultiCoach y que Pathway ni lee ni interpreta.
 *
 * El riesgo real de un JSONB compartido es que un escritor pise al otro sin
 * que nadie se entere: PostgREST no mezcla JSONB, así que esta función lee la
 * configuración actual, muta lo suyo y la reescribe entera. Si un bloque
 * reconstruyera el objeto desde cero, se llevaría por delante lo del vecino y
 * la llamada seguiría devolviendo `{ok:true}`.
 *
 * Por eso las dos comprobaciones que más valen son las de PRESERVACIÓN, y van
 * en las dos direcciones:
 *
 *   P-2  escribir `mc_permisos` NO toca ninguna clave de Pathway
 *   P-3  escribir `permisos` (negocio/perfil_publico/marketplace) NO borra
 *        `mc_permisos`
 *   P-3b escribir member_role, servicios o especialidad tampoco lo borra
 *
 * CÓMO, sin depender de nada externo: se shimea `Deno`, se carga el `index.ts`
 * TAL CUAL —con el despojado de tipos de Node, no con expresiones regulares,
 * para que lo que se prueba sea exactamente lo que se despliega— y detrás se
 * pone un PostgREST de mentira que devuelve SOLO las columnas pedidas en el
 * `select`. Eso último no es un detalle: es lo que caza el olvido de pedir una
 * columna.
 *
 * Lleva CANARIO: se muta el propio código quitándole la línea que guarda y se
 * exige que la prueba se ponga roja. Un verificador que no puede fallar no
 * demuestra nada.
 *
 *   node --experimental-strip-types scripts/probar-editar-coach-red-mc-permisos.mjs
 *
 * Requiere Node 22+ (por el despojado de tipos). Corre en su propio workflow,
 * NO en `npm run verify`, para no obligar a subir la versión de Node del hook
 * de pre-commit, que va con la 20.
 */
import { readFileSync, writeFileSync, existsSync, mkdtempSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';

const AQUI = dirname(fileURLToPath(import.meta.url));
const FUNCION = resolve(AQUI, '../supabase/functions/editar-coach-red/index.ts');
const TMP = mkdtempSync(join(tmpdir(), 'ecr-'));
let cargas = 0;

const OWNER = 'duena@ejemplo.test';
const ORG = 'org-aaaa';
const COACH = 'usr-coach';
const AJENO = 'usr-ajeno';

/** La `configuracion` de partida: TODO lo que Pathway guarda ahí hoy. */
function configuracionInicial() {
  return {
    member_role: 'coach',
    no_da_clases: false,
    pendiente_activacion: false,
    especialidad: 'Nutrición',
    servicios: [{ name: 'Sesión', desc: '', price: 40, moneda: 'eur', recurrente: false }],
    permisos: { negocio: true, perfil_publico: false, marketplace: true },
    stripe_account_id: 'acct_123',
  };
}

function crearBase() {
  return {
    filas: {
      [COACH]: { id: COACH, org_id: ORG, email: 'coach@ejemplo.test', configuracion: configuracionInicial() },
      [AJENO]: { id: AJENO, org_id: 'org-zzzz', email: 'ajeno@ejemplo.test', configuracion: {} },
    },
    patches: 0,
  };
}

/** Devuelve solo las columnas del `select`, como hace PostgREST de verdad. */
function proyectar(fila, select) {
  if (!select) return { ...fila };
  const out = {};
  for (const col of select.split(',')) if (col in fila) out[col] = fila[col];
  return out;
}

async function ejecutar(fuente, { body, token = 'jwt-owner', base }) {
  const json = (b, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { 'Content-Type': 'application/json' } });

  const fetchFalso = async (url, init = {}) => {
    const u = new URL(url);

    if (u.pathname === '/auth/v1/user') {
      const auth = (init.headers || {}).Authorization || '';
      if (auth === 'Bearer jwt-owner') return json({ email: OWNER });
      if (auth === 'Bearer jwt-coach') return json({ email: 'coach@ejemplo.test' });
      return new Response('no', { status: 401 });
    }

    if (u.pathname === '/rest/v1/usuarios') {
      const select = u.searchParams.get('select');
      const method = init.method || 'GET';

      if (method === 'GET') {
        if (u.searchParams.get('rol') === 'eq.owner') {
          const email = decodeURIComponent((u.searchParams.get('email') || '').replace('eq.', ''));
          return json(email === OWNER ? [{ org_id: ORG }] : []);
        }
        const id = decodeURIComponent((u.searchParams.get('id') || '').replace('eq.', ''));
        const fila = base.filas[id];
        return json(fila ? [proyectar(fila, select)] : []);
      }

      if (method === 'PATCH') {
        const id = decodeURIComponent((u.searchParams.get('id') || '').replace('eq.', ''));
        const fila = base.filas[id];
        if (!fila) return new Response('no', { status: 404 });
        base.patches += 1;
        Object.assign(fila, JSON.parse(init.body));
        return new Response(null, { status: 204 });
      }
    }
    throw new Error(`El banco no cubre ${u.pathname}`);
  };

  let handler = null;
  globalThis.Deno = {
    env: {
      get: (k) =>
        ({
          SUPABASE_URL: 'https://falso.test',
          SUPABASE_SERVICE_ROLE_KEY: 'svc',
          SUPABASE_ANON_KEY: 'anon',
        })[k] || '',
    },
    serve: (h) => {
      handler = h;
    },
  };
  const fetchReal = globalThis.fetch;
  globalThis.fetch = fetchFalso;

  try {
    // Import FRESCO: la función registra su manejador al cargarse, y un módulo
    // ya importado no se vuelve a ejecutar.
    const destino = join(TMP, `ecr-${++cargas}.ts`);
    writeFileSync(destino, fuente);
    await import(pathToFileURL(destino).href);
    if (!handler) throw new Error('La función no registró ningún manejador');

    const res = await handler(
      new Request('https://falso.test/editar-coach-red', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    );
    const texto = await res.text();
    return { status: res.status, texto, data: texto ? JSON.parse(texto) : null };
  } finally {
    globalThis.fetch = fetchReal;
  }
}

/* ── El recorrido ─────────────────────────────────────────────────────── */

const resultados = [];
function comprobar(id, ok, detalle) {
  resultados.push({ id, ok, detalle });
  console.log(`${ok ? '✔' : '✘'} ${id} · ${detalle}`);
}

const MC = { v: 1, org_id: ORG, grants: ['view_team'] };
const CLAVES_PATHWAY = Object.keys(configuracionInicial());

if (!existsSync(FUNCION)) {
  console.error(`No está la función en ${FUNCION}. INCONCLUSO.`);
  process.exit(2);
}
const FUENTE = readFileSync(FUNCION, 'utf8');

// P-1 · el owner concede
{
  const base = crearBase();
  const r = await ejecutar(FUENTE, { body: { coach_id: COACH, mc_permisos: MC }, base });
  const guardado = base.filas[COACH].configuracion.mc_permisos;
  comprobar(
    'P-1',
    r.status === 200 && r.data?.ok === true && JSON.stringify(guardado) === JSON.stringify(MC),
    `guardado ${JSON.stringify(guardado)} · respuesta ${JSON.stringify(r.data)}`,
  );

  // P-2 · PRESERVACIÓN, dirección A: escribir mc_permisos no toca lo de Pathway
  const antes = configuracionInicial();
  const despues = base.filas[COACH].configuracion;
  const alteradas = CLAVES_PATHWAY.filter(
    (k) => JSON.stringify(antes[k]) !== JSON.stringify(despues[k]),
  );
  comprobar(
    'P-2',
    alteradas.length === 0,
    alteradas.length === 0
      ? `las ${CLAVES_PATHWAY.length} claves de Pathway intactas, comparadas una a una: ${CLAVES_PATHWAY.join(', ')}`
      : `ALTERADAS: ${alteradas.join(', ')}`,
  );
}

// P-3 · PRESERVACIÓN, dirección B: escribir los TRES permisos no borra mc_permisos
{
  const base = crearBase();
  base.filas[COACH].configuracion.mc_permisos = { ...MC };
  const r = await ejecutar(FUENTE, {
    body: { coach_id: COACH, permisos: { negocio: false } },
    base,
  });
  const d = base.filas[COACH].configuracion;
  comprobar(
    'P-3',
    r.status === 200 &&
      JSON.stringify(d.mc_permisos) === JSON.stringify(MC) &&
      d.permisos.negocio === false &&
      d.permisos.perfil_publico === false &&
      d.permisos.marketplace === true,
    `mc_permisos idéntico; sus tres claves quedan ${JSON.stringify(d.permisos)}`,
  );
}

// P-3b · y tampoco lo borran los otros escritores de esta misma función
{
  const casos = [
    ['member_role', { member_role: 'colaborador' }],
    ['servicios', { servicios: [{ name: 'Otro', price: 10 }] }],
    ['especialidad', { especialidad: 'Fuerza' }],
    ['nombre', { nombre: 'Nombre Nuevo' }],
  ];
  let ok = true;
  const dichos = [];
  for (const [nombre, extra] of casos) {
    const base = crearBase();
    base.filas[COACH].configuracion.mc_permisos = { ...MC };
    await ejecutar(FUENTE, { body: { coach_id: COACH, ...extra }, base });
    const sigue = JSON.stringify(base.filas[COACH].configuracion.mc_permisos) === JSON.stringify(MC);
    if (!sigue) ok = false;
    dichos.push(`${nombre}: ${sigue ? 'intacto' : 'BORRADO'}`);
  }
  comprobar('P-3b', ok, dichos.join(' · '));
}

// P-4 · retirar
{
  const base = crearBase();
  base.filas[COACH].configuracion.mc_permisos = { ...MC };
  const vacio = { v: 1, org_id: ORG, grants: [] };
  await ejecutar(FUENTE, { body: { coach_id: COACH, mc_permisos: vacio }, base });
  const g = base.filas[COACH].configuracion.mc_permisos;
  comprobar(
    'P-4',
    !!g && Array.isArray(g.grants) && g.grants.length === 0 && g.org_id === ORG,
    `la clave existe, su lista está vacía y conserva su organización: ${JSON.stringify(g)}`,
  );
}

// P-5 · la puerta no cambió: un coach no puede
{
  const base = crearBase();
  const r = await ejecutar(FUENTE, {
    body: { coach_id: COACH, mc_permisos: MC },
    token: 'jwt-coach',
    base,
  });
  comprobar(
    'P-5',
    r.status === 403 && r.data?.error === 'not_owner' && base.patches === 0,
    `${r.status} ${r.texto} · escrituras: ${base.patches}`,
  );
}

// P-6 · destinatario de otra organización
{
  const base = crearBase();
  const r = await ejecutar(FUENTE, { body: { coach_id: AJENO, mc_permisos: MC }, base });
  comprobar(
    'P-6',
    r.status === 403 && r.data?.error === 'coach_ajeno' && base.patches === 0,
    `${r.status} ${r.texto} · escrituras: ${base.patches}`,
  );
}

// P-7 · forma inválida → 400 y CERO escrituras
{
  const casos = [
    ['grants no es array', { v: 1, org_id: ORG, grants: 'view_team' }],
    ['más de 32', { v: 1, org_id: ORG, grants: Array.from({ length: 33 }, (_, i) => `p${i}`) }],
    ['cadena de más de 64', { v: 1, org_id: ORG, grants: ['x'.repeat(65)] }],
    ['no es objeto', 'view_team'],
    ['es un array', ['view_team']],
    ['sin v', { org_id: ORG, grants: [] }],
    ['sin org_id', { v: 1, grants: [] }],
    ['grants con un número', { v: 1, org_id: ORG, grants: ['view_team', 7] }],
  ];
  let ok = true;
  const dichos = [];
  for (const [nombre, mc] of casos) {
    const base = crearBase();
    const r = await ejecutar(FUENTE, { body: { coach_id: COACH, mc_permisos: mc }, base });
    const bien = r.status === 400 && r.data?.error === 'mc_permisos_invalido' && base.patches === 0;
    if (!bien) ok = false;
    dichos.push(`${nombre}: ${r.status}/${base.patches}`);
  }
  comprobar('P-7', ok, `400 y cero escrituras en los ${casos.length} · ${dichos.join(' · ')}`);
}

// P-8 · cadenas desconocidas dentro de los límites: verbatim
{
  const base = crearBase();
  const raro = { v: 1, org_id: ORG, grants: ['view_team', 'permiso_del_futuro'] };
  await ejecutar(FUENTE, { body: { coach_id: COACH, mc_permisos: raro }, base });
  const g = base.filas[COACH].configuracion.mc_permisos;
  comprobar(
    'P-8',
    JSON.stringify(g) === JSON.stringify(raro),
    'se almacenan verbatim: el vocabulario es de MultiCoach, y validarlo aquí ataría cada permiso suyo a un despliegue de esta función',
  );
}

// P-9 · sin el campo, el comportamiento es EXACTAMENTE el de antes
{
  const base = crearBase();
  base.filas[COACH].configuracion.mc_permisos = { ...MC };
  const r = await ejecutar(FUENTE, { body: { coach_id: COACH, nombre: 'Nombre Nuevo' }, base });
  const f = base.filas[COACH];
  // La respuesta serializada no puede llevar la clave nueva: `JSON.stringify`
  // omite `undefined`, así que un cliente viejo ve exactamente lo de siempre.
  const sinRastro = !('mc_permisos' in JSON.parse(r.texto));
  comprobar(
    'P-9',
    r.status === 200 && f.nombre === 'Nombre Nuevo' && sinRastro &&
      JSON.stringify(f.configuracion.mc_permisos) === JSON.stringify(MC),
    `respuesta sin la clave nueva (${r.texto}) y mc_permisos sin tocar`,
  );

  const base2 = crearBase();
  const r2 = await ejecutar(FUENTE, { body: { coach_id: COACH }, base2: null, base: base2 });
  comprobar(
    'P-9b',
    r2.status === 400 && r2.data?.error === 'nothing_to_update' && base2.patches === 0,
    `un cuerpo vacío sigue dando ${r2.texto}`,
  );
}

/* ── Canario ──────────────────────────────────────────────────────────── */
{
  const mutado = FUENTE.replace(
    'cfg.mc_permisos = { v: o.v, org_id: o.org_id, grants: grants as string[] };',
    '/* mutado: no guarda */',
  );
  if (mutado === FUENTE) {
    console.log('\n✘ CANARIO · no se pudo mutar el código: el banco no puede demostrar nada. INCONCLUSO.');
    process.exit(2);
  }
  const base = crearBase();
  await ejecutar(mutado, { body: { coach_id: COACH, mc_permisos: MC }, base });
  const detecta = base.filas[COACH].configuracion.mc_permisos === undefined;
  console.log(`\n${detecta ? '✔' : '✘'} CANARIO · quitando la línea que guarda, P-1 se pone rojo`);
  if (!detecta) {
    console.log('El banco NO detecta la mutación: su verde no vale. INCONCLUSO.');
    process.exit(2);
  }
}

const fallos = resultados.filter((r) => !r.ok);
console.log(`\n${resultados.length - fallos.length}/${resultados.length} comprobaciones OK`);
if (fallos.length) {
  console.log(`FALLAN: ${fallos.map((f) => f.id).join(', ')}`);
  process.exit(1);
}
