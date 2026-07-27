// 🎯 Tests de RESULTADO del panel del coach.
//
// A diferencia del tester-bot (que verifica "carga sin errores de JS"), estos
// tests montan el panel REAL con DATOS DE PRUEBA controlados (Supabase simulado)
// y verifican que lo que se VE sea lo correcto — justo la clase de bug que se
// nos escapaba porque no rompe nada, solo muestra lo que no va:
//   • la foto del cliente aparece (no el avatar de iniciales)      → bug "sin foto"
//   • detecta la foto esté donde esté (foto_perfil O dentro del CV) → bug "Juan José"
//
// No dependen de producción ni de cuentas reales: sirven el sitio local y
// responden las llamadas a Supabase con fixtures. Deterministas y rápidos.

const { test, expect } = require('@playwright/test');
const { spawn } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PORT = 8123;
const ORIGIN = `http://localhost:${PORT}`;
let server;

test.beforeAll(async () => {
  server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 1500)); // que levante el server
});
test.afterAll(() => { if (server) { try { server.kill('SIGKILL'); } catch (_e) { /* noop */ } } });

const COACH_ID = '11111111-1111-1111-1111-111111111111';
const ME = { id: COACH_ID, email: 'testcoach@pathway.test', rol: 'admin', nombre: 'Test Coach', activo: true, configuracion: {} };

// PNG 1x1 real → las fotos falsas CARGAN (si no, el onerror de avImg las cambia
// por el avatar de iniciales y el test no probaría nada).
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

// Ana tiene la foto en candidatos.foto_perfil. Beto la tiene SOLO dentro del CV
// (cv_publicados.contenido._photo) — el caso "Juan José" que salía sin foto.
const CANDIDATOS = [
  { id: 'aaaaaaaa-0000-0000-0000-000000000001', nombre: 'Ana Con Foto', email: 'ana@test.com', coach_id: COACH_ID, foto_perfil: 'https://photos.test/ana.jpg', activo: true, created_at: '2026-01-01T00:00:00Z', pago_recibido: true },
  { id: 'bbbbbbbb-0000-0000-0000-000000000002', nombre: 'Beto Solo CV', email: 'beto@test.com', coach_id: COACH_ID, activo: true, created_at: '2026-01-02T00:00:00Z' },
];
const CV_PUBLICADOS = [ { email: 'beto@test.com', contenido: JSON.stringify({ _photo: 'https://photos.test/beto.jpg' }), coach_id: COACH_ID } ];

function restFixture(url) {
  if (url.includes('/candidatos')) return CANDIDATOS;
  if (url.includes('/cv_publicados')) return CV_PUBLICADOS;
  if (url.includes('/usuarios')) return [{ ...ME, foto_url: null }];
  return []; // informes, solicitudes, reviews, mensajes, citas, coaches… vacío
}

test('el panel muestra la foto REAL del cliente (foto_perfil y foto del CV)', async ({ page }) => {
  const jsErrors = [];
  page.on('pageerror', (e) => jsErrors.push(String((e && e.message) || e)));

  // Fotos falsas → sirven un PNG real para que carguen.
  await page.route('**/photos.test/**', (r) => r.fulfill({ status: 200, contentType: 'image/png', body: PNG }));
  // Supabase REST → fixtures.
  await page.route('**/rest/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(restFixture(r.request().url())) }));
  // Edge functions (calendar, etc.) → vacío.
  await page.route('**/functions/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ events: [] }) }));
  // Auth → sin sesión real (el panel usa login por localStorage).
  await page.route('**/auth/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) }));

  // Sesión simulada ANTES de que arranque el panel.
  await page.addInitScript((me) => { try { localStorage.setItem('mj_user', JSON.stringify(me)); } catch (_e) { /* noop */ } }, ME);

  await page.goto(`${ORIGIN}/panel-v2.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.cp-app', { timeout: 20000 });

  // Ir a la lista completa de Clientes.
  await page.locator('[data-act="nav:clientes"]').first().click({ timeout: 10000 }).catch(() => {});

  // RESULTADO: las dos fotos reales tienen que estar en pantalla. Si la detección
  // se rompe, avImg cae al avatar de iniciales (data:) y estos locators no existen.
  await expect(
    page.locator('img[src*="ana.jpg"]').first(),
    'No se detectó la foto por candidatos.foto_perfil',
  ).toBeVisible({ timeout: 12000 });

  await expect(
    page.locator('img[src*="beto.jpg"]').first(),
    'No se detectó la foto que vive DENTRO del CV (bug tipo Juan José)',
  ).toBeVisible({ timeout: 12000 });

  expect(jsErrors, 'Errores de JS al renderizar el panel:\n' + jsErrors.join('\n')).toHaveLength(0);
});
