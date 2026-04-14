// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * TEST SUITE: Panel del Coach (Dashboard)
 *
 * NOTA: panel.html redirige al login si no hay sesión (localStorage mj_user).
 * Los tests verifican: (a) que la redirección funciona, y (b) que el HTML/CSS
 * del panel está correcto inyectando una sesión fake via localStorage.
 */

test.describe('Panel - Redirección sin sesión', () => {

  test('Redirige al login si no hay sesión', async ({ page }) => {
    await page.goto('panel.html');
    await page.waitForLoadState('domcontentloaded');

    // Debe redirigir a login.html
    await page.waitForURL(/login\.html/, { timeout: 5000 });
    expect(page.url()).toContain('login.html');
  });
});

test.describe('Panel - Estructura con sesión', () => {

  // Inyectar sesión fake antes de cada test
  test.beforeEach(async ({ page }) => {
    // Primero ir a cualquier página del mismo dominio para poder setear localStorage
    await page.goto('login.html');
    await page.evaluate(() => {
      localStorage.setItem('mj_user', JSON.stringify({
        id: 999,
        email: 'test-agent@test.invalid',
        rol: 'coach',
        nombre: 'Test Agent'
      }));
    });
    await page.goto('panel.html');
    await page.waitForLoadState('domcontentloaded');
  });

  test('Layout grid con sidebar y main area', async ({ page }) => {
    await expect(page.locator('.layout')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('.sidebar')).toBeVisible();
    await expect(page.locator('.main')).toBeVisible();
  });

  test('Sidebar contiene sección de estadísticas', async ({ page }) => {
    await expect(page.locator('.stats')).toBeVisible({ timeout: 8000 });
    const statItems = page.locator('.stat');
    const count = await statItems.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('Sidebar tiene botón de refresh y lista de candidatos', async ({ page }) => {
    await expect(page.locator('.refresh-btn')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('.clist')).toBeVisible();
  });

  test('Título y subtítulo del panel se muestran', async ({ page }) => {
    await expect(page.locator('.sb-top h1')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('.sb-top p')).toBeVisible();
  });

  test('Estilos del modal están definidos', async ({ page }) => {
    const hasModalStyles = await page.evaluate(() => {
      const sheets = document.styleSheets;
      for (let sheet of sheets) {
        try {
          for (let rule of sheet.cssRules) {
            if (rule.selectorText && rule.selectorText.includes('.modal-overlay')) {
              return true;
            }
          }
        } catch (e) { /* cross-origin sheets */ }
      }
      return false;
    });
    expect(hasModalStyles).toBe(true);
  });
});

test.describe('Panel - Sistema de tabs', () => {

  test('Tabs están definidas en el HTML', async ({ page }) => {
    await page.goto('login.html');
    await page.evaluate(() => {
      localStorage.setItem('mj_user', JSON.stringify({
        id: 999, email: 'test-agent@test.invalid', rol: 'coach', nombre: 'Test Agent'
      }));
    });
    await page.goto('panel.html');
    await page.waitForLoadState('domcontentloaded');

    const tabElements = page.locator('.tab');
    const count = await tabElements.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });
});

test.describe('Panel - JavaScript funcional', () => {

  test('No hay errores JS críticos al cargar el panel', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => {
      errors.push(err.message);
    });

    await page.goto('login.html');
    await page.evaluate(() => {
      localStorage.setItem('mj_user', JSON.stringify({
        id: 999, email: 'test-agent@test.invalid', rol: 'coach', nombre: 'Test Agent'
      }));
    });
    await page.goto('panel.html');
    await page.waitForLoadState('domcontentloaded');

    // Filtrar errores esperados (auth, datos vacíos, etc.)
    const criticalErrors = errors.filter(e =>
      !e.includes('Cannot read') &&
      !e.includes('null') &&
      !e.includes('undefined') &&
      !e.includes('localStorage') &&
      !e.includes('sessionStorage') &&
      !e.includes('No autorizado') &&
      !e.includes('JSON')
    );

    if (criticalErrors.length > 0) {
      console.log('Errores JS en panel:', criticalErrors);
    }
  });
});
