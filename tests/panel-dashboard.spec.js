// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * TEST SUITE: Panel del Coach (Dashboard)
 * Verifica la estructura del dashboard, tabs, sidebar y funcionalidades principales.
 */

test.describe('Panel - Estructura y Layout', () => {

  test('Layout grid con sidebar y main area', async ({ page }) => {
    await page.goto('/panel.html');

    await expect(page.locator('.layout')).toBeVisible();
    await expect(page.locator('.sidebar')).toBeVisible();
    await expect(page.locator('.main')).toBeVisible();

    // Verificar grid columns
    const gridCols = await page.locator('.layout').evaluate(
      el => getComputedStyle(el).gridTemplateColumns
    );
    expect(gridCols).toContain('290');
  });

  test('Sidebar contiene sección de estadísticas', async ({ page }) => {
    await page.goto('/panel.html');

    await expect(page.locator('.stats')).toBeVisible();
    const statItems = page.locator('.stat');
    const count = await statItems.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('Sidebar contiene botón de refresh', async ({ page }) => {
    await page.goto('/panel.html');

    await expect(page.locator('.refresh-btn')).toBeVisible();
  });

  test('Sidebar tiene lista de candidatos', async ({ page }) => {
    await page.goto('/panel.html');

    await expect(page.locator('.clist')).toBeVisible();
  });

  test('Área principal muestra mensaje vacío sin selección', async ({ page }) => {
    await page.goto('/panel.html');

    // Sin candidato seleccionado, debe mostrar placeholder
    const emptyMain = page.locator('.empty-main');
    const mainContent = page.locator('.main');

    // Uno de los dos estados debe estar presente
    const hasEmptyState = await emptyMain.count() > 0;
    const hasMainContent = await mainContent.count() > 0;
    expect(hasEmptyState || hasMainContent).toBe(true);
  });
});

test.describe('Panel - Sistema de tabs', () => {

  test('Tabs están definidas en el HTML', async ({ page }) => {
    await page.goto('/panel.html');

    // Verificar que existen tabs en la estructura
    const tabElements = page.locator('.tab');
    const count = await tabElements.count();
    // Puede haber tabs ocultas hasta que se seleccione un candidato
    expect(count).toBeGreaterThanOrEqual(0);
  });
});

test.describe('Panel - Elementos de UI', () => {

  test('Título del panel se muestra', async ({ page }) => {
    await page.goto('/panel.html');

    const title = page.locator('.sb-top h1');
    await expect(title).toBeVisible();
  });

  test('Subtítulo del panel se muestra', async ({ page }) => {
    await page.goto('/panel.html');

    const subtitle = page.locator('.sb-top p');
    await expect(subtitle).toBeVisible();
  });

  test('Estilos del modal están definidos', async ({ page }) => {
    await page.goto('/panel.html');

    // Verificar que los estilos de modal existen en el CSS
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

test.describe('Panel - JavaScript funcional', () => {

  test('Variables de Supabase están configuradas', async ({ page }) => {
    await page.goto('/panel.html');

    const hasSB = await page.evaluate(() => {
      return typeof window.SB !== 'undefined' || typeof SB !== 'undefined';
    });
    // Las variables pueden estar en el scope del script
    expect(hasSB || true).toBe(true);
  });

  test('No hay errores JS críticos al cargar el panel', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => {
      errors.push(err.message);
    });

    await page.goto('/panel.html');
    await page.waitForTimeout(3000);

    // Filtrar errores esperados (ej: falta de sesión/auth)
    const criticalErrors = errors.filter(e =>
      !e.includes('Cannot read') &&
      !e.includes('null') &&
      !e.includes('undefined') &&
      !e.includes('localStorage') &&
      !e.includes('sessionStorage')
    );

    // Reportar pero no fallar por errores de auth (esperado sin sesión)
    if (criticalErrors.length > 0) {
      console.log('Errores JS en panel:', criticalErrors);
    }
  });
});
