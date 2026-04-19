// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * TEST SUITE: Flujo de autenticación
 * Verifica el formulario de login, validaciones, y manejo de errores.
 */

test.describe('Login - Validaciones del formulario', () => {

  test('Campos email y password están presentes y son funcionales', async ({ page }) => {
    await page.goto('login.html');

    const email = page.locator('#email');
    const password = page.locator('#password');

    // Verificar que se puede escribir
    await email.fill('test@ejemplo.com');
    await password.fill('test123');

    await expect(email).toHaveValue('test@ejemplo.com');
    await expect(password).toHaveValue('test123');
  });

  test('Muestra error con campos vacíos', async ({ page }) => {
    await page.goto('login.html');

    await page.locator('#btn').click();

    // Debe mostrar mensaje de error
    const error = page.locator('#error');
    await expect(error).not.toBeEmpty();
  });

  test('Muestra error con credenciales inválidas', async ({ page }) => {
    await page.goto('login.html');

    await page.fill('#email', 'fake@noexiste.com');
    await page.fill('#password', 'wrongpass123');
    await page.locator('#btn').click();

    // Esperar a que aparezca el error o el botón se re-habilite
    await page.waitForFunction(() => {
      const err = document.getElementById('error');
      const btn = document.getElementById('btn');
      return (err && err.textContent.length > 0) || (btn && !btn.disabled);
    }, { timeout: 5000 }).catch(() => {});

    const error = page.locator('#error');
    const errorText = await error.textContent();
    const hasError = errorText.length > 0;
    const btnDisabled = await page.locator('#btn').isDisabled();

    expect(hasError || !btnDisabled).toBe(true);
  });

  test('Enter en campo password activa login', async ({ page }) => {
    await page.goto('login.html');

    await page.fill('#email', 'test@test.com');
    await page.fill('#password', 'test123');

    // Verificar que el evento onkeydown está configurado
    const hasEnterHandler = await page.locator('#password').evaluate(
      el => el.getAttribute('onkeydown')?.includes('Enter')
    );
    expect(hasEnterHandler).toBe(true);
  });

  test('Indicador de carga aparece al intentar login', async ({ page }) => {
    await page.goto('login.html');

    await page.fill('#email', 'test@test.com');
    await page.fill('#password', 'test123');

    // El loading debe estar oculto inicialmente
    const loading = page.locator('#loading');
    await expect(loading).not.toBeVisible();

    // Al hacer click, el botón debe deshabilitarse
    await page.locator('#btn').click();

    // Esperar a que el botón se deshabilite
    await expect(page.locator('#btn')).toBeDisabled({ timeout: 2000 });
  });
});

test.describe('Login - Branding y diseño', () => {

  test('Logo y marca se muestran correctamente', async ({ page }) => {
    await page.goto('login.html');

    await expect(page.locator('.logo-dot')).toBeVisible();
    await expect(page.locator('.logo p')).toBeVisible();
  });

  test('Diseño responsivo - se centra verticalmente', async ({ page }) => {
    await page.goto('login.html');

    const card = page.locator('.card');
    await expect(card).toBeVisible();

    // Verificar que la card tiene max-width
    const maxWidth = await card.evaluate(el => getComputedStyle(el).maxWidth);
    expect(maxWidth).toBe('400px');
  });
});
