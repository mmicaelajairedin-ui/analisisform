// scripts/probar-canal-red-group-delete.mjs
//
// Prueba de la puerta de 'group_delete' en la edge function canal-red.
//
// Corre OFFLINE y sobre el CODIGO REAL: shimea Deno, carga
// supabase/functions/canal-red/index.ts tal cual y le pasa Requests de verdad,
// con un PostgREST de mentira detras. No abre red y no toca ningun proyecto.
//
// Emula PostgREST con honestidad: devuelve SOLO las columnas que pide el
// parametro select. Asi, si alguien comprueba is_system pero se olvida de
// pedirlo en el select, la columna llega undefined y la prueba se pone roja.
//
// Vive en scripts/ y NO en tests/ a proposito: playwright descubre por testDir
// './tests' y un fichero que no cargue ahi tumba el descubrimiento entero
// (INC-038 / R-50). Los test.ts de supabase/functions/ no valen como prueba:
// exigen un Supabase local en localhost:54321 y no los ejecuta ningun workflow.
//
//   node --experimental-strip-types scripts/probar-canal-red-group-delete.mjs

const SB = 'https://proyecto.supabase.co';

// ── Datos de mentira ────────────────────────────────────────────────────────
const ORG = 'org-1', OTRA_ORG = 'org-2';
const USUARIOS = {
  'tok-owner': { id: 'u-own', nombre: 'Dueña',  rol: 'owner', org_id: ORG,      email: 'own@x.com' },
  'tok-coach': { id: 'u-coa', nombre: 'Coach',  rol: 'coach', org_id: ORG,      email: 'coa@x.com' },
  'tok-ajeno': { id: 'u-aje', nombre: 'Ajeno',  rol: 'owner', org_id: OTRA_ORG, email: 'aje@x.com' },
};
let CANALES, borrados, parcheados;
function sembrar() {
  CANALES = {
    'g-normal': { id: 'g-normal', org_id: ORG, nombre: 'Nutricionistas', creado_por: 'u-own', miembros: [], is_system: false },
    'g-sistema':{ id: 'g-sistema',org_id: ORG, nombre: 'Owners',         creado_por: 'u-own', miembros: [], is_system: true  },
    'g-ajeno':  { id: 'g-ajeno',  org_id: OTRA_ORG, nombre: 'De otra red', creado_por: 'u-aje', miembros: [], is_system: false },
    'g-decoach':{ id: 'g-decoach',org_id: ORG, nombre: 'Del coach',      creado_por: 'u-coa', miembros: [], is_system: false },
    'g-sis-aje':{ id: 'g-sis-aje',org_id: OTRA_ORG, nombre: 'Owners',     creado_por: 'u-aje', miembros: [], is_system: true  },
  };
  borrados = []; parcheados = [];
}

// ── PostgREST de mentira ────────────────────────────────────────────────────
function proyectar(fila, select) {
  if (!select) return { ...fila };
  const out = {};
  for (const col of select.split(',')) if (col in fila) out[col] = fila[col];
  return out;
}
globalThis.fetch = async (url, opt = {}) => {
  const u = new URL(String(url));
  const metodo = (opt.method || 'GET').toUpperCase();
  const ok = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

  if (u.pathname === '/auth/v1/user') {
    const tok = String(opt.headers?.Authorization || '').replace(/^Bearer\s+/i, '');
    const us = USUARIOS[tok];
    return us ? ok({ id: 'auth-' + us.id, email: us.email }) : ok({}, 401);
  }
  if (u.pathname === '/rest/v1/usuarios') {
    const or = decodeURIComponent(u.searchParams.get('or') || '');
    const us = Object.values(USUARIOS).find((x) => or.includes(x.email));
    return ok(us ? [proyectar(us, u.searchParams.get('select'))] : []);
  }
  if (u.pathname === '/rest/v1/red_canales') {
    const id = (u.searchParams.get('id') || '').replace(/^eq\./, '');
    const fila = CANALES[decodeURIComponent(id)];
    if (metodo === 'GET')    return ok(fila ? [proyectar(fila, u.searchParams.get('select'))] : []);
    if (metodo === 'DELETE') { borrados.push(decodeURIComponent(id)); delete CANALES[decodeURIComponent(id)]; return ok([]); }
    if (metodo === 'PATCH')  { parcheados.push(decodeURIComponent(id)); return ok([]); }
  }
  return new Response('{}', { status: 404 });
};

globalThis.Deno = {
  env: { get: (k) => ({ SUPABASE_URL: SB, SUPABASE_SERVICE_ROLE_KEY: 'service', SUPABASE_ANON_KEY: 'anon' })[k] || '' },
  serve: (h) => { globalThis.__handler = h; },
};

await import('../supabase/functions/canal-red/index.ts');
const handler = globalThis.__handler;

const pedir = async (token, body) => {
  const r = await handler(new Request(SB + '/functions/v1/canal-red', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }));
  return { status: r.status, body: await r.json() };
};

// ── Aserciones ──────────────────────────────────────────────────────────────
let ok_ = 0, ko = 0;
const t = (n, cond, det = '') => { if (cond) { ok_++; console.log('  ok    ' + n); } else { ko++; console.log('  FALLA ' + n + (det ? ' → ' + det : '')); } };

console.log('\n1 · grupo normal → se elimina con permisos');
sembrar();
let r = await pedir('tok-owner', { action: 'group_delete', org_id: ORG, canal_id: 'g-normal' });
t('el dueño lo borra', r.status === 200 && r.body.ok === true, JSON.stringify(r));
t('la fila se borró de verdad', borrados.includes('g-normal'), JSON.stringify(borrados));
sembrar();
r = await pedir('tok-coach', { action: 'group_delete', org_id: ORG, canal_id: 'g-decoach' });
t('quien lo creó también lo borra', r.status === 200 && r.body.ok === true, JSON.stringify(r));

console.log('\n2 · grupo is_system → rechazado aunque se pida directo');
sembrar();
r = await pedir('tok-owner', { action: 'group_delete', org_id: ORG, canal_id: 'g-sistema' });
t('no devuelve ok', r.body.ok !== true, JSON.stringify(r));
t('responde 403', r.status === 403, 'status ' + r.status);
t('NO se borró ninguna fila', borrados.length === 0, JSON.stringify(borrados));
t('el canal sigue existiendo', !!CANALES['g-sistema']);

console.log('\n3 · sin permiso → rechazado');
sembrar();
r = await pedir('tok-coach', { action: 'group_delete', org_id: ORG, canal_id: 'g-normal' });
t('un coach que no lo creó no puede', r.status === 403 && r.body.error === 'sin_permiso', JSON.stringify(r));
t('no borró nada', borrados.length === 0);
sembrar();
r = await pedir('tok-ajeno', { action: 'group_delete', org_id: OTRA_ORG, canal_id: 'g-sis-aje' });
t('el dueño de OTRA org tampoco borra el canal de sistema SUYO', r.body.ok !== true && borrados.length === 0, JSON.stringify(r));
sembrar();
r = await pedir('tok-owner', { action: 'group_delete', org_id: ORG, canal_id: 'g-ajeno' });
t('un canal de otra org da 404', r.status === 404 && r.body.error === 'no_existe', JSON.stringify(r));
sembrar();
r = await pedir('tok-nadie', { action: 'group_delete', org_id: ORG, canal_id: 'g-normal' });
t('sin sesión válida da 403 no_session', r.status === 403 && r.body.error === 'no_session', JSON.stringify(r));

console.log('\n4 · el contrato público no se movió');
sembrar();
r = await pedir('tok-owner', { action: 'group_delete', org_id: ORG, canal_id: '' });
t('canal_id vacío sigue dando missing_canal 400', r.status === 400 && r.body.error === 'missing_canal', JSON.stringify(r));
sembrar();
r = await pedir('tok-owner', { action: 'group_update', org_id: ORG, canal_id: 'g-normal', nombre: 'Otro' });
t('group_update sigue funcionando igual', r.status === 200 && r.body.ok === true, JSON.stringify(r));
sembrar();
r = await pedir('tok-owner', { action: 'groups', org_id: ORG });
t('groups sigue devolviendo su lista', r.status === 200 && Array.isArray(r.body.canales), JSON.stringify(r).slice(0, 120));

console.log('\n' + ok_ + ' ok · ' + ko + ' fallos');
process.exit(ko ? 1 : 0);
