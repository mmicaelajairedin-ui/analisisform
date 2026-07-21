// @ts-check
const { test, expect } = require('@playwright/test');

// 🤖 Bot de usuaria — recorre CADA panel/portal como una persona, para cazar
// errores antes que los coaches/clientes reales.
//
// Los otros specs chequean "responde 200". Este entra de verdad, verifica que
// RENDERICE, NAVEGA las secciones del panel, y falla si aparece cualquier error
// de JS (como el crash "_sb is not a function"). Un 200 no ve nada de eso.
//
// Cuentas de prueba — dos formas (la primera gana):
//   1) TEST_ACCOUNTS = JSON, ej:
//      [{"label":"Coach","email":"...","pass":"...","nav":true},
//       {"label":"Cliente fitness","email":"...","pass":"..."}]
//   2) Secrets individuales: TEST_COACH_EMAIL/PASSWORD, TEST_CLIENT_EMAIL/PASSWORD.
// Si no hay ninguna, los tests se SALTEAN (no rompen el reporte).
//
// No toca datos: solo entra, mira y navega.

const BASE = process.env.BASE_URL || 'https://pathwaycareercoach.com/';

// Ruido de terceros (recursos externos) que NO es un bug propio.
const RUIDO = /favicon|analytics|gtag|googletagmanager|facebook|hotjar|clarity|Failed to load resource|net::ERR|ResizeObserver/i;

// Lista de cuentas: TEST_ACCOUNTS (JSON) o, en su defecto, los secrets sueltos.
function cuentas() {
  const raw = process.env.TEST_ACCOUNTS;
  if (raw) {
    try { const a = JSON.parse(raw); if (Array.isArray(a) && a.length) return a; } catch (_e) { /* cae al fallback */ }
  }
  const list = [];
  if (process.env.TEST_COACH_EMAIL && process.env.TEST_COACH_PASSWORD)
    list.push({ label: 'Coach', email: process.env.TEST_COACH_EMAIL, pass: process.env.TEST_COACH_PASSWORD, nav: true });
  if (process.env.TEST_CLIENT_EMAIL && process.env.TEST_CLIENT_PASSWORD)
    list.push({ label: 'Cliente', email: process.env.TEST_CLIENT_EMAIL, pass: process.env.TEST_CLIENT_PASSWORD });
  return list;
}
const CUENTAS = cuentas();

// Captura los errores de JS NO controlados (pageerror) de la página.
function capturarErrores(page) {
  /** @type {string[]} */
  const errores = [];
  page.on('pageerror', (e) => { const s = String((e && e.message) || e); if (!RUIDO.test(s)) errores.push(s); });
  return errores;
}

// Verifica que renderizó una app real. La plataforma es un SPA: primero pinta el
// cascarón y DESPUÉS carga datos y renderiza. Por eso ESPERAMOS (poll) a que haya
// contenido sustancial, en vez de sacar una foto instantánea apenas aparece el
// primer botón (que daba falsos negativos: "quedó casi vacío" con 51 chars). Si
// tras 15s sigue casi vacío → ahí sí es un panel roto y el test falla.
async function verificarRender(page) {
  expect(page.url(), 'Quedó en el login → credenciales o sesión fallaron').not.toContain('login.html');
  await expect.poll(
    async () => ((await page.locator('body').innerText().catch(() => '')) || '').trim().length,
    { timeout: 15000, message: 'El portal no cargó contenido (quedó casi vacío tras 15s)' },
  ).toBeGreaterThan(120);
  const interactivos = await page.locator('button, a[href], [role="button"]').count();
  expect(interactivos, 'No renderizó UI (sin botones ni links)').toBeGreaterThan(0);
}

// Recorre las secciones del panel del coach clickeando el sidebar. Best-effort:
// cada click puede fallar sin romper — lo que importa es que ninguna sección
// dispare un error de JS (queda registrado en el listener de pageerror).
async function navegarPanel(page) {
  const items = await page.locator('.cp-side-nav-item').all();
  for (const it of items) {
    try { await it.click({ timeout: 3000 }); await page.waitForTimeout(350); } catch (_e) { /* seguimos */ }
  }
}

// Entra por login.html. El submit se dispara con Enter en el password (login.html
// tiene onkeydown → entrar()); NO clickeamos el botón porque tiene una animación
// (.beacon) que lo vuelve "no estable" para Playwright y el click se cuelga.
async function entrar(page, email, password, urlPat) {
  await page.goto(`${BASE}login.html`, { waitUntil: 'domcontentloaded' });
  await page.fill('#email', email);
  await page.fill('#password', password);
  await Promise.all([
    // waitUntil:'commit' → resuelve apenas navega a la URL nueva, sin esperar a
    // que la página PESADA (multicoach carga datos + imágenes) termine de cargar
    // entera. El contenido lo espera después verificarRender (poll).
    page.waitForURL(urlPat || /panel-v2|empleado|cliente|pathway-(fit|fin)-cliente|multicoach|empresa/i, { timeout: 25000, waitUntil: 'commit' }),
    page.locator('#password').press('Enter'),
  ]);
}

test.describe('🤖 Bot de usuaria — recorre cada panel', () => {
  for (const c of CUENTAS) {
    test(`${c.label}: entra, renderiza y no hay errores de JS`, async ({ page }) => {
      const errores = capturarErrores(page);
      await entrar(page, c.email, c.pass);
      await verificarRender(page);
      if (c.nav) await navegarPanel(page); // navega las secciones del panel del coach
      expect(errores, `Errores de JS (${c.label}):\n` + errores.join('\n')).toHaveLength(0);
    });
  }

  test('hay cuentas de prueba configuradas', () => {
    test.skip(CUENTAS.length === 0, 'Sin TEST_ACCOUNTS ni TEST_COACH_*/TEST_CLIENT_* — se saltea');
    expect(CUENTAS.length).toBeGreaterThan(0);
  });
});

// ✉️ Invitación al cliente — el problema histórico "no me llega la invitación".
// El bot entra como coach, abre un cliente y toca "Reenviar invitación": si el
// email SALE de verdad, el panel dice "Invitación reenviada" (el backend devuelve
// sent=true). Así el reporte diario avisa solo si el alta+email funciona, sin
// tener que preguntarle a ningún coach. Manda UN email/día al inbox de prueba.
test.describe('✉️ Invitación al cliente — el email sale de verdad', () => {
  const coach = CUENTAS.find((c) => c && (c.nav || /coach/i.test(c.label || '')));
  test('el coach reenvía la invitación y el email sale (sent=true)', async ({ page }) => {
    test.skip(!coach, 'Sin cuenta de coach de prueba (TEST_ACCOUNTS/TEST_COACH_*) — se saltea');
    const errores = capturarErrores(page);
    await entrar(page, /** @type {any} */(coach).email, /** @type {any} */(coach).pass, /panel-v2/i);
    await verificarRender(page);
    // Ir a Clientes.
    await page.locator('[data-act="nav:clientes"]').first().click({ timeout: 6000 }).catch(() => {});
    await page.waitForTimeout(900);
    // Abrir el primer cliente de la lista.
    const card = page.locator('[data-act^="cli-open:"]').first();
    const hay = await card.count().catch(() => 0);
    test.skip(hay === 0, 'El coach de prueba no tiene clientes cargados — se saltea');
    await card.click({ timeout: 6000 });
    await page.waitForTimeout(900);
    // El botón "Reenviar invitación" vive en la ficha (pestaña Perfil, por defecto).
    const btn = page.locator('[data-act="reinvitar"]').first();
    await expect(btn, 'No apareció "Reenviar invitación" en la ficha (¿desplegado el fix?)').toBeVisible({ timeout: 8000 });
    await btn.click();
    // Debe confirmar que SALIÓ. Si dice "no se pudo enviar", el email está roto
    // (típicamente BREVO_API_KEY) → el test falla y el reporte lo marca.
    await expect(page.locator('body'), 'La invitación no confirmó envío (¿email/Brevo caído?)').toContainText(/invitaci[oó]n reenviada/i, { timeout: 15000 });
    await expect(page.locator('body')).not.toContainText(/no se pudo enviar/i);
    expect(errores, 'Errores de JS al reenviar invitación:\n' + errores.join('\n')).toHaveLength(0);
  });
});

// Panel multi-coach (gimnasio / consultora): la vista de equipo bajo una marca.
// Chequeamos que cargue y renderice sin errores. (El recorrido logueado del
// dueño del gym se suma cuando esté lista su cuenta de empresa.)
test.describe('🏋️ Panel multi-coach (gym) — carga y renderiza', () => {
  test('Dueño del gym entra y ve su red (si hay credenciales)', async ({ page }) => {
    const email = process.env.TEST_GYM_EMAIL;
    const password = process.env.TEST_GYM_PASSWORD;
    test.skip(!email || !password, 'Sin TEST_GYM_EMAIL/PASSWORD — se saltea');

    const errores = capturarErrores(page);
    await entrar(page, /** @type {string} */(email), /** @type {string} */(password), /multicoach|empresa|panel-v2/i);
    // Si el login lo dejó en el panel del coach, vamos a su multicoach.
    if (!/multicoach|empresa/i.test(page.url())) {
      await page.goto(`${BASE}multicoach.html`, { waitUntil: 'domcontentloaded' });
    }
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
