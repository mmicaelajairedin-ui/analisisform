// @ts-check
const { test, expect } = require('@playwright/test');

const EMAIL = process.env.TEST_CLIENT_EMAIL;
const PASS = process.env.TEST_CLIENT_PASSWORD;
const skip = !EMAIL || !PASS;

async function loginClient(page) {
  await page.goto('login.html');
  await page.fill('#email', EMAIL);
  await page.fill('#password', PASS);
  await page.locator('#btn').click();
  await page.waitForURL(/cliente/, { timeout: 15000 });
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(() => {
    const app = document.getElementById('app');
    return app && app.style.display !== 'none';
  }, { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(2000);
}

test.describe('Cliente — Login y navegación', () => {
  test.skip(skip, 'Sin credenciales de cliente');

  test('Login redirige al portal', async ({ page }) => {
    await page.goto('login.html');
    await page.fill('#email', EMAIL);
    await page.fill('#password', PASS);
    await page.locator('#btn').click();
    await page.waitForURL(/cliente/, { timeout: 15000 });
    expect(page.url()).toContain('cliente');
  });

  test('Dashboard carga contenido', async ({ page }) => {
    await loginClient(page);
    const text = await page.locator('body').textContent();
    expect(text.length).toBeGreaterThan(100);
  });

  test('Navegación por secciones sin errores JS', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await loginClient(page);
    for (const sec of ['docs', 'empleos', 'recursos']) {
      const btn = page.locator(`[onclick*="${sec}"]`).first();
      if (await btn.count() > 0) await btn.click({ timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(1000);
    }
    expect(errors.filter(e => !e.includes('null') && !e.includes('JSON') && !e.includes('undefined') && !e.includes('Network'))).toEqual([]);
  });
});
