// @ts-check
const { test, expect } = require('@playwright/test');

// 🤖 Bot de usuaria — recorrido LOGUEADO.
//
// Los otros specs chequean que las páginas "respondan 200". Este bot va un paso
// más: entra de VERDAD con las credenciales de prueba (como una persona), y
// verifica que el panel/portal RENDERICE y que no explote el JS en el camino —
// que es lo que un chequeo de status no ve (una página puede dar 200 y quedar
// en blanco por un error de JS).
//
// Credenciales por env (ya cableadas en daily-testing-agent.yml):
//   TEST_COACH_EMAIL / TEST_COACH_PASSWORD
//   TEST_CLIENT_EMAIL / TEST_CLIENT_PASSWORD
// Si faltan, el test se SALTEA (no rompe el reporte diario).
//
// No toca datos (no crea, edita ni borra nada): solo entra y mira.

const BASE = process.env.BASE_URL || 'https://pathwaycareercoach.com/';

// Errores de recursos externos / ruido de terceros que NO indican un bug propio.
const RUIDO = /favicon|analytics|gtag|googletagmanager|facebook|hotjar|clarity|Failed to load resource|net::ERR|ResizeObserver/i;

// Entra por login.html con email+password y espera el redirect al portal.
// Devuelve los errores de JS NO controlados (pageerror) capturados en el camino.
async function entrar(page, email, password) {
  /** @type {string[]} */
  const errores = [];
  page.on('pageerror', (e) => { const s = String(e && e.message || e); if (!RUIDO.test(s)) errores.push(s); });

  await page.goto(`${BASE}login.html`, { waitUntil: 'domcontentloaded' });
  await page.fill('#email', email);
  await page.fill('#password', password);
  // entrar() verifica async y recién ahí hace window.location.href al portal.
  await Promise.all([
    page.waitForURL(/panel-v2|empleado|cliente|pathway-(fit|fin)-cliente/i, { timeout: 25000 }),
    page.click('#btn'),
  ]);
  return errores;
}

// Verifica que el portal cargó de verdad: no volvió al login y hay contenido
// real en pantalla (no quedó en blanco por un error de arranque).
async function verificarRender(page) {
  expect(page.url(), 'Volvió al login → credenciales o sesión fallaron').not.toContain('login.html');
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  const texto = (await page.locator('body').innerText().catch(() => '')) || '';
  expect(texto.trim().length, 'El portal quedó en blanco (sin contenido)').toBeGreaterThan(40);
}

test.describe('🤖 Bot de usuaria — recorrido logueado', () => {
  test('Coach entra y su panel renderiza sin errores de JS', async ({ page }) => {
    const email = process.env.TEST_COACH_EMAIL;
    const password = process.env.TEST_COACH_PASSWORD;
    test.skip(!email || !password, 'Sin TEST_COACH_EMAIL/PASSWORD — se saltea');

    const errores = await entrar(page, /** @type {string} */(email), /** @type {string} */(password));
    await verificarRender(page);
    expect(errores, 'Errores de JS en el panel del coach:\n' + errores.join('\n')).toHaveLength(0);
  });

  test('Cliente entra y su portal renderiza sin errores de JS', async ({ page }) => {
    const email = process.env.TEST_CLIENT_EMAIL;
    const password = process.env.TEST_CLIENT_PASSWORD;
    test.skip(!email || !password, 'Sin TEST_CLIENT_EMAIL/PASSWORD — se saltea');

    const errores = await entrar(page, /** @type {string} */(email), /** @type {string} */(password));
    await verificarRender(page);
    expect(errores, 'Errores de JS en el portal del cliente:\n' + errores.join('\n')).toHaveLength(0);
  });
});
