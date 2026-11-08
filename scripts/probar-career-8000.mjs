/**
 * UNA llamada real: el informe Career con la función MIGRADA (Sonnet 5.5,
 * max_tokens 8000), para comprobar que el informe termina completo donde con
 * 4000 se cortó. Autorizada el 2026-11-08 con un coste máximo de 0,05 USD.
 *
 * El tope de gasto es DURO, no estimado: con max_tokens 8000 el peor caso
 * serían ~0,08 USD, así que la respuesta se pide en streaming, se cuenta con
 * /v1/messages/count_tokens (gratuito) y la conexión se corta antes de llegar
 * al tope. Anthropic factura solo lo generado hasta el corte.
 *
 * No repite la llamada de Sonnet 4.5: su salida de referencia ya existe
 * (rama claude/resultados-sonnet-5-5). Supabase va simulado y no se despliega
 * nada; los datos del caso son sintéticos.
 *
 *   ANTHROPIC_API_KEY=… node --experimental-strip-types scripts/probar-career-8000.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CASOS, COACHES } from './casos-claude-sonnet-5-5.mjs';
import { cargarFuncion, supabaseDePrueba, fetchReal } from './_cargar-funcion-claude.mjs';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, '..');
const FN = join(RAIZ, 'supabase/functions');
const CLAVE = process.env.ANTHROPIC_API_KEY;
if (!CLAVE) { console.error('Falta ANTHROPIC_API_KEY. La prueba no se ejecuta.'); process.exit(2); }

const TOPE_USD = Number(process.env.TOPE_USD || 0.05);
const PRECIO_IN = 2 / 1e6, PRECIO_OUT = 10 / 1e6; // Sonnet 5.5, página oficial de precios
// Margen para lo que el modelo genere mientras se cuenta y se corta.
const MARGEN_TOKENS = 350;

// Solo para la prueba sin red del propio corte: un servidor local que imita a Anthropic.
const BASE = process.env.ANTHROPIC_BASE || 'https://api.anthropic.com';

const caso = CASOS.find((c) => c.id === 'informe-carrera');
const H = { 'x-api-key': CLAVE, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' };

async function contarTokens(model, texto) {
  const r = await fetchReal(`${BASE}/v1/messages/count_tokens`, {
    method: 'POST', headers: H,
    body: JSON.stringify({ model, messages: [{ role: 'user', content: texto || '.' }] }),
  });
  if (!r.ok) throw new Error(`count_tokens ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return (await r.json()).input_tokens;
}

const medida = { cortada: false, entrada: null, salida: null, salidaContada: null, stop_reason: null, ms: null, peticion: null };

/** Reenvía la llamada de la función como streaming, con corte por presupuesto. */
async function anthropicConTope(url, init) {
  const cuerpo = JSON.parse(init.body);
  medida.peticion = { model: cuerpo.model, max_tokens: cuerpo.max_tokens, thinking: cuerpo.thinking, output_config: cuerpo.output_config };
  const ctl = new AbortController();
  const t0 = Date.now();
  const res = await fetchReal(url.replace('https://api.anthropic.com', BASE), { method: 'POST', headers: H, body: JSON.stringify({ ...cuerpo, stream: true }), signal: ctl.signal });
  if (!res.ok) return new Response(await res.text(), { status: res.status, headers: { 'content-type': 'application/json' } });

  const base = await contarTokens(cuerpo.model, '.');
  let texto = '', buf = '', proximoConteo = 6000;
  const lector = res.body.getReader();
  const dec = new TextDecoder();
  try {
    for (;;) {
      const { done, value } = await lector.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const linea = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
        if (!linea.startsWith('data:')) continue;
        const ev = JSON.parse(linea.slice(5));
        if (ev.type === 'message_start') medida.entrada = ev.message?.usage?.input_tokens ?? null;
        if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta') texto += ev.delta.text;
        if (ev.type === 'message_delta') { medida.stop_reason = ev.delta?.stop_reason ?? null; medida.salida = ev.usage?.output_tokens ?? null; }
      }
      // A partir de ~6000 caracteres se cuenta de verdad, cada 300.
      if (texto.length >= proximoConteo) {
        proximoConteo = texto.length + 300;
        const salida = (await contarTokens(cuerpo.model, texto)) - base;
        const gasto = (medida.entrada ?? 0) * PRECIO_IN + (salida + MARGEN_TOKENS) * PRECIO_OUT;
        if (gasto >= TOPE_USD) {
          medida.cortada = true; medida.salidaContada = salida; medida.stop_reason = 'corte_por_presupuesto';
          ctl.abort();
          break;
        }
      }
    }
  } catch (e) {
    if (!medida.cortada) throw e;
  }
  medida.ms = Date.now() - t0;
  if (medida.salida == null) medida.salidaContada ??= (await contarTokens(cuerpo.model, texto)) - base;
  return new Response(JSON.stringify({
    type: 'message', role: 'assistant', content: [{ type: 'text', text: texto }],
    stop_reason: medida.cortada ? 'max_tokens' : medida.stop_reason,
    usage: { input_tokens: medida.entrada, output_tokens: medida.salida ?? medida.salidaContada },
  }), { status: 200, headers: { 'content-type': 'application/json' } });
}

const invocar = await cargarFuncion({
  slug: 'generar-informe',
  index: readFileSync(join(FN, 'generar-informe/index.ts'), 'utf8'),
  compartido: readFileSync(join(FN, '_shared/claude/mensajes.ts'), 'utf8'),
  anthropic: anthropicConTope,
  supabase: supabaseDePrueba(COACHES),
});
const r = await invocar(caso.body);
const salidaTok = medida.salida ?? medida.salidaContada;
const coste = (medida.entrada ?? 0) * PRECIO_IN + (salidaTok ?? 0) * PRECIO_OUT;
const fallos = caso.comprobar(r.status, r.json);

const resultado = {
  fecha: new Date().toISOString(), caso: caso.id, peticion: medida.peticion,
  http: r.status, estructura: fallos.length ? fallos : 'ok', stop_reason: medida.stop_reason,
  cortadaPorPresupuesto: medida.cortada, tokensEntrada: medida.entrada, tokensSalida: salidaTok,
  tokensSalidaExactos: medida.salida != null, msApi: medida.ms,
  costeUSD: Number(coste.toFixed(4)), topeUSD: TOPE_USD, avisos: r.avisos.filter((a) => !a.startsWith('[log]')),
  respuestaCompleta: r.json,
};
console.log(JSON.stringify({ ...resultado, respuestaCompleta: undefined }, null, 2));
const SAL = join(RAIZ, 'resultados-career-8000');
mkdirSync(SAL, { recursive: true });
writeFileSync(join(SAL, 'resultado.json'), JSON.stringify(resultado, null, 2));

const ok = r.status === 200 && !fallos.length && medida.stop_reason === 'end_turn' && !medida.cortada;
console.log(ok ? `\n✓ Career COMPLETO con max_tokens 8000 · ${salidaTok} tokens · $${coste.toFixed(4)}`
  : `\n✗ Career NO completo (${medida.cortada ? 'cortado por presupuesto: INCONCLUSO' : `HTTP ${r.status} · ${medida.stop_reason}`}) · $${coste.toFixed(4)}`);
if (coste > TOPE_USD) { console.error('TOPE SUPERADO'); process.exit(3); }
process.exit(ok ? 0 : 1);
