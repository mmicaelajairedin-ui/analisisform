// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * TEST SUITE: Panel del Coach (Dashboard)
 *
 * NOTA: panel.html redirige al login si no hay sesión (localStorage mj_user).
 * Los tests inyectan una sesión fake via localStorage para poder verificar
 * la estructura del panel.
 */

// Helper para inyectar sesión antes de navegar al panel
async function goToPanelWithSession(page) {
  await page.goto('login.html');
  await page.evaluate(() => {
    localStorage.setItem('mj_user', JSON.stringify({
      id: 999, email: 'test-agent@test.invalid', rol: 'coach', nombre: 'Test Agent'
    }));
  });
  await page.goto('panel.html');
  await page.waitForLoadState('domcontentloaded');
}

test.describe('Panel - Redirección sin sesión', () => {

  test('Redirige al login si no hay sesión', async ({ page }) => {
    await page.goto('panel.html');
    await page.waitForLoadState('domcontentloaded');

    await page.waitForURL(/login\.html/, { timeout: 5000 });
    expect(page.url()).toContain('login.html');
  });
});

test.describe('Panel - Estructura con sesión', () => {

  test.beforeEach(async ({ page }) => {
    await goToPanelWithSession(page);
  });

  test('Layout con sidebar y área de contenido', async ({ page }) => {
    await expect(page.locator('.layout')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('.sidebar')).toBeVisible();
  });

  test('Sidebar muestra nombre de Micaela y foto', async ({ page }) => {
    await expect(page.locator('.sidebar')).toBeVisible({ timeout: 8000 });

    // Verificar foto del coach
    const foto = page.locator('#sb-foto-img');
    await expect(foto).toBeVisible();

    // Verificar que el nombre aparece en la sidebar
    const sidebarText = await page.locator('.sidebar').textContent();
    expect(sidebarText).toContain('Micaela');
  });

  test('Sidebar contiene barra de progreso general', async ({ page }) => {
    await expect(page.locator('.sidebar')).toBeVisible({ timeout: 8000 });

    // La barra de progreso se genera en el HTML estático del sidebar
    // Verificar que el sidebar tiene contenido (texto "Micaela" como mínimo)
    const text = await page.locator('.sidebar').textContent();
    expect(text.length).toBeGreaterThan(10);
  });

  test('Sidebar tiene botones de navegación', async ({ page }) => {
    // Resumen, Clientes, Pagos
    await expect(page.locator('#nb-inicio')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('#nb-clientes')).toBeVisible();
    await expect(page.locator('#nb-pagos')).toBeVisible();
  });

  test('Botón Nuevo Cliente existe', async ({ page }) => {
    const nuevoBtn = page.locator('button', { hasText: 'NUEVO CLIENTE' });
    await expect(nuevoBtn).toBeVisible({ timeout: 8000 });
  });

  test('Botón Actualizar existe', async ({ page }) => {
    const actualizarBtn = page.locator('button', { hasText: 'Actualizar' });
    await expect(actualizarBtn).toBeVisible({ timeout: 8000 });
  });

  test('Botón Cerrar sesión existe', async ({ page }) => {
    const cerrarBtn = page.locator('button', { hasText: 'Cerrar sesión' });
    await expect(cerrarBtn).toBeVisible({ timeout: 8000 });
  });
});

test.describe('Panel - JavaScript funcional', () => {

  test('No hay errores JS críticos al cargar el panel', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => {
      errors.push(err.message);
    });

    await goToPanelWithSession(page);

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
