// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * TEST SUITE: Carga de páginas
 * Verifica que todas las páginas de la plataforma cargan correctamente,
 * sin errores 404/500 y con los elementos esenciales visibles.
 */

test.describe('Carga de páginas principales', () => {

  test('index.html - Formulario de análisis carga correctamente', async ({ page }) => {
    const response = await page.goto('index.html');
    expect(response.status()).toBe(200);

    // Verifica título
    await expect(page).toHaveTitle(/Análisis de perfil profesional/);

    // Verifica elementos clave del formulario
    await expect(page.locator('.card')).toBeVisible();
    await expect(page.locator('#top-h')).toBeVisible();
    await expect(page.locator('.prog-bar')).toBeVisible();

    // Verifica botones de idioma
    await expect(page.locator('.lb').first()).toBeVisible();
    await expect(page.locator('.lb').nth(1)).toBeVisible();

    // Verifica que el paso 0 (consentimiento) es visible
    await expect(page.locator('#s0')).toBeVisible();
    await expect(page.locator('#consent-cb')).toBeVisible();
  });

  test('login.html - Página de login carga correctamente', async ({ page }) => {
    const response = await page.goto('login.html');
    expect(response.status()).toBe(200);

    // Verifica elementos del login
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('#btn')).toBeVisible();
    await expect(page.locator('.logo')).toBeVisible();
  });

  test('panel.html - Panel del coach carga correctamente', async ({ page }) => {
    // panel.html redirige al login sin sesión, así que inyectamos una
    await page.goto('login.html');
    await page.evaluate(() => {
      localStorage.setItem('mj_user', JSON.stringify({
        id: 999, email: 'test-agent@test.invalid', rol: 'coach', nombre: 'Test Agent'
      }));
    });
    const response = await page.goto('panel.html');
    expect(response.status()).toBe(200);

    // Verifica estructura del layout con sesión
    await expect(page.locator('.layout')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('.sidebar')).toBeVisible();
    await expect(page.locator('#nb-inicio')).toBeVisible();
  });

  test('cliente.html - Portal del cliente carga correctamente', async ({ page }) => {
    const response = await page.goto('cliente.html');
    expect(response.status()).toBe(200);
  });

  test('cv.html - Editor de CV carga correctamente', async ({ page }) => {
    const response = await page.goto('cv.html');
    expect(response.status()).toBe(200);
  });

  test('carta.html - Generador de cartas carga correctamente', async ({ page }) => {
    const response = await page.goto('carta.html');
    expect(response.status()).toBe(200);
  });

  test('links.html - Gestor de links carga correctamente', async ({ page }) => {
    const response = await page.goto('links.html');
    expect(response.status()).toBe(200);
  });

  test('hub.html - Hub de conexiones carga correctamente', async ({ page }) => {
    const response = await page.goto('hub.html');
    expect(response.status()).toBe(200);
  });
});

test.describe('Verificación de recursos y assets', () => {

  test('No hay errores de consola críticos en index.html', async ({ page }) => {
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('index.html');
    await page.waitForLoadState('domcontentloaded');

    // Filtra errores esperados (ej: CORS de fuentes externas)
    const criticalErrors = errors.filter(e =>
      !e.includes('favicon') &&
      !e.includes('net::ERR') &&
      !e.includes('CORS') &&
      !e.includes('404') &&
      !e.includes('Failed to load resource')
    );

    expect(criticalErrors).toEqual([]);
  });

  test('No hay errores de consola críticos en login.html', async ({ page }) => {
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('login.html');
    await page.waitForLoadState('domcontentloaded');

    const criticalErrors = errors.filter(e =>
      !e.includes('favicon') &&
      !e.includes('net::ERR') &&
      !e.includes('CORS') &&
      !e.includes('404') &&
      !e.includes('Failed to load resource')
    );

    expect(criticalErrors).toEqual([]);
  });

  test('Google Fonts carga correctamente', async ({ page }) => {
    await page.goto('index.html');
    await page.waitForLoadState('networkidle');

    // Verificar que la fuente Montserrat se aplicó
    const fontFamily = await page.locator('body').evaluate(el => getComputedStyle(el).fontFamily);
    expect(fontFamily.toLowerCase()).toContain('montserrat');
  });

  test('EmailJS SDK carga correctamente en index.html', async ({ page }) => {
    await page.goto('index.html');
    await page.waitForLoadState('networkidle');
    const emailjsLoaded = await page.evaluate(() => typeof window.emailjs !== 'undefined');
    expect(emailjsLoaded).toBe(true);
  });
});
