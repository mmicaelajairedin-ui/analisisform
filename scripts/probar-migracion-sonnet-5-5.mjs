/**
 * Migración claude-sonnet-4-5 → claude-sonnet-5-5 — prueba de CONTRATO, sin
 * red, sin clave y sin base.
 *
 * QUÉ FIJA, y por qué hacía falta
 *
 * Sonnet 4.5 se retira el 30-11-2026 (página oficial de deprecaciones). Las
 * cuatro funciones de texto leían `content[0].text`, y Sonnet 5.5 puede
 * empezar la respuesta con un bloque `thinking` vacío: el informe saldría en
 * blanco. Esta prueba ejecuta las funciones REALES —la versión de `main` y la
 * migrada— contra una API de Anthropic simulada y exige:
 *
 *   M-1  Misma petición en lo que importa: el prompt de sistema, los mensajes
 *        y el `max_tokens` de cada ruta son IDÉNTICOS a los de `main`. La
 *        migración no toca ni una palabra de los prompts.
 *   M-2  La petición nueva: modelo `claude-sonnet-5-5`, `thinking:
 *        between_tools`, effort `high`, sin `temperature`/`top_p`/`top_k`,
 *        misma `anthropic-version`.
 *   M-3  Ante la respuesta con la forma de Sonnet 4.5 (solo texto), la versión
 *        migrada devuelve EXACTAMENTE lo mismo que `main`.
 *   M-4  Ante la forma de Sonnet 5.5 (bloque `thinking` vacío delante), la
 *        migrada devuelve lo mismo que `main` con 4.5 — y `main` se ROMPE con
 *        esa forma: es la prueba en rojo de que el defecto existía (C4).
 *   M-5  Un rechazo (`stop_reason: refusal`) sigue el mismo camino que ya
 *        seguía `main`, y además queda escrito en el log con su categoría.
 *   M-6  Un error HTTP de la API produce la misma respuesta que en `main`.
 *
 * Lleva CANARIOS: tres mutaciones del módulo compartido que la prueba tiene
 * que poner en rojo, cada una por su propia aserción.
 *
 *   node --experimental-strip-types scripts/probar-migracion-sonnet-5-5.mjs
 *
 * La versión de referencia sale de git: `REF_ORIGINAL` (por defecto
 * origin/main). En CI hace falta el historial (`fetch-depth: 0`).
 */
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CASOS, COACHES } from './casos-claude-sonnet-5-5.mjs';
import { cargarFuncion, supabaseDePrueba } from './_cargar-funcion-claude.mjs';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, '..');
const FN = join(RAIZ, 'supabase/functions');
const REF = process.env.REF_ORIGINAL || 'origin/main';
const FUNCIONES = ['generar-informe', 'ia-pathway', 'recomendar-coach', 'generar-perfil-coach'];

const nuevo = Object.fromEntries(FUNCIONES.map((f) => [f, readFileSync(join(FN, f, 'index.ts'), 'utf8')]));
const COMPARTIDO = readFileSync(join(FN, '_shared/claude/mensajes.ts'), 'utf8');
const original = Object.fromEntries(FUNCIONES.map((f) => [f,
  execFileSync('git', ['show', `${REF}:supabase/functions/${f}/index.ts`], { cwd: RAIZ, encoding: 'utf8' })]));

// ── Respuestas simuladas por caso: lo que devolvería un modelo que acierta ──
const INFORME = JSON.stringify({ resumen: 'r', fortalezas: ['a'], gaps: ['b'], estrategia: 'e', mercado: 'm', nicho: 'n', cv_acciones: ['1', '2', '3'], linkedin_acciones: ['1', '2', '3'], networking_acciones: ['1', '2', '3'], preguntas: ['p'], alertas: [], mensaje_candidato: 'm', scores: [{ label: 'x', val: 5 }] });
const SIMULADO = {
  'informe-carrera': INFORME, 'informe-fitness': INFORME, 'informe-life': INFORME,
  'sugerir-empleos': JSON.stringify({ empleos: [1, 2, 3, 4, 5].map((n) => ({ titulo: `Puesto ${n}`, empresa_tipo: 'Fintech', relevancia: 'alta', descripcion: 'd', requisitos: ['r'], salario_rango: '-', query_indeed: 'q' })) }),
  'cv-express-es': JSON.stringify({ cv_optimizado: { nombre: 'M', experiencia: [{ rol: 'A', empresa: 'E', logros: ['l'] }] }, carta: 'Carta. '.repeat(60), linkedin_analisis: { score_actual: 50, titular_propuesto: 't' } }),
  'cv-express-en': JSON.stringify({ cv_optimizado: { nombre: 'M', experiencia: [{ rol: 'A', empresa: 'E', logros: ['l'] }] }, carta: 'Dear team, '.repeat(40), linkedin_analisis: { score_actual: 50, titular_propuesto: 't' } }),
  'traducir-express': JSON.stringify({ carta: 'Dear hiring team, I am applying.', cv_optimizado: { nombre: 'M', rol_objetivo: 'Data Scientist' } }),
  'analizar-linkedin': JSON.stringify({ linkedin_analisis: { titular_propuesto: 't', acerca_de_propuesto: 'a' } }),
  'chat-coach': 'En «Clientes», completá el nombre y el email y tocá «Enviar invitación».',
  'chat-cliente-contexto': 'Esta semana te toca terminar el CV. El jueves tenés sesión.',
  'chat-varios-turnos': 'Usá el link de reservas que dejó tu coach.',
  'chat-fuera-de-alcance': 'Eso lo tiene que ver el equipo de Pathway. [[ESCALAR]]',
  'recomendar-con-area': JSON.stringify({ matches: [{ slug: 'coach-carrera-cuatro', razon: 'Optimiza perfiles de LinkedIn técnicos.' }] }),
  'recomendar-sin-area': JSON.stringify({ matches: [{ slug: 'coach-life-tres', razon: 'Trabaja claridad y propósito.' }] }),
  'perfil-coach-es': JSON.stringify({ titulo: 't', tagline: 'g', bio: 'b', enfoque: ['e'], especialidades: ['s'], keywords: ['k'], recomendacion: 'r', ideal_para: ['i'], no_ideal_para: [] }),
  'perfil-coach-en': JSON.stringify({ titulo: 't', tagline: 'g', bio: 'b', enfoque: ['e'], especialidades: ['s'], keywords: ['k'], recomendacion: 'r', ideal_para: ['i'], no_ideal_para: [] }),
};

const respuesta = (obj, status = 200) => async () =>
  new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } });
const FORMAS = {
  'sonnet-4-5': (t) => respuesta({ type: 'message', role: 'assistant', content: [{ type: 'text', text: t }], stop_reason: 'end_turn' }),
  'sonnet-5-5': (t) => respuesta({ type: 'message', role: 'assistant', content: [{ type: 'thinking', thinking: '', signature: 'sig' }, { type: 'text', text: t }], stop_reason: 'end_turn' }),
  'rechazo': () => respuesta({ type: 'message', role: 'assistant', content: [], stop_reason: 'refusal', stop_details: { type: 'refusal', category: 'general_harms', explanation: 'x' } }),
  'http-529': () => respuesta({ type: 'error', error: { type: 'overloaded_error', message: 'Overloaded' } }, 529),
};

const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
// Lo que depende del reloj o de la red no se compara.
const limpio = (r) => ({ status: r.status, json: r.json });

async function suite(compartido) {
  const fallos = [];
  const fallo = (tag, caso, msg) => fallos.push(`[${tag}] ${caso}: ${msg}`);
  const sup = supabaseDePrueba(COACHES);
  const cargar = (version, fn, forma, texto) => cargarFuncion({
    slug: fn, index: version === 'nuevo' ? nuevo[fn] : original[fn],
    compartido: version === 'nuevo' ? compartido : undefined,
    anthropic: FORMAS[forma](texto), supabase: sup,
  });

  for (const c of CASOS) {
    const t = SIMULADO[c.id];
    if (t === undefined) { fallo('casos', c.id, 'sin respuesta simulada'); continue; }
    const o45 = await (await cargar('original', c.fn, 'sonnet-4-5', t))(c.body);
    const n45 = await (await cargar('nuevo', c.fn, 'sonnet-4-5', t))(c.body);
    const n55 = await (await cargar('nuevo', c.fn, 'sonnet-5-5', t))(c.body);
    const o55 = await (await cargar('original', c.fn, 'sonnet-5-5', t))(c.body);

    // La referencia tiene que estar sana, o la prueba no prueba nada.
    const base = c.comprobar(o45.status, o45.json);
    if (base.length) fallo('referencia', c.id, `main con Sonnet 4.5 ya falla: ${base.join('; ')}`);

    // M-1 · prompts, mensajes y max_tokens intactos
    const po = o45.peticiones[0]?.body, pn = n45.peticiones[0]?.body;
    if (!po || !pn) fallo('M-1', c.id, 'no hubo llamada a la API');
    else {
      for (const k of ['system', 'messages', 'max_tokens']) if (!igual(po[k], pn[k])) fallo('M-1', c.id, `cambió ${k}`);
    }
    // M-2 · la petición nueva
    const h = n45.peticiones[0]?.headers || {};
    if (pn) {
      if (pn.model !== 'claude-sonnet-5-5') fallo('M-2', c.id, `modelo ${pn.model}`);
      if (pn.thinking?.type !== 'between_tools' || Object.keys(pn.thinking).length !== 1) fallo('M-2', c.id, `thinking ${JSON.stringify(pn.thinking)}`);
      if (pn.output_config?.effort !== 'high') fallo('M-2', c.id, `effort ${JSON.stringify(pn.output_config)}`);
      for (const k of ['temperature', 'top_p', 'top_k']) if (k in pn) fallo('M-2', c.id, `lleva ${k}`);
      if (h['anthropic-version'] !== o45.peticiones[0]?.headers['anthropic-version']) fallo('M-2', c.id, 'cambió anthropic-version');
    }
    // M-3 · misma salida con la forma vieja
    if (!igual(limpio(n45), limpio(o45))) fallo('M-3', c.id, 'con Sonnet 4.5 la salida difiere de main');
    // M-4 · la forma nueva no rompe nada… y en main sí rompía
    if (!igual(limpio(n55), limpio(o45))) fallo('M-4', c.id, `con Sonnet 5.5 la salida difiere: ${JSON.stringify(n55.json).slice(0, 160)}`);
    if (igual(limpio(o55), limpio(o45))) fallo('M-4', c.id, 'main NO se rompía con la forma de 5.5: la prueba no demuestra el defecto');
    if (c.comprobar(n55.status, n55.json).length) fallo('M-4', c.id, `estructura: ${c.comprobar(n55.status, n55.json).join('; ')}`);

    // M-5 · rechazo: mismo camino que main, y queda en el log
    const oR = await (await cargar('original', c.fn, 'rechazo'))(c.body);
    const nR = await (await cargar('nuevo', c.fn, 'rechazo'))(c.body);
    if (!igual(limpio(nR), limpio(oR))) fallo('M-5', c.id, `rechazo: ${JSON.stringify(nR.json).slice(0, 120)} ≠ main ${JSON.stringify(oR.json).slice(0, 120)}`);
    if (!nR.avisos.some((a) => a.includes('refusal') && a.includes('general_harms'))) fallo('M-5', c.id, 'el rechazo no quedó en el log');

    // M-6 · error HTTP: misma respuesta
    const oE = await (await cargar('original', c.fn, 'http-529'))(c.body);
    const nE = await (await cargar('nuevo', c.fn, 'http-529'))(c.body);
    if (!igual(limpio(nE), limpio(oE))) fallo('M-6', c.id, `HTTP 529: ${JSON.stringify(nE.json).slice(0, 140)} ≠ main ${JSON.stringify(oE.json).slice(0, 140)}`);
  }
  return fallos;
}

// ── 1 · la prueba de verdad ─────────────────────────────────────────────────
const fallos = await suite(COMPARTIDO);
console.log(`Casos: ${CASOS.length} · referencia: ${REF}`);
if (fallos.length) {
  console.log(`\n✗ ${fallos.length} fallos:\n  ` + fallos.join('\n  '));
} else {
  console.log('✓ M-1…M-6 en verde para los', CASOS.length, 'casos');
}

// ── 2 · canarios: cada mutación tiene que poner en rojo SU aserción ─────────
const CANARIOS = [
  {
    nombre: 'leer content[0] por posición',
    espera: 'M-4',
    mutar: (s) => s.replace(/const texto = bloques[\s\S]*?\.join\(""\);/, 'const texto = (bloques[0] && (bloques[0] as { text?: string }).text) || "";'),
  },
  { nombre: 'quitar el thinking between_tools', espera: 'M-2', mutar: (s) => s.replace('thinking: { type: "between_tools" },', '') },
  { nombre: 'volver a claude-sonnet-4-5', espera: 'M-2', mutar: (s) => s.replace('"claude-sonnet-5-5"', '"claude-sonnet-4-5"') },
];
let canariosMal = 0;
for (const k of CANARIOS) {
  const mutado = k.mutar(COMPARTIDO);
  if (mutado === COMPARTIDO) { console.log(`✗ canario «${k.nombre}»: la mutación no se aplicó`); canariosMal++; continue; }
  const f = await suite(mutado);
  const suya = f.some((x) => x.startsWith(`[${k.espera}]`));
  console.log(`${suya ? '✓' : '✗'} canario «${k.nombre}»: ${suya ? `rojo por ${k.espera}` : `NO lo detecta ${k.espera} (${f.length} fallos)`}`);
  if (!suya) canariosMal++;
}

process.exit(fallos.length || canariosMal ? 1 : 0);
