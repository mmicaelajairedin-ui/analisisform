/**
 * Comparación REAL claude-sonnet-4-5 (lo que corre hoy) contra
 * claude-sonnet-5-5 (la migración), caso por caso, contra la API de Anthropic.
 *
 * QUÉ ES Y QUÉ NO ES
 *
 * Ejecuta las funciones REALES —la de `main` y la migrada— con los casos
 * inventados de `casos-claude-sonnet-5-5.mjs`, y deja que la llamada a
 * Anthropic salga de verdad. Supabase va simulado: no se lee ni se escribe
 * ninguna tabla de Pathway, no se invoca ninguna Edge Function desplegada y no
 * se despliega nada. Lo único real es la llamada al modelo, y cuesta dinero:
 * el total se imprime al final (≈ 2-4 USD con 2 repeticiones).
 *
 * Mide, por caso y por modelo: estado HTTP y fallos estructurales (lo que el
 * frontend necesita para pintar), latencia de la API, tokens, coste, motivo de
 * parada y tipos de bloque recibidos. Y deja las dos salidas lado a lado en un
 * informe Markdown, porque la CALIDAD de un informe se juzga leyéndolo.
 *
 *   ANTHROPIC_API_KEY=… node --experimental-strip-types scripts/comparar-sonnet-4-5-vs-5-5.mjs
 *
 * Variables: REPS (2) · REF_ORIGINAL (origin/main) · CASOS (ids separados por
 * coma, para repetir solo algunos) · ADAPTATIVO_LOW=1 añade un tercer brazo con
 * Sonnet 5.5 en razonamiento adaptativo y effort `low`, para comparar.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CASOS, COACHES } from './casos-claude-sonnet-5-5.mjs';
import { cargarFuncion, supabaseDePrueba, fetchReal } from './_cargar-funcion-claude.mjs';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, '..');
const FN = join(RAIZ, 'supabase/functions');
const REF = process.env.REF_ORIGINAL || 'origin/main';
const REPS = Number(process.env.REPS || 2);
const SOLO = (process.env.CASOS || '').split(',').map((s) => s.trim()).filter(Boolean);
const CLAVE = process.env.ANTHROPIC_API_KEY;
if (!CLAVE) { console.error('Falta ANTHROPIC_API_KEY. La comparación no se ejecuta.'); process.exit(2); }

// $ por millón de tokens (entrada / salida), página oficial de precios.
const PRECIO = { 'claude-sonnet-4-5': [3, 15], 'claude-sonnet-5-5': [2, 10] };

const COMPARTIDO = readFileSync(join(FN, '_shared/claude/mensajes.ts'), 'utf8');
const ADAPTATIVO_LOW = COMPARTIDO.replace(
  /export const AJUSTE_RAZONAMIENTO = \{[\s\S]*?\} as const;/,
  'export const AJUSTE_RAZONAMIENTO = { thinking: { type: "adaptive" }, output_config: { effort: "low" } } as const;');
const fuente = (ref, f) => execFileSync('git', ['show', `${ref}:supabase/functions/${f}/index.ts`], { cwd: RAIZ, encoding: 'utf8' });
const actual = (f) => readFileSync(join(FN, f, 'index.ts'), 'utf8');

const BRAZOS = [
  { id: 'sonnet-4-5 · main', index: (f) => fuente(REF, f), compartido: undefined },
  { id: 'sonnet-5-5 · migrada', index: actual, compartido: COMPARTIDO },
];
if (process.env.ADAPTATIVO_LOW === '1') BRAZOS.push({ id: 'sonnet-5-5 · adaptativo low', index: actual, compartido: ADAPTATIVO_LOW });

/** Reenvía a la API real y apunta lo que interesa medir. */
function anthropicReal(registro) {
  return async (url, init) => {
    const headers = new Headers(init.headers || {});
    headers.set('x-api-key', CLAVE);
    const t0 = Date.now();
    const res = await fetchReal(url, { ...init, headers });
    const texto = await res.text();
    const ms = Date.now() - t0;
    let d = {}; try { d = JSON.parse(texto); } catch { /* error no JSON */ }
    registro.push({ ms, status: res.status, model: d.model, usage: d.usage, stop_reason: d.stop_reason, stop_details: d.stop_details, bloques: Array.isArray(d.content) ? d.content.map((b) => b.type) : null, error: res.ok ? null : texto.slice(0, 300) });
    return new Response(texto, { status: res.status, headers: { 'content-type': 'application/json' } });
  };
}

const filas = [];
let gasto = 0;
const casos = SOLO.length ? CASOS.filter((c) => SOLO.includes(c.id)) : CASOS;
for (const c of casos) {
  for (const b of BRAZOS) {
    for (let rep = 1; rep <= REPS; rep++) {
      const registro = [];
      const invocar = await cargarFuncion({ slug: c.fn, index: b.index(c.fn), compartido: b.compartido, anthropic: anthropicReal(registro), supabase: supabaseDePrueba(COACHES) });
      let r;
      try { r = await invocar(c.body); } catch (e) { r = { status: 0, json: { excepcion: String(e) }, ms: 0, avisos: [] }; }
      const api = registro[0] || {};
      const u = api.usage || {};
      const precio = PRECIO[api.model?.startsWith('claude-sonnet-5-5') ? 'claude-sonnet-5-5' : 'claude-sonnet-4-5'];
      const coste = ((u.input_tokens || 0) * precio[0] + (u.output_tokens || 0) * precio[1]) / 1e6;
      gasto += coste;
      const fallos = c.comprobar(r.status, r.json);
      const fila = { caso: c.id, fn: c.fn, brazo: b.id, rep, status: r.status, fallos, msApi: api.ms ?? null, msTotal: r.ms, modelo: api.model, entrada: u.input_tokens, salida: u.output_tokens, coste, stop_reason: api.stop_reason, categoria: api.stop_details?.category ?? null, bloques: api.bloques, errorApi: api.error, avisos: r.avisos.filter((a) => !a.startsWith('[log]')), salidaFuncion: r.json };
      filas.push(fila);
      console.log(`${c.id.padEnd(24)} ${b.id.padEnd(28)} #${rep} ${String(r.status).padEnd(4)} ${String(api.ms ?? '-').padStart(6)}ms ${String(u.output_tokens ?? '-').padStart(6)}tok ${api.stop_reason || '-'} ${fallos.length ? '✗ ' + fallos.join('; ') : '✓'}`);
    }
  }
}

// ── Resumen ──────────────────────────────────────────────────────────────────
const resumen = BRAZOS.map((b) => {
  const f = filas.filter((x) => x.brazo === b.id);
  const ms = f.map((x) => x.msApi).filter((x) => x != null).sort((a, z) => a - z);
  const p = (q) => ms.length ? ms[Math.min(ms.length - 1, Math.floor(q * ms.length))] : null;
  return {
    brazo: b.id, llamadas: f.length,
    estructuraOk: f.filter((x) => !x.fallos.length).length,
    noHttp200: f.filter((x) => x.status !== 200).length,
    rechazos: f.filter((x) => x.stop_reason === 'refusal').length,
    cortadasPorMaxTokens: f.filter((x) => x.stop_reason === 'max_tokens').length,
    latenciaMedianaMs: p(0.5), latenciaP90Ms: p(0.9),
    coste: f.reduce((a, x) => a + x.coste, 0),
  };
});
console.log('\nRESUMEN');
for (const r of resumen) console.log(JSON.stringify(r));
console.log(`\nGasto total: $${gasto.toFixed(4)}`);

// ── Informe para leer ────────────────────────────────────────────────────────
const SAL = join(RAIZ, 'resultados-sonnet-5-5');
mkdirSync(SAL, { recursive: true });
writeFileSync(join(SAL, 'resultados.json'), JSON.stringify({ fecha: new Date().toISOString(), ref: REF, reps: REPS, resumen, filas }, null, 2));
const md = [];
md.push('# Sonnet 4.5 (main) contra Sonnet 5.5 (migrada)', '', `Fecha: ${new Date().toISOString()} · referencia: \`${REF}\` · repeticiones: ${REPS}`, '');
md.push('| Brazo | Llamadas | Estructura OK | ≠200 | Rechazos | Cortadas | Latencia p50 | p90 | Coste |', '|---|---|---|---|---|---|---|---|---|');
for (const r of resumen) md.push(`| ${r.brazo} | ${r.llamadas} | ${r.estructuraOk} | ${r.noHttp200} | ${r.rechazos} | ${r.cortadasPorMaxTokens} | ${r.latenciaMedianaMs} ms | ${r.latenciaP90Ms} ms | $${r.coste.toFixed(4)} |`);
md.push('', '## Caso por caso', '');
for (const c of casos) {
  md.push(`### ${c.id} · \`${c.fn}\``, '', '| Brazo | # | HTTP | Estructura | API ms | Tokens salida | Parada |', '|---|---|---|---|---|---|---|');
  for (const f of filas.filter((x) => x.caso === c.id)) md.push(`| ${f.brazo} | ${f.rep} | ${f.status} | ${f.fallos.length ? '✗ ' + f.fallos.join('; ') : '✓'} | ${f.msApi ?? '-'} | ${f.salida ?? '-'} | ${f.stop_reason || '-'}${f.categoria ? ' · ' + f.categoria : ''} |`);
  md.push('');
  for (const b of BRAZOS) {
    const f = filas.find((x) => x.caso === c.id && x.brazo === b.id && x.rep === 1);
    if (!f) continue;
    md.push(`<details><summary>${b.id} — salida (repetición 1)</summary>`, '', '```json', JSON.stringify(f.salidaFuncion, null, 2).slice(0, 6000), '```', '</details>', '');
  }
}
writeFileSync(join(SAL, 'informe.md'), md.join('\n'));
console.log('Informe:', join(SAL, 'informe.md'));
process.exit(0);
