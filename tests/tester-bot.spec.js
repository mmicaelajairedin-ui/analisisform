// @ts-check
const { test, expect } = require('@playwright/test');

// 🤖 Bot de usuaria — recorrido LOGUEADO + panel multi-coach.
//
// Los otros specs chequean que las páginas "respondan 200". Este bot va un paso
// más: verifica que el panel/portal RENDERICE (UI real) y que no explote el JS —
// que es lo que un status 200 no ve (una página puede dar 200 y quedar en blanco
// o mostrar un error de JS, como el crash "_sb is not a function").
//
// Credenciales por env (ya cableadas en daily-testing-agent.yml):
//   TEST_COACH_EMAIL / TEST_COACH_PASSWORD
//   TEST_CLIENT_EMAIL / TEST_CLIENT_PASSWORD
// Si faltan, ese test se SALTEA (no rompe el reporte diario).
//
// No toca datos (no crea, edita ni borra nada): solo entra y mira.

const BASE = process.env.BASE_URL || 'https://pathwaycareercoach.com/';

// Errores de recursos externos / ruido de terceros que NO indican un bug propio.
const RUIDO = /favicon|analytics|gtag|googletagmanager|facebook|hotjar|clarity|Failed to load resource|net::ERR|ResizeObserver/i;

// Captura los errores de JS NO controlados (pageerror) que ocurran en la página.
function capturarErrores(page) {
  /** @type {string[]} */
  const errores = [];
  page.on('pageerror', (e) => { const s = String((e && e.message) || e); if (!RUIDO.test(s)) errores.push(s); });
  return errores;
}

// Verifica que el portal RENDERIZÓ una app real: no quedó en el login, apareció
// UI interactiva (botones/links) y hay contenido sustancial. Una página en
// blanco o de error no tiene botones ni casi texto → el test falla.
async function verificarRender(page) {
  expect(page.url(), 'Quedó en el login → credenciales o sesión fallaron').not.toContain('login.html');
  // Espera a que aparezca UI interactiva (resuelve apenas renderiza; si nunca
  // renderiza, corta a los 20s y el test falla — que es la señal correcta).
  await page.locator('button, a[href], [role="button"]').first().waitFor({ state: 'visible', timeout: 20000 });
  const interactivos = await page.locator('button, a[href], [role="button"]').count();
  expect(interactivos, 'No renderizó UI (sin botones ni links)').toBeGreaterThan(0);
  const texto = (await page.locator('body').innerText().catch(() => '')) || '';
  expect(texto.trim().length, 'Quedó casi vacío').toBeGreaterThan(120);
}

// Entra por login.html con email+password. El submit se dispara con Enter en el
// campo de contraseña (login.html tiene onkeydown → entrar()); NO clickeamos el
// botón porque tiene una animación (.beacon) que lo vuelve "no estable" para
// Playwright y el click se cuelga.
async function entrar(page, email, password) {
  await page.goto(`${BASE}login.html`, { waitUntil: 'domcontentloaded' });
  await page.fill('#email', email);
  await page.fill('#password', password);
  await Promise.all([
    page.waitForURL(/panel-v2|empleado|cliente|pathway-(fit|fin)-cliente/i, { timeout: 25000 }),
    page.locator('#password').press('Enter'),
  ]);
}

test.describe('🤖 Bot de usuaria — recorrido logueado', () => {
  test('Coach entra y su panel renderiza sin errores de JS', async ({ page }) => {
    const email = process.env.TEST_COACH_EMAIL;
    const password = process.env.TEST_COACH_PASSWORD;
    test.skip(!email || !password, 'Sin TEST_COACH_EMAIL/PASSWORD — se saltea');

    const errores = capturarErrores(page);
    await entrar(page, /** @type {string} */(email), /** @type {string} */(password));
    await verificarRender(page);
    expect(errores, 'Errores de JS en el panel del coach:\n' + errores.join('\n')).toHaveLength(0);
  });

  test('Cliente entra y su portal renderiza sin errores de JS', async ({ page }) => {
    const email = process.env.TEST_CLIENT_EMAIL;
    const password = process.env.TEST_CLIENT_PASSWORD;
    test.skip(!email || !password, 'Sin TEST_CLIENT_EMAIL/PASSWORD — se saltea');

    const errores = capturarErrores(page);
    await entrar(page, /** @type {string} */(email), /** @type {string} */(password));
    await verificarRender(page);
    expect(errores, 'Errores de JS en el portal del cliente:\n' + errores.join('\n')).toHaveLength(0);
  });
});

// Panel multi-coach (gimnasio / consultora / estudio): la vista de equipo con
// varios coaches bajo una marca. El bot chequea que cargue y renderice sin
// errores de JS. Como puede entrar logueado (dueño del gym) o directo, se prueban
// las dos vías: con credenciales si están (TEST_GYM_*), y siempre la carga directa.
test.describe('🏋️ Panel multi-coach (gym) — carga y renderiza', () => {
  test('Dueño del gym entra y su panel renderiza (si hay credenciales)', async ({ page }) => {
    const email = process.env.TEST_GYM_EMAIL;
    const password = process.env.TEST_GYM_PASSWORD;
    test.skip(!email || !password, 'Sin TEST_GYM_EMAIL/PASSWORD — se saltea');

    const errores = capturarErrores(page);
    // El dueño de empresa también entra por login; su portal es multicoach/empresa.
    await page.goto(`${BASE}login.html`, { waitUntil: 'domcontentloaded' });
    await page.fill('#email', email);
    await page.fill('#password', password);
    await Promise.all([
      page.waitForURL(/multicoach|empresa|panel-v2/i, { timeout: 25000 }),
      page.locator('#password').press('Enter'),
    ]);
    await verificarRender(page);
    expect(errores, 'Errores de JS en el panel multi-coach:\n' + errores.join('\n')).toHaveLength(0);
  });

  test('multicoach.html carga y renderiza sin errores de JS', async ({ page }) => {
    const errores = capturarErrores(page);
    await page.goto(`${BASE}multicoach.html`, { waitUntil: 'domcontentloaded' });
    await verificarRender(page);
    expect(errores, 'Errores de JS en multicoach:\n' + errores.join('\n')).toHaveLength(0);
  });
});
