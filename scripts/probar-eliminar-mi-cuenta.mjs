/**
 * Borrado de cuenta — prueba de contrato, sin red y sin base.
 *
 * QUÉ PRUEBA Y POR QUÉ
 *
 * «Eliminar mi cuenta» llevaba tiempo sin poder funcionar (contraseña contra un
 * hash que las cuentas de Google no tienen, un RPC que con service role nunca
 * encontraba a nadie, y un cron que no existía). Y el borrado de admin dejaba
 * viva la identidad de Auth: la persona volvía a entrar con Google y
 * `auth-callback` le recreaba la cuenta. Las dos cosas que esta prueba fija:
 *
 *   B-1  se borra la identidad de Auth —TODAS las de ese email— y ANTES que los
 *        datos: si Auth falla no se toca ni una fila (falla cerrado).
 *   B-2  la identidad sale del JWT: el cuerpo no puede elegir a quién borrar.
 *
 * Y lo demás que tiene que seguir siendo cierto: la dueña de una organización y
 * el admin no se borran desde aquí; un coach individual se lleva sus clientes,
 * uno de organización los deja en ella; un DELETE que no borra nada no se da por
 * bueno (R-23); y el correo y el registro de la baja salen.
 *
 * CÓMO: se shimea `Deno`, se cargan los `index.ts` TAL CUAL —con el despojado de
 * tipos de Node— junto al módulo compartido, y detrás va un Supabase de mentira
 * (Auth + PostgREST + send-email) que apunta cada llamada.
 *
 * Lleva CANARIOS: se muta el módulo compartido de tres formas y se exige que la
 * prueba se ponga roja por la aserción que vigila cada una.
 *
 *   node --experimental-strip-types scripts/probar-eliminar-mi-cuenta.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';

const AQUI = dirname(fileURLToPath(import.meta.url));
const FN = resolve(AQUI, '../supabase/functions');
const FUENTE = {
  shared: readFileSync(join(FN, '_shared/cuenta/eliminar-cuenta.ts'), 'utf8'),
  self: readFileSync(join(FN, 'eliminar-mi-cuenta/index.ts'), 'utf8'),
  admin: readFileSync(join(FN, 'admin-coach-op/index.ts'), 'utf8'),
};
const TMP = mkdtempSync(join(tmpdir(), 'baja-'));
let cargas = 0;
const ANA = '1a2b3c4d-0000-4000-8000-00000000a0a0';

/* ── El Supabase de mentira ────────────────────────────────────────────── */

function mundo(extra = {}) {
  const m = {
    usuarios: [
      { id: ANA, email: 'ana@ejemplo.test', nombre: 'Ana Prueba', rol: 'coach', org_id: null, auth_id: 'a-ana', configuracion: { plan: 'basic', estado_sub: 'prueba' }, created_at: '2026-09-20T10:00:00Z' },
      { id: 'u-otra', email: 'otra@ejemplo.test', nombre: 'Otra', rol: 'coach', org_id: null, auth_id: 'a-otra', configuracion: {}, created_at: '2026-01-01T00:00:00Z' },
      { id: 'u-admin', email: 'admin@ejemplo.test', nombre: 'Admin', rol: 'admin', org_id: null, auth_id: 'a-admin', configuracion: {}, created_at: '2026-01-01T00:00:00Z' },
    ],
    // ana tiene DOS identidades: contraseña y Google.
    auth: [
      { id: 'a-ana', email: 'ana@ejemplo.test' },
      { id: 'a-ana-google', email: 'ANA@ejemplo.test' },
      { id: 'a-otra', email: 'otra@ejemplo.test' },
      { id: 'a-admin', email: 'admin@ejemplo.test' },
    ],
    tokens: { 'tok-ana': 'a-ana', 'tok-otra': 'a-otra', 'tok-admin': 'a-admin' },
    organizaciones: [],
    authFalla: false,
    usuariosNoBorra: false,
    log: [],
    correos: [],
    eventos: [],
    ...extra,
  };
  return m;
}

function ilike(valor, patron) {
  const re = new RegExp('^' + patron.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.') + '$', 'i');
  return re.test(valor || '');
}

function fetchFalso(m) {
  return async (url, init = {}) => {
    const u = new URL(url);
    const metodo = (init.method || 'GET').toUpperCase();
    const auth = (init.headers && (init.headers.Authorization || init.headers.authorization)) || '';
    m.log.push(`${metodo} ${u.pathname}${u.search}`);
    const j = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } });

    if (u.pathname === '/auth/v1/user') {
      const tok = auth.replace(/^Bearer\s+/, '');
      const id = m.tokens[tok];
      const a = m.auth.find((x) => x.id === id);
      return a ? j({ id: a.id, email: a.email.toLowerCase() }) : j({ msg: 'bad jwt' }, 401);
    }
    if (u.pathname === '/auth/v1/admin/users' && metodo === 'GET') {
      if (auth !== 'Bearer svc') return j({}, 401);
      return j({ users: m.auth.slice() });
    }
    const mDel = u.pathname.match(/^\/auth\/v1\/admin\/users\/(.+)$/);
    if (mDel && metodo === 'DELETE') {
      if (m.authFalla) return j({ msg: 'boom' }, 500);
      const id = decodeURIComponent(mDel[1]);
      const n = m.auth.length;
      m.auth = m.auth.filter((x) => x.id !== id);
      return m.auth.length < n ? j({}) : j({ msg: 'not found' }, 404);
    }
    if (u.pathname === '/functions/v1/send-email') {
      m.correos.push(JSON.parse(init.body));
      return j({ ok: true });
    }
    if (u.pathname === '/rest/v1/eventos' && metodo === 'POST') {
      m.eventos.push(JSON.parse(init.body));
      return new Response(null, { status: 201 });
    }
    if (u.pathname === '/rest/v1/organizaciones') {
      const owner = (u.searchParams.get('owner_id') || '').replace(/^eq\./, '');
      return j(m.organizaciones.filter((o) => o.owner_id === owner));
    }
    if (u.pathname === '/rest/v1/usuarios') {
      const id = (u.searchParams.get('id') || '').replace(/^eq\./, '');
      if (metodo === 'DELETE') {
        const fila = m.usuarios.find((x) => x.id === id);
        if (!fila || m.usuariosNoBorra) return j([]);
        m.usuarios = m.usuarios.filter((x) => x.id !== id);
        return j([fila]);
      }
      let rows = m.usuarios.slice();
      if (id) rows = rows.filter((x) => x.id === id);
      const or = u.searchParams.get('or');
      if (or) {
        const conds = or.replace(/^\(|\)$/g, '').split(',');
        rows = rows.filter((x) => conds.some((c) => {
          if (c.startsWith('auth_id.eq.')) return x.auth_id === c.slice(11);
          if (c.startsWith('email.ilike.')) return ilike(x.email, c.slice(12));
          return false;
        }));
      }
      const rol = u.searchParams.get('rol');
      if (rol) rows = rows.filter((x) => x.rol === rol.replace(/^eq\./, ''));
      return j(rows);
    }
    if (/^\/rest\/v1\/(coach_nudges|solicitudes|mensajes_admin_coach|informes|cv_publicados|candidatos)$/.test(u.pathname)) {
      return new Response(null, { status: 204 });
    }
    throw new Error(`El banco no cubre ${metodo} ${u.pathname}`);
  };
}

async function llamar(cual, m, token, body, fuentes = FUENTE) {
  let handler = null;
  globalThis.Deno = {
    env: { get: (k) => ({ SUPABASE_URL: 'https://falso.test', SUPABASE_SERVICE_ROLE_KEY: 'svc', SUPABASE_ANON_KEY: 'anon' })[k] || '' },
    serve: (h) => { handler = h; },
  };
  const fetchReal = globalThis.fetch;
  globalThis.fetch = fetchFalso(m);
  try {
    // Import FRESCO en un árbol propio: la función registra su manejador al
    // cargarse, y el import relativo del módulo compartido tiene que resolver.
    const raiz = join(TMP, `c${++cargas}`);
    mkdirSync(join(raiz, '_shared/cuenta'), { recursive: true });
    mkdirSync(join(raiz, cual), { recursive: true });
    writeFileSync(join(raiz, '_shared/cuenta/eliminar-cuenta.ts'), fuentes.shared);
    writeFileSync(join(raiz, cual, 'index.ts'), cual === 'eliminar-mi-cuenta' ? fuentes.self : fuentes.admin);
    await import(pathToFileURL(join(raiz, cual, 'index.ts')).href);
    if (!handler) throw new Error('La función no registró ningún manejador');
    const res = await handler(new Request(`https://falso.test/${cual}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }));
    const t = await res.text();
    return { status: res.status, data: t ? JSON.parse(t) : null };
  } finally {
    globalThis.fetch = fetchReal;
  }
}

const muta = (log) => log.filter((l) => /^(DELETE|PATCH) \/rest\//.test(l));

/* ── El recorrido ─────────────────────────────────────────────────────── */

async function recorrido(fuentes = FUENTE) {
  const r = [];
  const ok = (id, cond, det) => r.push({ id, ok: !!cond, det });
  const BAJA = { confirmacion: 'ELIMINAR', motivo: 'solo_probaba', detalle: 'era una prueba' };

  // C-1 · sin ELIMINAR no se hace nada
  { const m = mundo(); const x = await llamar('eliminar-mi-cuenta', m, 'tok-ana', { motivo: 'otro' }, fuentes);
    ok('C-1 sin confirmación → 400 y nada tocado', x.status === 400 && m.log.length === 0, x.status); }

  // C-2 · sin sesión
  { const m = mundo(); const x = await llamar('eliminar-mi-cuenta', m, 'anon', BAJA, fuentes);
    ok('C-2 con la anon key → 401', x.status === 401 && muta(m.log).length === 0, x.status); }

  // B-1 · coach individual: todo fuera, Auth primero
  { const m = mundo(); const x = await llamar('eliminar-mi-cuenta', m, 'tok-ana', BAJA, fuentes);
    const iAuth = m.log.findIndex((l) => l.startsWith('DELETE /auth/v1/admin/users/'));
    const iDato = m.log.findIndex((l) => /^(DELETE|PATCH) \/rest\//.test(l));
    ok('B-1a 200 ok', x.status === 200 && x.data && x.data.ok === true, JSON.stringify(x.data));
    ok('B-1b las DOS identidades de Auth de ese email borradas', !m.auth.some((a) => a.email.toLowerCase() === 'ana@ejemplo.test'), m.auth.map((a) => a.id).join(','));
    ok('B-1c Auth se borra ANTES que cualquier dato', iAuth >= 0 && iDato > iAuth, `${iAuth} < ${iDato}`);
    ok('B-1d la fila de usuarios se fue', !m.usuarios.some((u) => u.id === ANA));
    ok('B-1e coach individual: sus clientes se borran', m.log.some((l) => l.startsWith('DELETE /rest/v1/candidatos?coach_id=eq.' + ANA + '')));
    ok('B-1f nadie más tocado', m.usuarios.some((u) => u.id === 'u-otra') && m.auth.some((a) => a.id === 'a-otra'));
    ok('B-1g correo de despedida a ella', m.correos.some((c) => c.to === 'ana@ejemplo.test' && /eliminada/.test(c.subject) && /registrarte de nuevo/.test(c.html)));
    ok('B-1h aviso interno con el motivo', m.correos.some((c) => c.to === 'hi@pathwaycareercoach.com' && /Solo estaba probando/.test(c.html)));
    const ev = m.eventos[0] || {};
    ok('B-1i baja registrada SIN email', ev.tipo === 'AccountDeleted' && ev.payload && ev.payload.motivo === 'solo_probaba' && !ev.actor_email && !JSON.stringify(ev).includes('ana@'), JSON.stringify(ev)); }

  // B-2 · el cuerpo no elige a quién borrar
  { const m = mundo(); await llamar('eliminar-mi-cuenta', m, 'tok-ana', { ...BAJA, usuario_id: 'u-otra', coach_id: 'u-otra' }, fuentes);
    ok('B-2 un usuario_id ajeno en el cuerpo se ignora', m.usuarios.some((u) => u.id === 'u-otra') && !m.usuarios.some((u) => u.id === ANA)); }

  // C-3 · coach dentro de una organización: los clientes se quedan
  { const m = mundo(); m.usuarios[0].org_id = 'org-1';
    await llamar('eliminar-mi-cuenta', m, 'tok-ana', BAJA, fuentes);
    ok('C-3 en organización: clientes desligados, NO borrados',
      m.log.some((l) => l.startsWith('PATCH /rest/v1/candidatos?coach_id=eq.' + ANA + '')) && !m.log.some((l) => l.startsWith('DELETE /rest/v1/candidatos'))); }

  // C-4 · dueña (por rol) y C-5 · dueña (por owner_id) → 403 sin tocar nada
  { const m = mundo(); m.usuarios[0].rol = 'owner'; m.usuarios[0].org_id = 'org-1';
    const x = await llamar('eliminar-mi-cuenta', m, 'tok-ana', BAJA, fuentes);
    ok('C-4 dueña por rol → 403 y nada tocado', x.status === 403 && x.data.error === 'es_duena_de_organizacion' && muta(m.log).length === 0 && m.auth.length === 4); }
  { const m = mundo(); m.organizaciones = [{ id: 'org-9', owner_id: ANA, activo: true }];
    const x = await llamar('eliminar-mi-cuenta', m, 'tok-ana', BAJA, fuentes);
    ok('C-5 dueña por owner_id → 403', x.status === 403 && m.auth.length === 4); }

  // C-6 · admin
  { const m = mundo(); const x = await llamar('eliminar-mi-cuenta', m, 'tok-admin', BAJA, fuentes);
    ok('C-6 admin → 403', x.status === 403 && x.data.error === 'cannot_delete_admin' && m.auth.length === 4); }

  // B-3 · Auth falla → no se toca ningún dato
  { const m = mundo({ authFalla: true }); const x = await llamar('eliminar-mi-cuenta', m, 'tok-ana', BAJA, fuentes);
    ok('B-3 si Auth falla: 502 y CERO datos tocados', x.status === 502 && muta(m.log).length === 0 && m.usuarios.length === 3 && m.correos.length === 0, `${x.status} ${muta(m.log).length}`); }

  // B-4 · un DELETE que no borra nada no es un éxito (R-23)
  { const m = mundo({ usuariosNoBorra: true }); const x = await llamar('eliminar-mi-cuenta', m, 'tok-ana', BAJA, fuentes);
    ok('B-4 DELETE sin filas → 502, sin correo', x.status === 502 && x.data.error === 'delete_failed' && m.correos.length === 0, `${x.status}`); }

  // C-7 · el email con comodín no casa con otra persona
  { const m = mundo();
    m.usuarios = [
      { id: 'u-x', email: 'a_b@ejemplo.test', nombre: 'X', rol: 'coach', org_id: null, auth_id: null, configuracion: {} },
      { id: 'u-y', email: 'axb@ejemplo.test', nombre: 'Y', rol: 'coach', org_id: null, auth_id: 'a-y', configuracion: {} },
    ];
    m.auth = [{ id: 'a-x', email: 'a_b@ejemplo.test' }, { id: 'a-y', email: 'axb@ejemplo.test' }];
    m.tokens = { 'tok-x': 'a-x' };
    await llamar('eliminar-mi-cuenta', m, 'tok-x', BAJA, fuentes);
    ok('C-7 `_` en el email no arrastra a otra cuenta', m.usuarios.some((u) => u.id === 'u-y') && m.auth.some((a) => a.id === 'a-y') && !m.usuarios.some((u) => u.id === 'u-x')); }

  // A-1 · borrado de admin: también Auth, y el correo
  { const m = mundo(); const x = await llamar('admin-coach-op', m, 'tok-admin', { op: 'delete_coach', coach_id: ANA, wipe: true }, fuentes);
    ok('A-1a admin borra también la identidad de Auth', x.status === 200 && !m.auth.some((a) => a.email.toLowerCase() === 'ana@ejemplo.test'), JSON.stringify(x.data));
    ok('A-1b y le manda el correo por defecto', m.correos.some((c) => c.to === 'ana@ejemplo.test') && x.data.correo_enviado === true); }
  { const m = mundo(); await llamar('admin-coach-op', m, 'tok-admin', { op: 'delete_coach', coach_id: ANA, avisar: false }, fuentes);
    ok('A-2 con avisar:false no sale correo', m.correos.length === 0 && !m.usuarios.some((u) => u.id === ANA)); }
  { const m = mundo(); const x = await llamar('admin-coach-op', m, 'tok-otra', { op: 'delete_coach', coach_id: ANA }, fuentes);
    ok('A-3 quien no es admin → 403', x.status === 403 && m.usuarios.length === 3); }

  return r;
}

/* ── Ejecución + canarios ─────────────────────────────────────────────── */

const res = await recorrido();
for (const x of res) console.log(`${x.ok ? 'ok  ' : 'FAIL'}  ${x.id}${x.ok ? '' : '  · ' + (x.det ?? '')}`);
const fallos = res.filter((x) => !x.ok).length;

const CANARIOS = [
  { nombre: 'sin borrar la identidad de Auth', vigila: 'B-1b', cambia: (s) => s.replace(/for \(const id of ids\) \{[\s\S]*?\n  \}\n/, '') },
  { nombre: 'Auth falla y se sigue igual', vigila: 'B-3', cambia: (s) => s.replace('if (!r || (!r.ok && r.status !== 404)) return { ok: false, error: "auth_delete_failed", status: 502 };', '') },
  { nombre: 'sin comprobar que la fila se borró', vigila: 'B-4', cambia: (s) => s.replace('if (!Array.isArray(rows) || rows.length !== 1) return { ok: false, error: "delete_failed", status: 502 };', '') },
];
let canariosMal = 0;
for (const c of CANARIOS) {
  const mutado = c.cambia(FUENTE.shared);
  if (mutado === FUENTE.shared) { console.log(`CANARIO «${c.nombre}»: la mutación no aplicó — el canario está roto`); canariosMal++; continue; }
  const r = await recorrido({ ...FUENTE, shared: mutado });
  const rojo = r.filter((x) => !x.ok).map((x) => x.id);
  const porSuAsercion = rojo.some((id) => id.startsWith(c.vigila));
  console.log(`canario «${c.nombre}» → ${porSuAsercion ? 'ROJO por ' + c.vigila : 'NO lo detecta (' + rojo.join(', ') + ')'}`);
  if (!porSuAsercion) canariosMal++;
}

console.log(`\n${res.length - fallos}/${res.length} ok · canarios ${CANARIOS.length - canariosMal}/${CANARIOS.length}`);
process.exit(fallos || canariosMal ? 1 : 0);
