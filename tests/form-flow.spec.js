// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * TEST SUITE: Flujo del formulario de análisis
 * Verifica la navegación multi-paso, validaciones, cambio de idioma,
 * y la interacción completa del formulario.
 */

test.describe('Formulario - Navegación entre pasos', () => {

  test('Consentimiento bloquea avance hasta aceptar', async ({ page }) => {
    await page.goto('formulario.html');

    // El botón debe estar deshabilitado
    const btn = page.locator('#consent-btn');
    await expect(btn).toBeDisabled();

    // Aceptar consentimiento
    await page.locator('#consent-cb').check();

    // Ahora debe estar habilitado
    await expect(btn).toBeEnabled();
  });

  test('Paso 0 → Paso 1 funciona correctamente', async ({ page }) => {
    await page.goto('formulario.html');

    // Aceptar y avanzar
    await page.locator('#consent-cb').check();
    await page.locator('#consent-btn').click();

    // Paso 1 debe ser visible
    await expect(page.locator('#s1')).toBeVisible();
    await expect(page.locator('#s0')).not.toBeVisible();

    // Campos del paso 1 visibles
    await expect(page.locator('#f-nom')).toBeVisible();
    await expect(page.locator('#f-mai')).toBeVisible();
    await expect(page.locator('#f-ciu')).toBeVisible();
    await expect(page.locator('#f-exp')).toBeVisible();
    await expect(page.locator('#f-sec')).toBeVisible();
  });

  test('Navegación completa pasos 1 → 6', async ({ page }) => {
    await page.goto('formulario.html');

    // Paso 0: Consentimiento
    await page.locator('#consent-cb').check();
    await page.locator('#consent-btn').click();
    await expect(page.locator('#s1')).toBeVisible();

    // Paso 1: Datos personales
    await page.fill('#f-nom', 'Test Usuario');
    await page.fill('#f-mai', 'test@ejemplo.com');
    await page.fill('#f-ciu', 'Madrid, España');
    await page.selectOption('#f-exp', { index: 2 });
    await page.fill('#f-sec', 'Tecnología');
    await page.locator('#s1btn').click();
    await expect(page.locator('#s2')).toBeVisible();

    // Paso 2: Situación actual
    await page.locator('#r-sit .opt').first().click();
    await page.fill('#f-obj', 'Quiero cambiar de trabajo');
    await page.locator('#s2 .btn-next').click();
    await expect(page.locator('#s3')).toBeVisible();

    // Paso 3: CV y LinkedIn
    await page.fill('#f-li', 'test-usuario');
    await page.locator('#r-li .opt').first().click();
    await page.locator('#s3 .btn-next').click();
    await expect(page.locator('#s4')).toBeVisible();

    // Paso 4: Experiencia
    await page.fill('#f-car', 'Senior Developer en TestCorp');
    await page.fill('#f-log', 'Lideré un equipo de 10 personas');
    await page.locator('#s4 .btn-next').click();
    await expect(page.locator('#s5')).toBeVisible();

    // Paso 5: Qué busca
    await page.fill('#f-rol', 'CTO');
    await page.selectOption('#f-emp', { index: 1 });
    await page.selectOption('#f-mod', { index: 2 });
    await page.fill('#f-sal', '80.000€ - 100.000€');
    await page.fill('#f-geo', 'Remoto global');
    await page.locator('#r-urg .opt').first().click();
    await page.locator('#s5 .btn-next').click();
    await expect(page.locator('#s6')).toBeVisible();

    // Paso 6: Obstáculos
    await page.locator('#c-obs .copt').first().click();
    await page.locator('#r-red .opt').first().click();
    await page.locator('#s6 .btn-next').click();
    await expect(page.locator('#s7')).toBeVisible();
  });

  test('Botón Atrás funciona en cada paso', async ({ page }) => {
    await page.goto('formulario.html');

    // Ir al paso 1
    await page.locator('#consent-cb').check();
    await page.locator('#consent-btn').click();
    await expect(page.locator('#s1')).toBeVisible();

    // Llenar campos obligatorios del paso 1
    await page.fill('#f-nom', 'Test');
    await page.fill('#f-mai', 'test@test.com');
    await page.fill('#f-sec', 'Tech');
    await page.locator('#s1btn').click();
    await expect(page.locator('#s2')).toBeVisible();

    // Volver al paso 1
    await page.locator('#s2 .btn-back').click();
    await expect(page.locator('#s1')).toBeVisible();
  });
});

test.describe('Formulario - Cambio de idioma', () => {

  test('Cambio ES → EN actualiza textos correctamente', async ({ page }) => {
    await page.goto('formulario.html');

    // Verificar español por defecto
    await expect(page.locator('#top-h')).toHaveText('Cuéntame sobre ti');

    // Cambiar a inglés
    await page.locator('.lb').nth(1).click();

    // Verificar textos en inglés
    await expect(page.locator('#top-h')).toHaveText('Tell me about yourself');
  });

  test('Cambio EN → ES restaura textos', async ({ page }) => {
    await page.goto('formulario.html');

    // Cambiar a inglés y luego volver
    await page.locator('.lb').nth(1).click();
    await expect(page.locator('#top-h')).toHaveText('Tell me about yourself');

    await page.locator('.lb').first().click();
    await expect(page.locator('#top-h')).toHaveText('Cuéntame sobre ti');
  });
});

test.describe('Formulario - Componentes interactivos', () => {

  test('Radio buttons (opciones únicas) funcionan correctamente', async ({ page }) => {
    await page.goto('formulario.html');
    await page.locator('#consent-cb').check();
    await page.locator('#consent-btn').click();

    // Llenar campos obligatorios del paso 1 para poder avanzar
    await page.fill('#f-nom', 'Test');
    await page.fill('#f-mai', 'test@test.com');
    await page.fill('#f-sec', 'Tech');
    await page.locator('#s1btn').click();
    await expect(page.locator('#s2')).toBeVisible();

    // Seleccionar primera opción de situación
    const opts = page.locator('#r-sit .opt');
    await opts.first().click();
    await expect(opts.first()).toHaveClass(/sel/);

    // Seleccionar segunda - primera debe deseleccionarse
    await opts.nth(1).click();
    await expect(opts.nth(1)).toHaveClass(/sel/);
    await expect(opts.first()).not.toHaveClass(/sel/);
  });

  test('Checkboxes (opciones múltiples) funcionan correctamente', async ({ page }) => {
    await page.goto('formulario.html');

    // Navegar hasta paso 6 llenando campos obligatorios
    await page.locator('#consent-cb').check();
    await page.locator('#consent-btn').click();

    await page.fill('#f-nom', 'Test');
    await page.fill('#f-mai', 'test@test.com');
    await page.fill('#f-sec', 'Tech');
    await page.locator('#s1 .btn-next').click();

    await page.locator('#r-sit .opt').first().click();
    await page.fill('#f-obj', 'Cambiar de trabajo');
    await page.locator('#s2 .btn-next').click();

    await page.locator('#s3 .btn-next').click();

    await page.fill('#f-car', 'Developer');
    await page.locator('#s4 .btn-next').click();

    await page.fill('#f-rol', 'CTO');
    await page.locator('#s5 .btn-next').click();

    await expect(page.locator('#s6')).toBeVisible();

    // Marcar múltiples checkboxes
    const copts = page.locator('#c-obs .copt');
    await copts.first().click();
    await copts.nth(1).click();

    await expect(copts.first()).toHaveClass(/sel/);
    await expect(copts.nth(1)).toHaveClass(/sel/);

    // Desmarcar uno
    await copts.first().click();
    await expect(copts.first()).not.toHaveClass(/sel/);
    await expect(copts.nth(1)).toHaveClass(/sel/);
  });

  test('Barra de progreso avanza con los pasos', async ({ page }) => {
    await page.goto('formulario.html');

    // Verificar progreso inicial en 0%
    const progFill = page.locator('#prog');
    const initialWidth = await progFill.evaluate(el => el.style.width);
    expect(initialWidth).toBe('0%');

    // Avanzar al paso 1
    await page.locator('#consent-cb').check();
    await page.locator('#consent-btn').click();

    // Progreso debe haber aumentado
    const newWidth = await progFill.evaluate(el => el.style.width);
    expect(newWidth).not.toBe('0%');
  });
});
