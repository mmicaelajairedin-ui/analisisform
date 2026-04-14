// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * TEST SUITE: Diseño responsivo
 * Verifica que la plataforma se ve correctamente en diferentes tamaños de pantalla.
 */

test.describe('Responsive - Formulario (index.html)', () => {

  test('Formulario se adapta en móvil (375px)', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 375, height: 812 },
    });
    const page = await context.newPage();
    await page.goto('/index.html');

    // Card visible y ajustada
    const card = page.locator('.card');
    await expect(card).toBeVisible();

    const cardBox = await card.boundingBox();
    expect(cardBox.width).toBeLessThanOrEqual(375);

    // Botones de idioma visibles
    await expect(page.locator('.lb').first()).toBeVisible();

    await context.close();
  });

  test('Formulario se adapta en tablet (768px)', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 768, height: 1024 },
    });
    const page = await context.newPage();
    await page.goto('/index.html');

    const card = page.locator('.card');
    await expect(card).toBeVisible();

    // Grid de 2 columnas debe funcionar en tablet
    await page.locator('#consent-cb').check();
    await page.locator('#consent-btn').click();

    const cols2 = page.locator('.cols2').first();
    await expect(cols2).toBeVisible();

    await context.close();
  });

  test('Formulario se adapta en desktop (1440px)', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    const page = await context.newPage();
    await page.goto('/index.html');

    const card = page.locator('.card');
    await expect(card).toBeVisible();

    // Max-width del wrap limita el ancho
    const wrap = page.locator('.wrap');
    const wrapBox = await wrap.boundingBox();
    expect(wrapBox.width).toBeLessThanOrEqual(700);

    await context.close();
  });
});

test.describe('Responsive - Login', () => {

  test('Login se centra en móvil', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 375, height: 812 },
    });
    const page = await context.newPage();
    await page.goto('/login.html');

    const card = page.locator('.card');
    await expect(card).toBeVisible();

    const cardBox = await card.boundingBox();
    expect(cardBox.width).toBeLessThanOrEqual(375);

    // Logo visible
    await expect(page.locator('.logo-dot')).toBeVisible();

    await context.close();
  });
});

test.describe('Responsive - Panel', () => {

  test('Panel tiene layout grid en desktop', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
    });
    const page = await context.newPage();
    await page.goto('/panel.html');

    const layout = page.locator('.layout');
    await expect(layout).toBeVisible();

    const display = await layout.evaluate(el => getComputedStyle(el).display);
    expect(display).toBe('grid');

    await context.close();
  });
});
