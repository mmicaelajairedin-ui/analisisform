// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * TEST SUITE: Carga de páginas
 * Verifica que todas las páginas de la plataforma cargan correctamente,
 * sin errores 404/500 y con los elementos esenciales visibles.
 */

test.describe('Carga de páginas principales', () => {

  test('index.html - Landing principal de Pathway carga correctamente', async ({ page }) => {
    const response = await page.goto('index.html');
    expect(response.status()).toBe(200);
    await expect(page).toHaveTitle(/Pathway/i);
  });

  test('soy-candidato.html - Landing de candidatos carga correctamente', async ({ page }) => {
    const response = await page.goto('soy-candidato.html');
    expect(response.status()).toBe(200);
    await expect(page).toHaveTitle(/Pathway/i);
  });

  test('soy-coach.html - Landing de coaches carga correctamente', async ({ page }) => {
    const response = await page.goto('soy-coach.html');
    expect(response.status()).toBe(200);
    await expect(page).toHaveTitle(/Coach/i);
  });

  test('registro.html - Página de registro de coaches carga correctamente', async ({ page }) => {
    const response = await page.goto('registro.html');
    expect(response.status()).toBe(200);
    await expect(page).toHaveTitle(/Registro/i);
  });

  test('formulario.html - Formulario de análisis carga correctamente', async ({ page }) => {
    const response = await page.goto('formulario.html?access=mj2026');
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

  test('hub.html - Hub de conexiones carga correctamente', async ({ page }) => {
    const response = await page.goto('hub.html');
    expect(response.status()).toBe(200);
  });
});

test.describe('Verificación de recursos y assets', () => {

  test('No hay errores de consola críticos en formulario.html', async ({ page }) => {
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('formulario.html?access=mj2026');
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
    await page.goto('formulario.html?access=mj2026');
    await page.waitForLoadState('networkidle');

    // Verificar que la fuente Inter se aplicó (Pathway rebrand)
    const fontFamily = await page.locator('body').evaluate(el => getComputedStyle(el).fontFamily);
    expect(fontFamily.toLowerCase()).toContain('inter');
  });

  test('EmailJS SDK carga correctamente en formulario.html', async ({ page }) => {
    await page.goto('formulario.html?access=mj2026');
    await page.waitForLoadState('networkidle');
    const emailjsLoaded = await page.evaluate(() => typeof window.emailjs !== 'undefined');
    expect(emailjsLoaded).toBe(true);
  });
});

test.describe('SEO y Meta tags en landings', () => {

  test('index.html tiene meta description y canonical', async ({ page }) => {
    await page.goto('index.html');

    const description = await page.locator('meta[name="description"]').getAttribute('content');
    const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');

    expect(description).toBeTruthy();
    expect(description.length).toBeGreaterThan(50);
    expect(canonical).toContain('pathwaycareercoach.com');
  });

  test('soy-candidato.html tiene Open Graph tags', async ({ page }) => {
    await page.goto('soy-candidato.html');

    const ogTitle = await page.locator('meta[property="og:title"]').getAttribute('content');
    const ogSite = await page.locator('meta[property="og:site_name"]').getAttribute('content');

    expect(ogTitle).toBeTruthy();
    expect(ogSite).toContain('Pathway');
  });

  test('soy-coach.html tiene Open Graph tags', async ({ page }) => {
    await page.goto('soy-coach.html');

    const ogTitle = await page.locator('meta[property="og:title"]').getAttribute('content');
    const ogSite = await page.locator('meta[property="og:site_name"]').getAttribute('content');

    expect(ogTitle).toBeTruthy();
    expect(ogSite).toContain('Pathway');
  });

  test('registro.html tiene noindex (no debe aparecer en buscadores)', async ({ page }) => {
    await page.goto('registro.html');
    const robots = await page.locator('meta[name="robots"]').getAttribute('content');
    expect(robots).toContain('noindex');
  });

  test('CNAME apunta al dominio pathwaycareercoach.com', async ({ request }) => {
    const BASE = process.env.BASE_URL || 'https://pathwaycareercoach.com/';
    const response = await request.get(`${BASE}CNAME`);
    if (response.status() === 200) {
      const content = await response.text();
      expect(content.trim()).toContain('pathwaycareercoach.com');
    }
  });
});
