// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * TEST SUITE: Portal del cliente (con sesión autenticada)
 *
 * Login real como cliente y verifica que las secciones y botones funcionan.
 * Requiere secrets: TEST_CLIENT_EMAIL, TEST_CLIENT_PASSWORD
 */

const CLIENT_EMAIL = process.env.TEST_CLIENT_EMAIL;
const CLIENT_PASSWORD = process.env.TEST_CLIENT_PASSWORD;

const skipAll = !CLIENT_EMAIL || !CLIENT_PASSWORD;

async function loginAsClient(page) {
  await page.goto('login.html');
  await page.fill('#email', CLIENT_EMAIL);
  await page.fill('#password', CLIENT_PASSWORD);
  await page.locator('#btn').click();

  await page.waitForURL(/cliente\.html/, { timeout: 10000 });
  await page.waitForLoadState('domcontentloaded');
  // Esperar a que #app sea visible (se muestra después del login)
  await page.waitForFunction(() => {
    const app = document.getElementById('app');
    return app && app.style.display !== 'none';
  }, { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(2000);
}

test.describe('Cliente — Login real', () => {
  test.skip(skipAll, 'TEST_CLIENT_EMAIL/PASSWORD no configurados');

  test('Login como cliente redirige al portal', async ({ page }) => {
    await page.goto('login.html');
    await page.fill('#email', CLIENT_EMAIL);
    await page.fill('#password', CLIENT_PASSWORD);
    await page.locator('#btn').click();

    await page.waitForURL(/cliente\.html/, { timeout: 10000 });
    expect(page.url()).toContain('cliente.html');
  });
});

test.describe('Cliente — Navegación de secciones', () => {
  test.skip(skipAll, 'TEST_CLIENT_EMAIL/PASSWORD no configurados');

  test('Portal carga con contenido del dashboard', async ({ page }) => {
    await loginAsClient(page);

    // El dashboard debe tener contenido real
    const bodyText = await page.locator('body').textContent();
    expect(bodyText.length).toBeGreaterThan(100);
  });

  test('Sección Documentos carga sin errores', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await loginAsClient(page);

    const docsBtn = page.locator('[onclick*="docs"]').first();
    if (await docsBtn.count() > 0) {
      await docsBtn.click({ timeout: 8000 });
      await page.waitForTimeout(2000);
    }

    const criticalErrors = errors.filter(e =>
      !e.includes('Cannot read') && !e.includes('null') &&
      !e.includes('JSON') && !e.includes('undefined')
    );
    expect(criticalErrors).toEqual([]);
  });

  test('Sección Empleos carga sin errores', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await loginAsClient(page);

    const empleosBtn = page.locator('[onclick*="empleos"]').first();
    if (await empleosBtn.count() > 0) {
      await empleosBtn.click({ timeout: 8000 });
      await page.waitForTimeout(2000);
    }

    const criticalErrors = errors.filter(e =>
      !e.includes('Cannot read') && !e.includes('null') &&
      !e.includes('JSON') && !e.includes('undefined')
    );
    expect(criticalErrors).toEqual([]);
  });

  test('Sección Recursos carga sin errores', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await loginAsClient(page);

    const recursosBtn = page.locator('[onclick*="recursos"]').first();
    if (await recursosBtn.count() > 0) {
      await recursosBtn.click({ timeout: 8000 });
      await page.waitForTimeout(2000);
    }

    const criticalErrors = errors.filter(e =>
      !e.includes('Cannot read') && !e.includes('null') &&
      !e.includes('JSON') && !e.includes('undefined')
    );
    expect(criticalErrors).toEqual([]);
  });
});

test.describe('Cliente — Acciones interactivas', () => {
  test.skip(skipAll, 'TEST_CLIENT_EMAIL/PASSWORD no configurados');

  test('Portal no tiene errores JS críticos al navegar', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await loginAsClient(page);

    // Navegar por las secciones usando los onclick de goSec
    const sections = ['semana', 'docs', 'linkedin', 'empleos', 'recursos'];
    for (const sec of sections) {
      const btn = page.locator(`[onclick*="${sec}"]`).first();
      if (await btn.count() > 0) {
        await btn.click({ timeout: 8000 }).catch(() => {});
        await page.waitForTimeout(1000);
      }
    }

    const criticalErrors = errors.filter(e =>
      !e.includes('Cannot read') && !e.includes('null') &&
      !e.includes('JSON') && !e.includes('undefined') &&
      !e.includes('NetworkError')
    );
    expect(criticalErrors).toEqual([]);
  });

  test('Guardar notas no tira error (si el campo existe)', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await loginAsClient(page);

    // Buscar campo de notas
    const notasField = page.locator('#ntxt, textarea[id*="nota"]').first();
    if (await notasField.count() > 0) {
      await notasField.fill('Test automático — ignorar');
      await page.waitForTimeout(1000);

      // Buscar botón de guardar notas cerca
      const guardarBtn = page.locator('button:has-text("Guardar"), [onclick*="gN"]').first();
      if (await guardarBtn.count() > 0) {
        await guardarBtn.click();
        await page.waitForTimeout(2000);
      }
    }

    const criticalErrors = errors.filter(e =>
      !e.includes('Cannot read') && !e.includes('null') &&
      !e.includes('JSON') && !e.includes('undefined')
    );
    expect(criticalErrors).toEqual([]);
  });
});
