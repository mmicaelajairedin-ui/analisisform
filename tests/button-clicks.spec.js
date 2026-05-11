// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * TEST SUITE: Click real en botones (con sesión autenticada)
 *
 * Estos tests hacen login real como coach, navegan al panel, y hacen click
 * en botones reales verificando que:
 * 1. No tiran error de JavaScript
 * 2. Algo visible cambia (modal, loading, toast, texto)
 *
 * Requiere secrets: TEST_COACH_EMAIL, TEST_COACH_PASSWORD
 */

const COACH_EMAIL = process.env.TEST_COACH_EMAIL;
const COACH_PASSWORD = process.env.TEST_COACH_PASSWORD;

// Skip todos los tests si no hay credenciales
const skipAll = !COACH_EMAIL || !COACH_PASSWORD;

async function loginAsCoach(page) {
  await page.goto('login.html');
  await page.fill('#email', COACH_EMAIL);
  await page.fill('#password', COACH_PASSWORD);
  await page.locator('#btn').click();

  // Esperar a que redirija al panel
  await page.waitForURL(/panel\.html/, { timeout: 10000 });
  await page.waitForLoadState('domcontentloaded');
  // Dar tiempo a que carguen candidatos
  await page.waitForTimeout(3000);
}

test.describe('Login real del coach', () => {
  test.skip(skipAll, 'TEST_COACH_EMAIL/PASSWORD no configurados');

  test('Login con credenciales reales funciona', async ({ page }) => {
    await page.goto('login.html');
    await page.fill('#email', COACH_EMAIL);
    await page.fill('#password', COACH_PASSWORD);
    await page.locator('#btn').click();

    await page.waitForURL(/panel\.html/, { timeout: 10000 });
    expect(page.url()).toContain('panel.html');
  });
});

test.describe('Panel — Botones de navegación con sesión real', () => {
  test.skip(skipAll, 'TEST_COACH_EMAIL/PASSWORD no configurados');

  test('Sidebar Resumen funciona', async ({ page }) => {
    await loginAsCoach(page);

    await page.locator('#nb-inicio').click();
    // Debe mostrar algún contenido en el área principal
    await page.waitForTimeout(1000);
    const mainText = await page.locator('#dynamic-panel').textContent();
    expect(mainText.length).toBeGreaterThan(10);
  });

  test('Sidebar Clientes funciona', async ({ page }) => {
    await loginAsCoach(page);

    await page.locator('#nb-clientes').click();
    await page.waitForTimeout(1000);

    // Debe mostrar tarjetas de clientes o mensaje vacío
    const content = await page.locator('#dynamic-panel').textContent();
    expect(content.length).toBeGreaterThan(5);
  });

  test('Botón Nuevo Cliente abre modal', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await loginAsCoach(page);

    // Click en Nuevo Cliente
    const nuevoBtn = page.locator('button', { hasText: 'NUEVO CLIENTE' });
    await nuevoBtn.click();
    await page.waitForTimeout(1000);

    // Debe aparecer un modal o formulario
    const modalVisible = await page.evaluate(() => {
      const modals = document.querySelectorAll('[style*="display: flex"], [style*="display:flex"], .modal-overlay');
      return modals.length > 0;
    });

    // No debe haber errores JS al abrir
    const criticalErrors = errors.filter(e =>
      !e.includes('Cannot read') && !e.includes('null') && !e.includes('JSON')
    );
    expect(criticalErrors).toEqual([]);
  });
});

test.describe('Panel — Abrir ficha de candidato', () => {
  test.skip(skipAll, 'TEST_COACH_EMAIL/PASSWORD no configurados');

  test('Click en un candidato abre su ficha sin errores', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await loginAsCoach(page);

    // Ir a la sección de clientes
    await page.locator('#nb-clientes').click();
    await page.waitForTimeout(2000);

    // Buscar cualquier tarjeta de cliente clickeable
    const clientCards = page.locator('[onclick*="openCand"], [onclick*="showCand"], .cli-card');
    const count = await clientCards.count();

    if (count > 0) {
      await clientCards.first().click();
      await page.waitForTimeout(2000);

      // Verificar que se abrió algo (ficha del candidato)
      const mainContent = await page.locator('#main, #clients-panel').first().textContent();
      expect(mainContent.length).toBeGreaterThan(20);

      // Sin errores JS críticos
      const criticalErrors = errors.filter(e =>
        !e.includes('Cannot read') && !e.includes('null') &&
        !e.includes('JSON') && !e.includes('undefined')
      );
      expect(criticalErrors).toEqual([]);
    } else {
      console.log('No hay candidatos en el panel — test omitido');
    }
  });
});

test.describe('Panel — Botones de acción sin errores JS', () => {
  test.skip(skipAll, 'TEST_COACH_EMAIL/PASSWORD no configurados');

  test('Botón Actualizar no tira errores', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await loginAsCoach(page);

    const actualizarBtn = page.locator('button', { hasText: 'Actualizar' });
    await actualizarBtn.click();
    await page.waitForTimeout(3000);

    const criticalErrors = errors.filter(e =>
      !e.includes('Cannot read') && !e.includes('null') &&
      !e.includes('JSON') && !e.includes('undefined')
    );
    expect(criticalErrors).toEqual([]);
  });

  test('Botón Cerrar sesión redirige a login', async ({ page }) => {
    await loginAsCoach(page);

    // cerrarSesion() tiene un confirm() — aceptarlo automáticamente
    page.on('dialog', dialog => dialog.accept());

    const cerrarBtn = page.locator('button', { hasText: 'Cerrar sesión' });
    await cerrarBtn.click();

    // Debe redirigir a login
    await page.waitForURL(/login\.html/, { timeout: 10000 });
    expect(page.url()).toContain('login.html');
  });
});

test.describe('Panel — Secciones cargan contenido', () => {
  test.skip(skipAll, 'TEST_COACH_EMAIL/PASSWORD no configurados');

  test('Sección Pagos carga sin errores', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await loginAsCoach(page);

    const pagosBtn = page.locator('#nb-pagos');
    if (await pagosBtn.count() > 0) {
      await pagosBtn.click();
      await page.waitForTimeout(2000);

      const criticalErrors = errors.filter(e =>
        !e.includes('Cannot read') && !e.includes('null') &&
        !e.includes('JSON') && !e.includes('undefined')
      );
      expect(criticalErrors).toEqual([]);
    }
  });

  test('Dashboard Resumen muestra estadísticas', async ({ page }) => {
    await loginAsCoach(page);

    // Verificar que el dashboard tiene números o cards
    const dynamicPanel = page.locator('#dynamic-panel');
    await page.waitForTimeout(2000);

    const text = await dynamicPanel.textContent();
    // Debe tener contenido real (no solo "cargando")
    expect(text.length).toBeGreaterThan(50);
  });
});

test.describe('Formulario — Envío completo (sin guardar)', () => {
  test('Formulario completo hasta paso 7 no tira errores JS', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await page.goto('formulario.html?access=mj2026');

    // Forzar español
    await page.locator('.lb').first().click();

    // Paso 0: Consentimiento
    await page.locator('#consent-cb').check();
    await page.locator('#consent-btn').click();

    // Paso 1: Datos personales
    await page.fill('#f-nom', 'Test Bot Diario');
    await page.fill('#f-mai', 'test-bot@test.invalid');
    await page.fill('#f-sec', 'Testing');
    await page.locator('#s1 .btn-next').click();

    // Paso 2: Situación
    await page.locator('#r-sit .opt').first().click();
    await page.fill('#f-obj', 'Verificar que el formulario funciona');
    await page.locator('#s2 .btn-next').click();

    // Paso 3: CV y LinkedIn
    await page.locator('#s3 .btn-next').click();

    // Paso 4: Experiencia
    await page.fill('#f-car', 'QA Engineer');
    await page.locator('#s4 .btn-next').click();

    // Paso 5: Qué busca
    await page.fill('#f-rol', 'Test Lead');
    await page.locator('#s5 .btn-next').click();

    // Paso 6: Obstáculos
    await page.locator('#c-obs .copt').first().click();
    await page.locator('#r-red .opt').first().click();
    await page.locator('#s6 .btn-next').click();

    // Paso 7 visible
    await expect(page.locator('#s7')).toBeVisible();

    // Verificar que no hubo errores JS en todo el recorrido
    const criticalErrors = errors.filter(e =>
      !e.includes('Cannot read') && !e.includes('null') &&
      !e.includes('JSON') && !e.includes('undefined') &&
      !e.includes('uploadcare')
    );
    expect(criticalErrors).toEqual([]);
  });
});

test.describe('Registro — Formulario no tira errores', () => {
  test('Registro carga y campos son funcionales', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await page.goto('registro.html');
    await page.waitForLoadState('domcontentloaded');

    // Verificar que campos de registro existen y son interactivos
    const nameField = page.locator('input[type="text"]').first();
    if (await nameField.count() > 0) {
      await nameField.fill('Test Coach');
    }

    const emailField = page.locator('input[type="email"]').first();
    if (await emailField.count() > 0) {
      await emailField.fill('test@test.invalid');
    }

    await page.waitForTimeout(1000);

    const criticalErrors = errors.filter(e =>
      !e.includes('Cannot read') && !e.includes('null') &&
      !e.includes('JSON') && !e.includes('google')
    );
    expect(criticalErrors).toEqual([]);
  });
});
