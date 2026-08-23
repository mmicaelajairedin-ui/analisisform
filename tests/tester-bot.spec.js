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

// Genera UUID v4 para correlation_id
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Detecta el entorno (production/staging/preview/local)
function detectEnvironment() {
  const host = typeof window !== 'undefined' ? window.location.hostname : (process.env.BASE_URL || '');
  if (host.includes('pathwaycareercoach.com')) return 'production';
  if (host.includes('staging')) return 'staging';
  if (host.includes('analisisform.pages.dev')) return 'preview';
  if (host.includes('localhost')) return 'local';
  return 'unknown';
}

// Clasifica error y extrae código de error si existe
function classifyError(errorMessage) {
  const msg = String(errorMessage || '');

  // Detectar error_id de patrones conocidos
  if (/foto_url|NULL|avatar|persist|foto_perfil/i.test(msg)) {
    return { error_id: 'ERR-UPLOAD-001', code: 'AVATAR_PERSIST', module: 'avatar', severity: 'CRITICAL' };
  }
  if (/Authorization|header|403|401|_uploadDoc|exercise|photo.*auth/i.test(msg)) {
    return { error_id: 'ERR-UPLOAD-002', code: 'EXERCISE_AUTH', module: 'exercise', severity: 'CRITICAL' };
  }
  if (/File.name|extension|Google Photo|MIME|\.pop\(\)|png|jpg|webp|gif/i.test(msg)) {
    return { error_id: 'ERR-UPLOAD-003', code: 'FILE_EXT', module: 'exercise', severity: 'HIGH' };
  }
  if (/mzxgxkkgxvunpsiqbzxd|project_ref|SUPABASE_URL|ddxnrsnjdvtqhxunxbwj/i.test(msg)) {
    return { error_id: 'ERR-ENV-001', code: 'ENV_MISMATCH', module: 'environment', severity: 'CRITICAL' };
  }

  // Genérico
  return { error_id: 'ERR-UNKNOWN', code: 'UNKNOWN_ERROR', module: 'unknown', severity: 'MEDIUM' };
}

// Captura los errores de JS NO controlados (pageerror) de la página.
// Extiende con metadata: error_id, correlation_id, environment, etc.
function capturarErrores(page) {
  const correlationId = generateUUID();
  const environment = detectEnvironment();
  // Aqui se llamaba a getCommitHash(page), ANTES de que hubiera pagina cargada.
  // Hacia `page.evaluate(...)` SIN await: la promesa quedaba suelta y al navegar se
  // rechazaba con "Execution context was destroyed, most likely because of a
  // navigation". El try/catch no la atrapaba —es asincrona— y ese rechazo hundia el
  // test. Nueve de los nueve fallos de tester-bot del run #169 son este.
  //
  // Y ademas NUNCA funciono: `meta` era la promesa, no el elemento, asi que
  // `meta.getAttribute` lanzaba TypeError, el catch lo tragaba y la funcion devolvia
  // 'UNKNOWN' siempre. Quitarla no pierde ningun dato que se estuviera leyendo.
  // Comprobado en local con Chromium: 8/8 en test-tester-bot.mjs. (INC-026)
  const frontendCommit = 'UNKNOWN';

  /** @type {Array} */
  const errores = [];

  page.on('pageerror', (e) => {
    const s = String((e && e.message) || e);
    if (!RUIDO.test(s)) {
      const classification = classifyError(s);
      errores.push({
        message: s,
        error_id: classification.error_id,
        error_code: classification.code,
        module: classification.module,
        severity: classification.severity,
        correlation_id: correlationId,
        environment: environment,
        frontend_commit: frontendCommit,
        timestamp: new Date().toISOString(),
      });
    }
  });

  return { errores, correlationId, environment, frontendCommit };
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

// Recorre las secciones clickeando el sidebar. Cubre el panel del COACH
// (.cp-side-nav-item) Y los portales del CLIENTE de los 3 nichos —carrera,
// fitness y finanzas— que usan .ni. Best-effort: cada click puede fallar sin
// romper; lo que importa es que ninguna sección dispare un error de JS (queda
// registrado en el listener de pageerror).
async function navegarPanel(page) {
  const items = await page.locator('.cp-side-nav-item, .ni').all();
  // Presupuesto acotado: recorrer TODAS las secciones con 3s de espera por click
  // podía superar por sí solo el timeout del test en paneles con muchas secciones
  // (dueño multicoach) → falsa alarma "timeout" sin que nada esté roto. Cap total
  // de ~15s + click más corto: sigue cubriendo el recorrido y deja margen al test.
  const deadline = Date.now() + 15000;
  for (const it of items) {
    if (Date.now() > deadline) break;
    try { await it.click({ timeout: 1200 }); await page.waitForTimeout(250); } catch (_e) { /* seguimos */ }
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
      const { errores, correlationId } = capturarErrores(page);
      await entrar(page, c.email, c.pass);
      await verificarRender(page);
      await navegarPanel(page); // recorre las secciones (panel del coach o portal del cliente)
      expect(errores, `Errores de JS (${c.label}) [${correlationId}]:\n` + errores.map(e => `${e.error_id}: ${e.message}`).join('\n')).toHaveLength(0);
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
    const { errores, correlationId } = capturarErrores(page);
    await entrar(page, /** @type {any} */(coach).email, /** @type {any} */(coach).pass, /panel-v2/i);
    await verificarRender(page);
    // Ir a Clientes.
    await page.locator('[data-act="nav:clientes"]').first().click({ timeout: 6000 }).catch(() => {});
    await page.waitForTimeout(900);
    // Abrir el primer cliente de la lista.
    const card = page.locator('[data-act^="cli-open:"]').first();
    const hay = await card.count().catch(() => 0);
    test.skip(hay === 0, 'El coach de prueba no tiene clientes cargados — se saltea');
    // La fila puede estar fuera de vista o cubierta (resuelve pero no clickea).
    // La traemos a la vista y, si aún se resiste, forzamos el click.
    await card.scrollIntoViewIfNeeded().catch(() => {});
    await card.click({ timeout: 8000 }).catch(async () => { await card.click({ force: true }); });
    await page.waitForTimeout(900);
    // El botón "Reenviar invitación" vive en la ficha (pestaña Perfil, por defecto).
    const btn = page.locator('[data-act="reinvitar"]').first();
    await expect(btn, 'No apareció "Reenviar invitación" en la ficha (¿desplegado el fix?)').toBeVisible({ timeout: 8000 });
    await btn.click();
    // Debe confirmar que SALIÓ. Si dice "no se pudo enviar", el email está roto
    // (típicamente BREVO_API_KEY) → el test falla y el reporte lo marca.
    await expect(page.locator('body'), 'La invitación no confirmó envío (¿email/Brevo caído?)').toContainText(/invitaci[oó]n reenviada/i, { timeout: 15000 });
    await expect(page.locator('body')).not.toContainText(/no se pudo enviar/i);
    expect(errores, `Errores de JS al reenviar invitación [${correlationId}]:\n` + errores.map(e => `${e.error_id}: ${e.message}`).join('\n')).toHaveLength(0);
  });
});

// 💳 Selector de plan del coach — cambiar de plan / pagar SIN salir del panel.
// El plan vive como sub-pestaña de Config (Mi cuenta), así que la navegación del
// sidebar (navegarPanel) NO lo alcanza → esta pantalla estaría sin cubrir. Acá el
// bot entra como coach, abre Config → Mi cuenta, y togglea Mensual/Anual + elige
// Basic/Pro. Cada click re-renderiza cfgPlan; si algo tira un error de JS o el
// selector deja de renderizar, el reporte diario lo marca. NO clickea el CTA de
// pago (no abre Stripe) — solo el toggle y los tiles, que son locales.
test.describe('💳 Selector de plan — cambiar de plan sin salir del panel', () => {
  const coach = CUENTAS.find((c) => c && (c.nav || /coach/i.test(c.label || '')));
  test('el coach abre su plan y togglea Anual/Mensual + Basic/Pro sin errores', async ({ page }) => {
    test.skip(!coach, 'Sin cuenta de coach de prueba (TEST_ACCOUNTS/TEST_COACH_*) — se saltea');
    const { errores, correlationId } = capturarErrores(page);
    await entrar(page, /** @type {any} */(coach).email, /** @type {any} */(coach).pass, /panel-v2/i);
    await verificarRender(page);
    // Config (sidebar) → Mi cuenta (sub-pestaña donde vive el plan).
    await page.locator('[data-act="nav:config"]').first().click({ timeout: 6000 }).catch(() => {});
    await page.waitForTimeout(500);
    await page.locator('[data-act="cfg:account"]').first().click({ timeout: 6000 }).catch(() => {});
    await page.waitForTimeout(600);
    // Si el coach de prueba es vitalicio/admin no hay selector (es correcto) → se saltea.
    const hay = await page.locator('[data-act="psel-bill"]').count().catch(() => 0);
    test.skip(hay === 0, 'Coach vitalicio/admin sin selector de plan — se saltea');
    // Togglear facturación y plan (locales, re-renderizan cfgPlan). No tocamos el CTA de pago.
    await page.locator('[data-act="psel-bill"][data-b="anual"]').first().click({ timeout: 4000 }).catch(() => {});
    await page.waitForTimeout(300);
    await page.locator('[data-act="psel-plan"][data-p="pro"]').first().click({ timeout: 4000 }).catch(() => {});
    await page.waitForTimeout(300);
    await page.locator('[data-act="psel-bill"][data-b="mensual"]').first().click({ timeout: 4000 }).catch(() => {});
    await page.waitForTimeout(300);
    // Tras togglear, el selector debe seguir renderizado (no se rompió el re-render).
    await expect(page.locator('.cp-psel-tiles'), 'El selector de plan dejó de renderizar tras togglear').toBeVisible({ timeout: 6000 });
    expect(errores, `Errores de JS en el selector de plan [${correlationId}]:\n` + errores.map(e => `${e.error_id}: ${e.message}`).join('\n')).toHaveLength(0);
  });
});

// 🏋️ Contrato de handoff del owner — Pathway tiene que ENTREGARLE la sesion a
// MultiCoach. Este test comprueba ESO y nada mas: no entra en MultiCoach ni
// valida su contenido, porque una caida de MultiCoach no debe poner en rojo el
// CI de Pathway. Esa validacion pertenece a la suite de MultiCoach.
//
// `login.html:898-917` tiene TRES desenlaces, y el test anterior los confundia
// todos en el mismo timeout de 25 s:
//   A · EXITO   -> pathway-handoff devuelve codigo -> pathwayplatforms.com/?handoff=<code>
//   B · FALLO   -> fallback de :917 -> pathwayplatforms.com/?v=<ts>. La sesion NO
//                  viaja: quien entra tendra que volver a identificarse. No es exito.
//   C · CRITICO -> no navega. El `fetch` de :902 NO tiene timeout, asi que si esa
//                  funcion se cuelga el `await` no vuelve, el `catch` no salta
//                  —no es un error de red— y se queda en la pantalla de login.
//
// Ensanchar el patron a /pathwayplatforms/ daria los tres por buenos. Por eso se
// afirma el CODIGO, no el dominio.
//
// NO se da por hecho que la cuenta TEST_GYM_* sea `rol='owner'`: no consta en
// ningun sitio del repositorio y su valor es un secreto. Lo unico descartado es
// que tome el camino de coach/admin, porque ese acaba en panel-v2.html y el test
// pasaria. Las dos hipotesis vivas —camino de owner, o login que no navega— las
// separan las aserciones de abajo, cada una con su mensaje.
test.describe('🏋️ Handoff del owner — Pathway entrega la sesion a MultiCoach', () => {
  test('el owner sale del login con un codigo de handoff', async ({ page }) => {
    const email = process.env.TEST_GYM_EMAIL;
    const password = process.env.TEST_GYM_PASSWORD;
    test.skip(!email || !password, 'Sin TEST_GYM_EMAIL/PASSWORD — se saltea');

    const { errores, correlationId } = capturarErrores(page);

    // Se graban las navegaciones: la SPA de MultiCoach consume el ?handoff= y
    // reescribe la URL, asi que mirar page.url() al final es una carrera.
    const navegaciones = [];
    page.on('framenavigated', (f) => { if (f === page.mainFrame()) navegaciones.push(f.url()); });

    await page.goto(`${BASE}login.html`, { waitUntil: 'domcontentloaded' });
    await page.fill('#email', /** @type {string} */ (email));
    await page.fill('#password', /** @type {string} */ (password));
    await page.locator('#password').press('Enter');

    // C · ¿salio del login? Esta asercion es la que separa las dos hipotesis.
    await expect(
      page,
      'El owner no salio de login.html en 25 s. O el login fallo, o el fetch a ' +
        'pathway-handoff (login.html:902, SIN timeout) no volvio y se queda ' +
        'plantado en la pantalla de login.',
    ).toHaveURL(/pathwayplatforms\.com|panel-v2/i, { timeout: 25000 });

    const destino = navegaciones.find((u) => /pathwayplatforms\.com|panel-v2/i.test(u)) || page.url();

    // La cuenta no toma el camino de owner. Lo dice, no pasa en silencio.
    expect(
      destino,
      `La cuenta TEST_GYM_* acabo en "${destino}": no toma el camino de owner. ` +
        'O le cambiaron el rol, o cambio la condicion de login.html:898.',
    ).toMatch(/pathwayplatforms\.com/i);

    // B · llego, pero sin sesion.
    expect(
      destino,
      `Llego a "${destino}" SIN ?handoff=. pathway-handoff no devolvio codigo y salto ` +
        'el fallback de login.html:917: la sesion no viaja y habra que entrar otra vez.',
    ).toMatch(/[?&]handoff=[^&]+/);

    // Errores de JS del propio login.html, que sigue siendo de Pathway.
    expect(
      errores,
      `Errores de JS en el login del owner [${correlationId}]:\n` +
        errores.map((e) => `${e.error_id}: ${e.message}`).join('\n'),
    ).toHaveLength(0);
  });
});

// Panel multi-coach (gimnasio / consultora): la vista de equipo bajo una marca.
// Chequeamos que cargue y renderice sin errores.
test.describe('🏋️ Panel multi-coach (gym) — carga y renderiza', () => {
  test('multicoach.html carga y renderiza sin errores de JS', async ({ page }) => {
    const { errores, correlationId } = capturarErrores(page);
    await page.goto(`${BASE}multicoach.html`, { waitUntil: 'domcontentloaded' });
    await verificarRender(page);
    expect(errores, `Errores de JS en multicoach [${correlationId}]:\n` + errores.map(e => `${e.error_id}: ${e.message}`).join('\n')).toHaveLength(0);
  });
});
