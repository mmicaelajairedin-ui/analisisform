// 🎯 Recorrido de la superficie de PROGRAMAS DEL CLIENTE (cliente.html).
//
// Por que existe: la auditoria de agosto 2026 encontro que esta es la unica
// pantalla destinada al cliente y que NINGUN script de navegador la recorria.
// Por eso convivian dos bloques del Core (PWCoreProgram / PWCoreTimeline) que no
// se renderizaron nunca, un ReferenceError tapado por un try/catch mudo y una
// guarda de rol en lista NEGRA que dejaba entrar a owner/colaborador/empleado.
//
// Tier: DETERMINISTA Y LOCAL — mismo patron que tests/panel-outcomes.spec.js:
// se sirve el sitio con un http server local y las llamadas a Supabase se
// responden con fixtures. NO prueba produccion ni cuentas reales; el recorrido
// contra produccion con una cuenta de cliente de laboratorio necesita egress y
// credenciales, y va aparte.
//
// Correr:  npx playwright test tests/cliente-programas.spec.js

const { test, expect } = require('@playwright/test');
const { spawn } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PORT = 8127;
const ORIGIN = `http://localhost:${PORT}`;
let server;

test.beforeAll(async () => {
  server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 1500));
});
test.afterAll(() => { if (server) { try { server.kill('SIGKILL'); } catch (_e) { /* noop */ } } });

const COACH_ID = '22222222-2222-2222-2222-222222222222';
const CLIENT_EMAIL = 'cliente.programas@pathway.test';

const SESSION_CLIENTE = { id: 'c0000000-0000-0000-0000-000000000001', email: CLIENT_EMAIL, rol: 'cliente', nombre: 'Cliente Programas', activo: true };

// Cliente CON programa asignado: 4 fases con nombres del coach, semana 2 activa,
// una sesion pasada y una futura, y progreso marcado.
const HOY = new Date();
function ymd(offsetDias) {
  const d = new Date(HOY.getTime() + offsetDias * 24 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
}
const SESIONES = [
  { fecha: ymd(-7), hora: '17:00', trabajado: 'Revisamos el diagnostico inicial.', acordado: 'Reescribir el titular.', acciones: 'Reescribir titular\nActualizar CV', tareas_done: [0] },
  { fecha: ymd(7), hora: '18:30', trabajado: '', acordado: '', acciones: 'Preparar respuestas STAR', tareas_done: [] },
];
const ETAPAS_COACH = ['Diagnostico profundo', 'Marca personal', 'Red de contactos', 'Entrevistas'];

const CANDIDATO_CON_PROGRAMA = {
  id: 4242, nombre: 'Cliente Programas', email: CLIENT_EMAIL, coach_id: COACH_ID, activo: true,
  semana_activa: 2,
  etapas: JSON.stringify(ETAPAS_COACH),
  acciones_progreso: JSON.stringify([true, false, false]),
  sesiones_registro: JSON.stringify(SESIONES),
  nicho: 'carrera', created_at: '2026-01-01T00:00:00Z',
  // Ya acepto el consentimiento: sin esto el portal frena en el gate RGPD y
  // #app nunca se muestra (ver el test del gate mas abajo).
  consent_at: '2026-05-02T10:00:00Z', consent_version: '2026-05-01', consent_marketing: false,
};

// Cliente SIN programa: existe la ficha, pero el coach no cargo nada todavia.
const CANDIDATO_VACIO = {
  id: 4343, nombre: 'Cliente Vacio', email: CLIENT_EMAIL, coach_id: COACH_ID, activo: true,
  created_at: '2026-01-01T00:00:00Z',
  consent_at: '2026-05-02T10:00:00Z', consent_version: '2026-05-01', consent_marketing: false,
};

function fixtures(url, candidatos) {
  if (url.includes('/candidatos')) return candidatos;
  return []; // informes, cv_publicados, citas, notificaciones, mensajes… vacio
}

// Deja el portal en un estado reproducible: fixtures REST, edge functions vacias,
// nada de CDN externo (el SDK de Supabase cae solo a la anon key) y la sesion
// puesta en localStorage antes del boot.
async function montarPortal(page, { session, candidatos = [], restStatus = 200 } = {}) {
  const jsErrors = [];
  page.on('pageerror', (e) => jsErrors.push(String((e && e.message) || e)));

  await page.route('**/cdn.jsdelivr.net/**', (r) => r.abort());
  await page.route('**/fonts.googleapis.com/**', (r) => r.abort());
  await page.route('**/fonts.gstatic.com/**', (r) => r.abort());
  await page.route('**/rest/v1/**', (r) => r.fulfill({
    status: restStatus,
    contentType: 'application/json',
    body: restStatus === 200 ? JSON.stringify(fixtures(r.request().url(), candidatos)) : JSON.stringify({ message: 'boom' }),
  }));
  await page.route('**/functions/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) }));
  await page.route('**/auth/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) }));

  await page.addInitScript((s) => {
    try { if (s) localStorage.setItem('mj_user', JSON.stringify(s)); else localStorage.removeItem('mj_user'); } catch (_e) { /* noop */ }
  }, session || null);

  return jsErrors;
}

// ── 1. Acceso del cliente + programa asignado ────────────────────────────────
test('el cliente entra a su portal y ve el programa que le armo el coach', async ({ page }) => {
  const jsErrors = await montarPortal(page, { session: SESSION_CLIENTE, candidatos: [CANDIDATO_CON_PROGRAMA] });

  await page.goto(`${ORIGIN}/cliente.html`, { waitUntil: 'domcontentloaded' });

  // No lo echaron: sigue en /cliente.html.
  await expect(page).toHaveURL(/cliente\.html/);

  // El roadmap del programa aparece y NO se queda en el loader.
  const roadmap = page.locator('.rm-wrap').first();
  await expect(roadmap, 'El roadmap del programa ("Tu proceso") no se renderizo').toBeVisible({ timeout: 20000 });
  await expect(page.locator('#loading')).toBeHidden({ timeout: 20000 });

  // Los nombres de las fases son los QUE PUSO EL COACH, no los defaults.
  const labels = await page.locator('.rm-wrap .rm-lbl').allTextContents();
  for (const etapa of ETAPAS_COACH) {
    expect(labels, `La fase "${etapa}" que guardo el coach no llego al cliente`).toContain(etapa);
  }
  expect(labels.join(' | '), 'Se colaron los nombres por defecto pese a que el coach puso los suyos').not.toContain('Evaluación');

  // La semana activa (semana_activa=2) es la marcada como actual.
  const activo = page.locator('.rm-wrap .rm-item.active').first();
  await expect(activo).toHaveCount(1);
  await expect(activo).toContainText(ETAPAS_COACH[1]);

  // Progreso de la semana: el badge existe y es un porcentaje real.
  await expect(page.locator('.rm-badge').first()).toHaveText(/^\d{1,3}% esta semana$/);

  expect(jsErrors, 'Errores de JS en el portal del cliente:\n' + jsErrors.join('\n')).toHaveLength(0);
});

// ── 1b. El gate de consentimiento es la puerta del recorrido ────────────────
// Primer ingreso: el portal NO deja ver nada hasta aceptar terminos (RGPD).
// Este es literalmente el primer paso del recorrido del cliente.
test('el primer ingreso pide consentimiento y recien despues abre el programa', async ({ page }) => {
  const SIN_CONSENT = { ...CANDIDATO_CON_PROGRAMA };
  delete SIN_CONSENT.consent_at;
  const jsErrors = await montarPortal(page, { session: SESSION_CLIENTE, candidatos: [SIN_CONSENT] });
  await page.goto(`${ORIGIN}/cliente.html`, { waitUntil: 'domcontentloaded' });

  const gate = page.locator('#consent-ov');
  await expect(gate, 'No aparecio el gate de consentimiento en el primer ingreso').toBeVisible({ timeout: 20000 });
  await expect(page.locator('.rm-wrap').first(), 'El programa se ve ANTES de consentir').toBeHidden();
  await expect(page.locator('#cons-go')).toBeDisabled();

  await page.locator('#cons-terms').check();
  await expect(page.locator('#cons-go')).toBeEnabled();
  await page.locator('#cons-go').click();

  await expect(gate).toHaveCount(0, { timeout: 15000 });
  await expect(page.locator('.rm-wrap').first(), 'Tras aceptar, el programa no aparecio').toBeVisible({ timeout: 15000 });

  expect(jsErrors, 'Errores de JS en el gate de consentimiento:\n' + jsErrors.join('\n')).toHaveLength(0);
});

// ── 2. Detalle / navegacion dentro del programa ──────────────────────────────
test('el cliente puede abrir una fase ya recorrida del programa', async ({ page }) => {
  const jsErrors = await montarPortal(page, { session: SESSION_CLIENTE, candidatos: [CANDIDATO_CON_PROGRAMA] });
  await page.goto(`${ORIGIN}/cliente.html`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.rm-wrap').first()).toBeVisible({ timeout: 20000 });

  // Las fases ya recorridas (<= la activa) son clickeables; las futuras no.
  const paso1 = page.locator('.rm-wrap .rm-item').first();
  await expect(paso1).toHaveAttribute('onclick', /verSemana\(1\)/);
  const ultimo = page.locator('.rm-wrap .rm-item').last();
  await expect(ultimo, 'Una fase futura no deberia ser clickeable').not.toHaveAttribute('onclick', /verSemana/);

  await paso1.click();
  await expect(page.locator('#semana-view-panel'), 'Abrir una fase pasada no mostro nada').not.toBeEmpty({ timeout: 10000 });

  expect(jsErrors, 'Errores de JS al navegar el programa:\n' + jsErrors.join('\n')).toHaveLength(0);
});

// ── 3. Ausencia de programa / datos vacios ───────────────────────────────────
test('sin programa cargado el portal se ve entero, con vacios explicados', async ({ page }) => {
  const jsErrors = await montarPortal(page, { session: SESSION_CLIENTE, candidatos: [CANDIDATO_VACIO] });
  await page.goto(`${ORIGIN}/cliente.html`, { waitUntil: 'domcontentloaded' });

  // Sigue habiendo roadmap (con los nombres por defecto) — no una pantalla rota.
  await expect(page.locator('.rm-wrap').first()).toBeVisible({ timeout: 20000 });
  await expect(page.locator('#loading')).toBeHidden({ timeout: 20000 });
  await expect(page.locator('#load-err')).toHaveText('');

  // Hay estado vacio explicado, no un hueco mudo.
  await expect(page.locator('#mc .empty').first(), 'Sin datos no aparece ningun estado vacio explicado').toBeVisible({ timeout: 10000 });

  // Nada de basura de render en la pantalla del cliente.
  const texto = (await page.locator('#mc').innerText()).replace(/\s+/g, ' ');
  for (const basura of ['undefined', 'NaN%', '[object Object]', 'null%']) {
    expect(texto, `El portal muestra "${basura}" cuando el cliente no tiene datos`).not.toContain(basura);
  }

  expect(jsErrors, 'Errores de JS con el cliente sin datos:\n' + jsErrors.join('\n')).toHaveLength(0);
});

// ── 4. Las fases del coach llegan aunque no sean exactamente 4 ───────────────
// El panel guarda CUALQUIER cantidad de fases ("+ Agregar paso") y le promete al
// coach "el cliente las ve". Antes cliente.html exigia length===4 exacto y tiraba
// el resto: un coach con 1 fase veia como su cliente leia "Evaluación".
test('una sola fase guardada por el coach tambien llega al cliente', async ({ page }) => {
  const UNA = { ...CANDIDATO_CON_PROGRAMA, semana_activa: 1, etapas: JSON.stringify(['Semana de adaptacion']) };
  const jsErrors = await montarPortal(page, { session: SESSION_CLIENTE, candidatos: [UNA] });
  await page.goto(`${ORIGIN}/cliente.html`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.rm-wrap').first()).toBeVisible({ timeout: 20000 });

  const labels = await page.locator('.rm-wrap .rm-lbl').allTextContents();
  expect(labels[0], 'La unica fase del coach se perdio en el portal del cliente').toBe('Semana de adaptacion');
  expect(jsErrors, 'Errores de JS:\n' + jsErrors.join('\n')).toHaveLength(0);
});

// ── 5. Ficha inexistente y base caida: mensajes, no pantalla en blanco ───────
test('sin ficha del cliente el portal lo dice, no se queda en blanco', async ({ page }) => {
  await montarPortal(page, { session: SESSION_CLIENTE, candidatos: [] });
  await page.goto(`${ORIGIN}/cliente.html`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#load-err')).toContainText('Perfil no encontrado', { timeout: 20000 });
});

test('con la base caida el portal muestra el error de conexion', async ({ page }) => {
  await montarPortal(page, { session: SESSION_CLIENTE, candidatos: [], restStatus: 500 });
  await page.goto(`${ORIGIN}/cliente.html`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#load-err')).toContainText(/Error de conexi|Perfil no encontrado/, { timeout: 20000 });
});

// ── 6. La superficie del cliente NO es para el equipo ────────────────────────
for (const rol of ['coach', 'admin', 'owner', 'colaborador', 'empleado']) {
  test(`un ${rol} NO se queda en la superficie del cliente`, async ({ page }) => {
    await montarPortal(page, {
      session: { id: 'e0000000-0000-0000-0000-00000000000e', email: `${rol}@pathway.test`, rol, nombre: rol, activo: true },
      candidatos: [CANDIDATO_CON_PROGRAMA],
    });
    await page.goto(`${ORIGIN}/cliente.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForURL((u) => !/cliente\.html/.test(u.pathname), { timeout: 15000 });
    expect(page.url(), `Un ${rol} se quedo dentro del portal del cliente`).not.toContain('cliente.html');
  });
}

test('el coach en modo preview SI ve el portal, con el aviso de vista de coach', async ({ page }) => {
  await montarPortal(page, {
    session: { id: COACH_ID, email: 'coach@pathway.test', rol: 'coach', nombre: 'Coach', activo: true },
    candidatos: [CANDIDATO_CON_PROGRAMA],
  });
  await page.goto(`${ORIGIN}/cliente.html?coach_view=${encodeURIComponent(CLIENT_EMAIL)}`, { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(/cliente\.html/);
  await expect(page.locator('#coach-preview-banner'), 'Falta el aviso de "Vista del coach"').toBeVisible({ timeout: 20000 });
});

test('un coach ajeno no entra al portal de un cliente que no es suyo', async ({ page }) => {
  await montarPortal(page, {
    session: { id: '99999999-9999-9999-9999-999999999999', email: 'otro@pathway.test', rol: 'coach', nombre: 'Otro', activo: true },
    candidatos: [CANDIDATO_CON_PROGRAMA],
  });
  await page.goto(`${ORIGIN}/cliente.html?coach_view=${encodeURIComponent(CLIENT_EMAIL)}`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#load-err')).toContainText('Sin permisos', { timeout: 20000 });
});

// ── 7. Invariantes de la superficie ──────────────────────────────────────────
test('el portal del cliente no le ofrece la comunidad cerrada de COACHES', async ({ page }) => {
  const jsErrors = await montarPortal(page, { session: SESSION_CLIENTE, candidatos: [CANDIDATO_CON_PROGRAMA] });
  await page.goto(`${ORIGIN}/cliente.html`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.rm-wrap').first()).toBeVisible({ timeout: 20000 });

  await expect(page.locator('a[href*="comunidad.html"]'), 'El portal del cliente linkea la comunidad de coaches').toHaveCount(0);
  const texto = await page.locator('body').innerText();
  expect(texto, 'El cliente esta leyendo copy dirigido a coaches').not.toContain('Conecta con otros coaches');

  // Un solo roadmap: si vuelve el work center del Core, se duplica.
  await expect(page.locator('.rm-wrap')).toHaveCount(1);
  await expect(page.locator('text=Roadmap del programa'), 'Volvio el roadmap duplicado del Core').toHaveCount(0);

  expect(jsErrors, 'Errores de JS:\n' + jsErrors.join('\n')).toHaveLength(0);
});
