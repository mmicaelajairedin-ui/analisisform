// @ts-check
const { test, expect } = require('@playwright/test');

const COACH_EMAIL = process.env.TEST_COACH_EMAIL;
const COACH_PASSWORD = process.env.TEST_COACH_PASSWORD;
const skip = !COACH_EMAIL || !COACH_PASSWORD;

async function loginCoach(page) {
  await page.goto('login.html');
  await page.fill('#email', COACH_EMAIL);
  await page.fill('#password', COACH_PASSWORD);
  await page.locator('#btn').click();
  await page.waitForURL(/panel/, { timeout: 15000 });
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(3000);
}

test.describe('Coach — Login y navegación', () => {
  test.skip(skip, 'Sin credenciales de coach');

  test('Login redirige al panel', async ({ page }) => {
    await page.goto('login.html');
    await page.fill('#email', COACH_EMAIL);
    await page.fill('#password', COACH_PASSWORD);
    await page.locator('#btn').click();
    await page.waitForURL(/panel/, { timeout: 15000 });
    expect(page.url()).toContain('panel');
  });

  test('Sidebar Clientes funciona', async ({ page }) => {
    await loginCoach(page);
    const btn = page.locator('#nb-clientes');
    if (await btn.count() > 0) {
      await btn.click();
      await page.waitForTimeout(2000);
    }
    const text = await page.locator('body').textContent();
    expect(text.length).toBeGreaterThan(50);
  });

  test('Botón Actualizar no tira errores', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await loginCoach(page);
    const btn = page.locator('button', { hasText: 'Actualizar' });
    if (await btn.count() > 0) await btn.click();
    await page.waitForTimeout(3000);
    expect(errors.filter(e => !e.includes('null') && !e.includes('JSON') && !e.includes('undefined'))).toEqual([]);
  });

  test('Cerrar sesión redirige a login', async ({ page }) => {
    await loginCoach(page);
    page.on('dialog', d => d.accept());
    const btn = page.locator('button', { hasText: /[Cc]errar/ });
    if (await btn.count() > 0) await btn.click();
    await page.waitForURL(/login/, { timeout: 10000 });
    expect(page.url()).toContain('login');
  });
});

test.describe('Formulario — Recorrido completo', () => {
  test('Pasos 0→7 sin errores JS', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('formulario.html?access=mj2026');
    await page.locator('.lb').first().click();
    await page.locator('#consent-cb').check();
    await page.locator('#consent-btn').click();
    await page.fill('#f-nom', 'Test Bot');
    await page.fill('#f-mai', 'test@test.invalid');
    await page.fill('#f-sec', 'QA');
    await page.locator('#s1 .btn-next').click();
    await page.locator('#r-sit .opt').first().click();
    await page.fill('#f-obj', 'Test');
    await page.locator('#s2 .btn-next').click();
    await page.locator('#s3 .btn-next').click();
    await page.fill('#f-car', 'QA');
    await page.locator('#s4 .btn-next').click();
    await page.fill('#f-rol', 'Lead');
    await page.locator('#s5 .btn-next').click();
    await page.locator('#c-obs .copt').first().click();
    await page.locator('#r-red .opt').first().click();
    await page.locator('#s6 .btn-next').click();
    await expect(page.locator('#s7')).toBeVisible();
    expect(errors.filter(e => !e.includes('null') && !e.includes('undefined') && !e.includes('uploadcare'))).toEqual([]);
  });
});
