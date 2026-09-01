#!/usr/bin/env node
// S3 · «dar de baja cierra la puerta» — contrato de `pathway-handoff`.
//
// Corre OFFLINE y sobre el CÓDIGO REAL: carga supabase/functions/pathway-handoff/index.ts
// tal cual, le shimea `Deno` y un PostgREST de mentira, y le pasa `Request`s.
//
// El PostgREST falso devuelve SOLO las columnas pedidas en el `select`. Es
// deliberado: si alguien comprueba `userData.activo` sin pedir `activo`, el valor
// llega `undefined`, `=== false` es falso y la guarda pasa en silencio. Así se caza.
//
// Uso: node scripts/probar-handoff-activo.mjs
import fs from 'node:fs';
import path from 'node:path';

const SRC = path.join(process.cwd(), 'supabase/functions/pathway-handoff/index.ts');
let ok = 0, fail = 0;
const t = (nombre, cond, detalle) => {
  if (cond) { ok++; console.log('  ok   ' + nombre); }
  else { fail++; console.log('  FAIL ' + nombre + (detalle ? ' — ' + detalle : '')); }
};

// ── El doble de PostgREST ────────────────────────────────────────────────
function hacerCliente(mundo, espia) {
  return {
    auth: {
      getUser: async (token) => {
        const u = mundo.tokens[token];
        return u ? { data: { user: u }, error: null }
                 : { data: { user: null }, error: { message: 'invalid token' } };
      },
    },
    from(tabla) {
      const q = { tabla, cols: null, filtros: {} };
      const api = {
        select(cols) { q.cols = cols; return api; },
        eq(col, val) { q.filtros[col] = val; return api; },
        async single() {
          if (q.tabla !== 'usuarios') return { data: null, error: { message: 'tabla' } };
          espia.selectUsuarios = q.cols;
          const fila = mundo.usuarios.find(u =>
            Object.entries(q.filtros).every(([k, v]) => u[k] === v));
          if (!fila) return { data: null, error: { message: 'no rows' } };
          // PostgREST honesto: solo las columnas pedidas.
          const pedidas = (q.cols || '').split(',').map(s => s.trim()).filter(Boolean);
          const proy = {};
          for (const c of pedidas) proy[c] = fila[c];
          return { data: proy, error: null };
        },
        async insert(fila) { espia.insertado = fila; return { error: null }; },
      };
      return api;
    },
  };
}

async function invocar(mundo, { token, cuerpo } = {}) {
  const espia = {};
  let handler;
  const Deno = {
    env: { get: (k) => ({ SUPABASE_URL: 'https://x', SUPABASE_SERVICE_ROLE_KEY: 'k' })[k] || '' },
    serve: (fn) => { handler = fn; },
  };
  const src = fs.readFileSync(SRC, 'utf8')
    .replace(/^import[^\n]*\n/m, '')                 // fuera el import de esm.sh
    .replace(/data:\s*unknown/, 'data')              // TS → JS
    .replace(/\):\s*Response\s*\{/, ') {')
    .replace(/\(\):\s*string\s*\{/, '() {');
  const createClient = () => hacerCliente(mundo, espia);
  new Function('Deno', 'createClient', 'console', src)(Deno, createClient, { error() {}, log() {} });

  const headers = new Headers({ 'content-type': 'application/json' });
  if (token) headers.set('authorization', 'Bearer ' + token);
  const res = await handler(new Request('https://x/pathway-handoff', {
    method: 'POST', headers, body: JSON.stringify(cuerpo || {}),
  }));
  let body = null; try { body = await res.clone().json(); } catch {}
  return { status: res.status, body, espia };
}

// ── El mundo: una organización con gente dentro ──────────────────────────
const ORG = '11111111-1111-1111-1111-111111111111';
const OTRA = '22222222-2222-2222-2222-222222222222';
const mundo = {
  tokens: {
    'tk-activa':     { id: 'auth-activa',     email: 'coach.activa@ej.test' },
    'tk-suspendida': { id: 'auth-suspendida', email: 'coach.susp@ej.test' },
    'tk-expulsada':  { id: 'auth-expulsada',  email: 'coach.exp@ej.test' },
    'tk-legacy':     { id: 'auth-legacy',     email: 'coach.legacy@ej.test' },
    'tk-owner':      { id: 'auth-owner',      email: 'owner@ej.test' },
  },
  usuarios: [
    // suspender → activo=false y CONSERVA org_id (eliminar-coach-red:88). El vector de S3.
    { auth_id:'auth-suspendida', email:'coach.susp@ej.test',   org_id:ORG,  rol:'coach', activo:false },
    // expulsar → activo=false + org_id=null (eliminar-coach-red:98)
    { auth_id:'auth-expulsada',  email:'coach.exp@ej.test',    org_id:null, rol:'coach', activo:false },
    { auth_id:'auth-activa',     email:'coach.activa@ej.test', org_id:ORG,  rol:'coach', activo:true  },
    // fila histórica: la columna es nullable, así que null NO puede significar baja
    { auth_id:'auth-legacy',     email:'coach.legacy@ej.test', org_id:ORG,  rol:'coach', activo:null  },
    { auth_id:'auth-owner',      email:'owner@ej.test',        org_id:OTRA, rol:'owner', activo:true  },
  ],
};

console.log('▸ S3 · el emisor de handoff no emite para una cuenta dada de baja\n');
const r = {};
for (const [k, tk] of Object.entries({
  activa:'tk-activa', suspendida:'tk-suspendida', expulsada:'tk-expulsada',
  legacy:'tk-legacy', owner:'tk-owner',
})) r[k] = await invocar(mundo, { token: tk });
const sinToken = await invocar(mundo, {});
const tokenMalo = await invocar(mundo, { token: 'tk-inventado' });

console.log('· POSITIVAS — quien debe entrar, entra');
t('coach ACTIVA obtiene código',        r.activa.status === 200 && !!r.activa.body?.code, 'status ' + r.activa.status);
t('owner ACTIVO obtiene código',        r.owner.status === 200 && !!r.owner.body?.code,  'status ' + r.owner.status);
t('fila legacy (activo=null) NO se trata como baja',
   r.legacy.status === 200 && !!r.legacy.body?.code,
   'status ' + r.legacy.status + ' — la columna es nullable, null es "activo" por defecto');

console.log('\n· NEGATIVAS — quien está de baja, no');
t('coach SUSPENDIDA (activo=false, org intacta) recibe 403',
   r.suspendida.status === 403, 'status ' + r.suspendida.status + ' — este es el fallo de S3');
t('…y NO se emite ningún código para ella',
   r.suspendida.espia.insertado === undefined, 'se insertó una fila en handoff_codes');
t('coach EXPULSADA (activo=false, sin org) recibe 403',
   r.expulsada.status === 403, 'status ' + r.expulsada.status);

console.log('\n· SESIÓN — sin cambios respecto al comportamiento actual');
t('sin cabecera de autorización → 401', sinToken.status === 401);
t('token inválido → 401',               tokenMalo.status === 401);

console.log('\n· GUARDARRAÍL — la guarda no puede ser decorativa');
t('el select de `usuarios` pide `activo`',
   /\bactivo\b/.test(r.activa.espia.selectUsuarios || ''),
   'select = "' + (r.activa.espia.selectUsuarios || '') + '" · sin pedirlo, userData.activo es undefined y la guarda nunca salta');

console.log('\n· AISLAMIENTO — la organización sale del usuario, no de quien llama');
const intruso = await invocar(mundo, { token:'tk-activa', cuerpo:{ org_id: OTRA, user_id:'auth-owner' } });
t('el código se emite con la org del usuario autenticado',
   intruso.espia.insertado?.org_id === ORG, 'org_id insertado: ' + intruso.espia.insertado?.org_id);
t('el user_id del código sale del JWT, no del cuerpo',
   intruso.espia.insertado?.user_id === 'auth-activa', 'user_id: ' + intruso.espia.insertado?.user_id);

console.log('\n  ' + ok + ' ok · ' + fail + ' fallos');
process.exit(fail ? 1 : 0);
