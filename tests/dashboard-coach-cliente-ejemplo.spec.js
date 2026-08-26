// @ts-check
/**
 * Dashboard del coach — el cliente de EJEMPLO no puede pasar por real.
 *
 * Un coach sin clientes no tiene `CLIENTS` vacío: el panel siempre inyecta el
 * cliente de onboarding «María García» (`_example: true`). Todo el resto del
 * dashboard lo excluye de sus cuentas —«Mi negocio · Clientes activos 0», la
 * tarjeta de riesgo y el ranking filtran `!c._example`— y la lista de Clientes
 * lo etiqueta con `Ejemplo` (viewClientes). La única superficie que NO lo hacía
 * era la tarjeta «Tus clientes» del propio dashboard: pintaba a María con el
 * mismo aspecto que un cliente real, así que el dashboard se contradecía consigo
 * mismo (KPI «0 clientes» encima de una lista con un cliente) y un coach recién
 * llegado veía un cliente inventado como si fuera suyo.
 *
 * Mismo harness que panel-outcomes.spec.js: servidor local + fixtures de
 * Supabase. No depende de producción ni del despliegue.
 */
const { test, expect } = require('@playwright/test');
const { spawn } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PORT = 8126;
const ORIGIN = `http://127.0.0.1:${PORT}`;
let server;

test.beforeAll(async () => {
  server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 1500));
});
test.afterAll(() => { if (server) { try { server.kill('SIGKILL'); } catch (_e) { /* noop */ } } });

const COACH_ID = '11111111-1111-1111-1111-111111111111';
const ME = { id: COACH_ID, email: 'coach@test.com', rol: 'coach', nombre: 'Ana Ruiz', activo: true, configuracion: {} };

const CLIENTE_REAL = {
  id: 'aaaaaaaa-0000-0000-0000-000000000001', nombre: 'Juan Pérez', email: 'juan@test.com',
  coach_id: COACH_ID, activo: true, created_at: '2026-08-01T00:00:00Z', semana_activa: 2, pago_recibido: true,
};

/** Abre el panel del coach con los candidatos indicados y devuelve la página. */
async function abrirPanel(page, candidatos) {
  await page.route('**/rest/v1/**', (r) => {
    const u = r.request().url();
    let body = [];
    if (u.includes('/candidatos')) body = candidatos;
    else if (u.includes('/usuarios')) body = [{ ...ME, foto_url: null }];
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.route('**/functions/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"events":[]}' }));
  await page.route('**/auth/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.addInitScript((me) => { try { localStorage.setItem('mj_user', JSON.stringify(me)); } catch (_e) { /* noop */ } }, ME);
  await page.goto(`${ORIGIN}/panel-v2.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.cp-app', { timeout: 20000 });
  await page.waitForFunction(() => Array.isArray(window.CLIENTS), null, { timeout: 20000 });
  await page.waitForTimeout(1500);
}

/** Filas de la tarjeta «Tus clientes» del dashboard, con su texto y si van etiquetadas. */
function filasDashboard(page) {
  return page.evaluate(() => {
    const card = [...document.querySelectorAll('.cp-card')].find((c) => {
      const t = c.querySelector('.cp-card-title');
      return t && /tus clientes|your clients/i.test(t.innerText);
    });
    if (!card) return null;
    return [...card.querySelectorAll('.cp-todo-row')].map((f) => ({
      texto: f.innerText.replace(/\s+/g, ' ').trim(),
      etiquetado: /ejemplo|example|sample/i.test(f.innerHTML),
    }));
  });
}

test.describe('Dashboard del coach · cliente de ejemplo', () => {
  test('coach SIN clientes reales: la fila del ejemplo va etiquetada', async ({ page }) => {
    const errs = [];
    page.on('pageerror', (e) => errs.push(String((e && e.message) || e)));
    await abrirPanel(page, []);

    const estado = await page.evaluate(() => ({
      total: (window.CLIENTS || []).length,
      reales: (window.CLIENTS || []).filter((c) => c && !c._example).length,
    }));
    // Premisa del bug: el panel inyecta el ejemplo, así que CLIENTS nunca está vacío.
    expect(estado.reales, 'el fixture no debe traer clientes reales').toBe(0);
    expect(estado.total, 'el panel debe seguir inyectando el cliente de ejemplo').toBeGreaterThan(0);

    const filas = await filasDashboard(page);
    expect(filas, 'no se encontró la tarjeta «Tus clientes» del dashboard').not.toBeNull();
    expect(filas.length).toBeGreaterThan(0);
    for (const f of filas) {
      expect(f.etiquetado, `fila sin etiqueta «Ejemplo» en el dashboard: ${f.texto}`).toBe(true);
    }
    expect(errs, 'errores de JS:\n' + errs.join('\n')).toHaveLength(0);
  });

  test('el dashboard no se contradice: si el KPI dice 0 clientes, ninguna fila pasa por real', async ({ page }) => {
    await abrirPanel(page, []);
    const kpiCero = await page.evaluate(() => {
      const card = [...document.querySelectorAll('.cp-card')].find((c) => /mi negocio|my business/i.test(c.innerText));
      return card ? /clientes activos\s*0\b|active clients\s*0\b/i.test(card.innerText.replace(/\s+/g, ' ')) : false;
    });
    expect(kpiCero, 'se esperaba «Clientes activos 0» en Mi negocio').toBe(true);

    const filas = await filasDashboard(page);
    const sinEtiqueta = (filas || []).filter((f) => !f.etiquetado);
    expect(
      sinEtiqueta.map((f) => f.texto),
      'el KPI dice 0 clientes pero el dashboard lista filas como si fueran reales',
    ).toEqual([]);
  });

  test('coach CON un cliente real: su fila NO lleva la etiqueta', async ({ page }) => {
    await abrirPanel(page, [CLIENTE_REAL]);
    const filas = await filasDashboard(page);
    expect(filas, 'no se encontró la tarjeta «Tus clientes»').not.toBeNull();
    const juan = filas.find((f) => /Juan Pérez/.test(f.texto));
    expect(juan, 'el cliente real no aparece en el dashboard').toBeTruthy();
    expect(juan.etiquetado, 'un cliente REAL no puede salir marcado como Ejemplo').toBe(false);
  });

  test('la lista de Clientes sigue etiquetando el ejemplo (no se toca)', async ({ page }) => {
    await abrirPanel(page, []);
    await page.evaluate(() => { window.state.section = 'clientes'; window.state.clienteSel = null; window.render(); });
    await page.waitForTimeout(1000);
    const etiquetadoEnLista = await page.evaluate(() =>
      /ejemplo/i.test(document.querySelector('.cp-main, main, body').innerHTML));
    expect(etiquetadoEnLista, 'la lista de Clientes perdió la etiqueta «Ejemplo»').toBe(true);
  });
});
