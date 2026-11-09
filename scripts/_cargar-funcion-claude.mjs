/**
 * Carga una Edge Function TAL CUAL (su index.ts, y el módulo compartido de
 * Claude si lo importa) y la deja lista para invocarla desde Node, sin Deno y
 * sin red de Supabase. Lo usan las dos pruebas de la migración a Sonnet 5.5.
 *
 * Cada carga va a un directorio temporal NUEVO: así una versión mutada o la
 * original no pisan a la otra en la caché de módulos de Node.
 *
 * Requiere: node --experimental-strip-types
 */
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

export const SB = 'https://sb.prueba.test';
const ENV_BASE = { ANTHROPIC_API_KEY: 'sk-ant-prueba', SUPABASE_URL: SB, SUPABASE_SERVICE_ROLE_KEY: 'srk-prueba' };

/** Supabase de mentira: lee coaches de `coaches`, y toda escritura «sale bien». */
export function supabaseDePrueba(coaches = []) {
  return async (url, init = {}) => {
    const m = (init.method || 'GET').toUpperCase();
    if (m === 'GET' && url.includes('/rest/v1/usuarios') && url.includes('perfil_publico_activo')) {
      return new Response(JSON.stringify(coaches), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (m === 'GET') return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } });
    return new Response('[]', { status: 201, headers: { 'content-type': 'application/json' } });
  };
}

let serie = 0;
const fetchReal = globalThis.fetch;

/**
 * @param {object} o
 * @param {string} o.slug           nombre de la función
 * @param {string} o.index          fuente de su index.ts
 * @param {string} [o.compartido]   fuente de _shared/claude/mensajes.ts (si la importa)
 * @param {(url:string, init:object) => Promise<Response>} o.anthropic  respuesta de la API
 * @param {(url:string, init:object) => Promise<Response>} [o.supabase]
 * @returns {Promise<(body:object) => Promise<{status:number, json:any, ms:number, avisos:string[], peticiones:object[]}>>}
 */
export async function cargarFuncion({ slug, index, compartido, anthropic, supabase = supabaseDePrueba() }) {
  const raiz = mkdtempSync(join(tmpdir(), `fn-${slug}-${++serie}-`));
  const dirFn = join(raiz, 'supabase/functions', slug);
  mkdirSync(dirFn, { recursive: true });
  writeFileSync(join(dirFn, 'index.ts'), index);
  if (compartido !== undefined) {
    const dirSh = join(raiz, 'supabase/functions/_shared/claude');
    mkdirSync(dirSh, { recursive: true });
    writeFileSync(join(dirSh, 'mensajes.ts'), compartido);
  }

  let manejador = null;
  globalThis.Deno = {
    serve: (h) => { manejador = typeof h === 'function' ? h : h.handler; },
    env: { get: (k) => ENV_BASE[k] },
  };
  await import(pathToFileURL(join(dirFn, 'index.ts')).href);
  if (!manejador) throw new Error(`${slug}: Deno.serve no se llamó al cargar`);
  const h = manejador;

  return async (body) => {
    const peticiones = [];
    const avisos = [];
    const warnOriginal = console.warn;
    const errorOriginal = console.error;
    const logOriginal = console.log;
    // El log propio de las funciones se guarda, no se imprime: así la salida
    // de la prueba es solo su veredicto.
    console.log = (...a) => avisos.push('[log] ' + a.map(String).join(' '));
    console.warn = (...a) => avisos.push(a.map(String).join(' '));
    console.error = (...a) => avisos.push('[error] ' + a.map(String).join(' '));
    globalThis.fetch = async (input, init = {}) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.startsWith('https://api.anthropic.com/')) {
        const cuerpo = init.body ? JSON.parse(init.body) : null;
        peticiones.push({ url, headers: Object.fromEntries(new Headers(init.headers || {}).entries()), body: cuerpo });
        return anthropic(url, init, cuerpo);
      }
      if (url.startsWith(SB)) return supabase(url, init);
      throw new Error(`fetch a un destino no previsto en la prueba: ${url}`);
    };
    const t0 = Date.now();
    try {
      const res = await h(new Request(`https://edge.prueba.test/functions/v1/${slug}`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
      }));
      const texto = await res.text();
      let json = null;
      try { json = JSON.parse(texto); } catch { json = { _texto: texto }; }
      return { status: res.status, json, ms: Date.now() - t0, avisos, peticiones };
    } finally {
      globalThis.fetch = fetchReal;
      console.warn = warnOriginal;
      console.error = errorOriginal;
      console.log = logOriginal;
    }
  };
}

export { fetchReal };
