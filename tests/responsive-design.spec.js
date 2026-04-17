// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * TEST SUITE: Diseño responsivo
 * Verifica que la plataforma se ve correctamente en diferentes tamaños.
 * Usa page.setViewportSize para evitar crear contextos extra (más rápido).
 */

test.describe('Responsive - Formulario (formulario.html)', () => {

  test('Formulario se adapta en móvil (375px)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('formulario.html?access=mj2026');

    const card = page.locator('.card');
    await expect(card).toBeVisible();

    const cardBox = await card.boundingBox();
    expect(cardBox.width).toBeLessThanOrEqual(375);
  });

  test('Formulario se adapta en desktop (1440px)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('formulario.html?access=mj2026');

    const wrap = page.locator('.wrap');
    await expect(wrap).toBeVisible();

    const wrapBox = await wrap.boundingBox();
    expect(wrapBox.width).toBeLessThanOrEqual(700);
  });
});

test.describe('Responsive - Login', () => {

  test('Login se centra en móvil', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('login.html');

    const card = page.locator('.card');
    await expect(card).toBeVisible();
    await expect(page.locator('.logo-mark')).toBeVisible();
  });
});

test.describe('Responsive - Panel', () => {

  test('Panel tiene layout con sidebar en desktop', async ({ page }) => {
    // Inyectar sesión para que panel.html no redirija al login
    await page.goto('login.html');
    await page.evaluate(() => {
      localStorage.setItem('mj_user', JSON.stringify({
        id: 999, email: 'test-agent@test.invalid', rol: 'coach', nombre: 'Test Agent'
      }));
    });
    await page.goto('panel.html');

    const layout = page.locator('.layout');
    await expect(layout).toBeVisible({ timeout: 8000 });
    await expect(page.locator('.sidebar')).toBeVisible();
  });
});
