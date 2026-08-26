// @ts-check
/**
 * INC-039 — Ramas vacías de las fichas de Cliente y Coach (multicoach.html).
 *
 * Dos defectos simétricos, ambos en modo RED REAL (MC_REAL):
 *
 *  1. Ficha del CLIENTE · pestaña «Recursos» — la tarjeta "Recursos del programa"
 *     listaba `DET().prog`, que es la plantilla de MEDICIONES de la maqueta
 *     ("9 jul · 78.2 kg"). En una red real inventaba 3 recursos y su rama vacía
 *     ("Sin recursos cargados aún") era código muerto: `DET().prog` nunca está
 *     vacío. Los recursos REALES (`k.recursos`) solo salían en la otra tarjeta.
 *
 *  2. Ficha del COACH · pestaña «Sesiones» — el estado vacío ("Cuando X agende
 *     sesiones...") se mostraba en cuanto el `coach-api-gateway` no respondía,
 *     aunque las citas del coach ya estuvieran cargadas en `MC_CITAS` — las
 *     mismas que la ficha del CLIENTE sí muestra vía `_mcSesReal`.
 *
 * Estos tests cargan el multicoach.html DEL REPO por file:// (sin servidor, sin
 * red) y montan el escenario en memoria, así que protegen la corrección aunque
 * el fix aún no esté desplegado.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const http = require('http');

// Servidor estático efímero sobre el REPO (no sobre producción): así el test
// protege el arreglo aunque todavía no esté desplegado, y no necesita red.
const ROOT = path.join(__dirname, '..');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon' };
let server, MC_URL;

test.beforeAll(async () => {
  server = http.createServer((req, res) => {
    const rel = decodeURIComponent((req.url || '/').split('?')[0]).replace(/^\/+/, '');
    const file = path.resolve(ROOT, rel);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    res.end(fs.readFileSync(file));
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  MC_URL = 'http://127.0.0.1:' + server.address().port + '/multicoach.html?demo=1';
});

test.afterAll(async () => { if (server) await new Promise(r => server.close(r)); });

/** Escenario de red REAL en memoria. `citas` alimenta MC_CITAS, `recursos` a k.recursos. */
function escenario({ citas = [], recursos = null } = {}) {
  return ({ citas, recursos }) => {
    // @ts-ignore — globals de multicoach.html
    MC_REAL = true;
    // @ts-ignore
    MC_CITAS = citas;
    const cat = (window.NICHOS && window.NICHOS[0] && window.NICHOS[0].id) || '';
    // @ts-ignore
    DB = {
      coaches: [{ id: 'c1', n: 'Ana Ruiz', ini: 'AR', email: 'ana@red.com', tel: '', nicho: cat, esp: '', est: 'activo', rat: 0, ret: null, cli: 1, ses: 0, foto: '', tipo: 'coach', servicios: [], esOwner: false }],
      clientes: [{ id: 'k1', n: 'Juan Pérez', ini: 'JP', email: 'juan@red.com', tel: '', empresa: '', nicho: cat, coach: 'c1', est: 'activo', prog: '', week: 1, plan: 'pending', med: 'pending', lastState: 'fresh', ult: 'recién', foto: '', recursos: recursos, sesDocs: [], progFotos: [] }]
    };
  };
}

const CITA = {
  id: 's1', email: 'juan@red.com', coach_id: 'c1',
  tipo: 'Sesión de seguimiento', estado: 'completada',
  inicio: '2026-08-12T15:30:00Z', resultado: 'Repasamos el CV'
};

async function abrir(page, datos) {
  const errores = [];
  page.on('pageerror', e => errores.push(e.message));
  await page.goto(MC_URL);
  await page.waitForFunction(() => typeof window.fichaCliente === 'function' && !!window.DB && !!window.PWI);
  await page.evaluate(escenario(datos), datos);
  return errores;
}

const panel = page => page.locator('.cp-cfg-panel').innerText();

test.describe('INC-039 · Ficha del CLIENTE — pestaña Recursos', () => {
  test('cero datos: muestra el estado vacío y NO inventa recursos', async ({ page }) => {
    const errores = await abrir(page, { citas: [], recursos: [] });
    await page.evaluate(() => { fichaCliente('k1'); _goCliTab('recursos'); });
    const txt = await panel(page);

    expect(txt).toContain('Sin recursos cargados aún');
    // La plantilla de mediciones de la maqueta no puede colarse como "recurso".
    expect(txt).not.toMatch(/\d+([.,]\d+)?\s*kg/);
    expect(txt).not.toContain('Semana 1');
    expect(errores).toEqual([]);
  });

  test('cero datos con k.recursos ausente (cliente recién creado): no rompe', async ({ page }) => {
    const errores = await abrir(page, { citas: [], recursos: null });
    await page.evaluate(() => { fichaCliente('k1'); _goCliTab('recursos'); });
    expect(await panel(page)).toContain('Sin recursos cargados aún');
    expect(errores).toEqual([]);
  });

  test('con datos: lista el recurso real UNA sola vez y sin estado vacío', async ({ page }) => {
    await abrir(page, { citas: [], recursos: ['Guia_Semana1.pdf'] });
    await page.evaluate(() => { fichaCliente('k1'); _goCliTab('recursos'); });
    const txt = await panel(page);

    expect(txt).toContain('Guia_Semana1.pdf');
    expect(txt).not.toContain('Sin recursos cargados aún');
    expect(txt.split('Guia_Semana1.pdf').length - 1).toBe(1); // sin duplicado
  });

  test('el nombre del recurso va escapado (anti-XSS)', async ({ page }) => {
    await abrir(page, { citas: [], recursos: ['<img src=x onerror=alert(1)>.pdf'] });
    const inyectado = await page.evaluate(() => {
      fichaCliente('k1'); _goCliTab('recursos');
      return document.querySelectorAll('.cp-cfg-panel img[src="x"]').length;
    });
    expect(inyectado).toBe(0);
  });
});

test.describe('INC-039 · Ficha del COACH — pestaña Sesiones', () => {
  test('cero datos: muestra el estado vacío', async ({ page }) => {
    const errores = await abrir(page, { citas: [] });
    await page.evaluate(() => { fichaCoach('c1'); _goCoachTab('sesiones'); });
    expect(await panel(page)).toContain('agende sesiones con sus clientes');
    expect(errores).toEqual([]);
  });

  test('con citas reales y el gateway caído: muestra las sesiones, NO el estado vacío', async ({ page }) => {
    // Sin _MC_COACH_DATA (gateway sin responder / error) las citas de MC_CITAS
    // siguen siendo la verdad: es lo mismo que ya muestra la ficha del cliente.
    const errores = await abrir(page, { citas: [CITA] });
    await page.evaluate(() => { _MC_COACH_DATA = {}; _curCoach = 'c1'; _coachTab = 'sesiones'; _renderCoachFicha(); });
    const txt = await panel(page);

    expect(txt).toContain('Sesión de seguimiento');
    expect(txt).toContain('Juan Pérez');          // cruza la cita con su cliente
    expect(txt).toContain('Repasamos el CV');
    expect(txt).not.toContain('agende sesiones con sus clientes');
    expect(errores).toEqual([]);
  });

  test('la ficha del coach y la del cliente cuentan la MISMA cita', async ({ page }) => {
    await abrir(page, { citas: [CITA], recursos: [] });
    const cli = await page.evaluate(() => { fichaCliente('k1'); _goCliTab('sesiones'); return document.querySelector('.cp-cfg-panel').innerText; });
    const coach = await page.evaluate(() => { _MC_COACH_DATA = {}; _curCoach = 'c1'; _coachTab = 'sesiones'; _renderCoachFicha(); return document.querySelector('.cp-cfg-panel').innerText; });

    expect(cli).toContain('Sesión de seguimiento');
    expect(coach).toContain('Sesión de seguimiento');
  });

  test('con métricas del gateway Y citas: convive el KPI con el detalle', async ({ page }) => {
    await abrir(page, { citas: [CITA] });
    const txt = await page.evaluate(() => {
      _MC_COACH_DATA = { c1: { metrics: { sesiones_ultima_semana: 3, informes_ultima_semana: 1 }, alerts: null, benchmarks: null, trends: null, clients: null } };
      _curCoach = 'c1'; _coachTab = 'sesiones'; _renderCoachFicha();
      return document.querySelector('.cp-cfg-panel').innerText;
    });

    expect(txt).toContain('Sesiones última semana');
    expect(txt).toContain('Sesión de seguimiento');
    expect(txt).not.toContain('agende sesiones con sus clientes');
  });

  test('el tipo de la cita va escapado (anti-XSS)', async ({ page }) => {
    await abrir(page, { citas: [Object.assign({}, CITA, { tipo: '<img src=x onerror=alert(1)>' })] });
    const inyectado = await page.evaluate(() => {
      _MC_COACH_DATA = {}; _curCoach = 'c1'; _coachTab = 'sesiones'; _renderCoachFicha();
      return document.querySelectorAll('.cp-cfg-panel img[src="x"]').length;
    });
    expect(inyectado).toBe(0);
  });
});

test.describe('INC-039 · la maqueta (demo) no se toca', () => {
  test('en demo la pestaña Sesiones del coach sigue mostrando su plantilla', async ({ page }) => {
    await page.goto(MC_URL);
    await page.waitForFunction(() => typeof window.fichaCoach === 'function' && !!window.DB && !!window.PWI);
    const txt = await page.evaluate(() => {
      const c = DB.coaches.filter(x => !x.esOwner)[0] || DB.coaches[0];
      _MC_COACH_DATA = {}; _curCoach = c.id; _coachTab = 'sesiones'; _renderCoachFicha();
      return document.querySelector('.cp-cfg-panel').innerText;
    });
    expect(txt).toContain('Agenda de');
    expect(txt).not.toContain('agende sesiones con sus clientes');
  });
});
