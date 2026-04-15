// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * TEST SUITE: Tests funcionales (modo lectura)
 *
 * Verifica que los botones tienen funciones conectadas y que las funciones
 * clave del JavaScript existen y están definidas.
 * NO ejecuta acciones que modifiquen datos.
 */

// Helper para inyectar sesión coach
async function goWithSession(page, url) {
  await page.goto('login.html');
  await page.evaluate(() => {
    localStorage.setItem('mj_user', JSON.stringify({
      id: 999, email: 'test-agent@test.invalid', rol: 'coach', nombre: 'Test Agent'
    }));
  });
  await page.goto(url);
  await page.waitForLoadState('domcontentloaded');
}

// ─── FORMULARIO (index.html) ─────────────────────────────────────

test.describe('Funcional — Formulario', () => {

  test('Función enviar() existe y está definida', async ({ page }) => {
    await page.goto('index.html');
    const exists = await page.evaluate(() => typeof enviar === 'function');
    expect(exists).toBe(true);
  });

  test('Función go() existe para navegar entre pasos', async ({ page }) => {
    await page.goto('index.html');
    const exists = await page.evaluate(() => typeof go === 'function');
    expect(exists).toBe(true);
  });

  test('Función validateStep() existe para validar campos', async ({ page }) => {
    await page.goto('index.html');
    const exists = await page.evaluate(() => typeof validateStep === 'function');
    expect(exists).toBe(true);
  });

  test('Función setLang() existe para cambio de idioma', async ({ page }) => {
    await page.goto('index.html');
    const exists = await page.evaluate(() => typeof setLang === 'function');
    expect(exists).toBe(true);
  });

  test('Constantes de Supabase están configuradas', async ({ page }) => {
    await page.goto('index.html');
    const config = await page.evaluate(() => ({
      hasSbUrl: typeof SB_URL === 'string' && SB_URL.includes('supabase'),
      hasSbKey: typeof SB_KEY === 'string' && SB_KEY.length > 20,
    }));
    expect(config.hasSbUrl).toBe(true);
    expect(config.hasSbKey).toBe(true);
  });

  test('EmailJS está inicializado', async ({ page }) => {
    await page.goto('index.html');
    await page.waitForLoadState('networkidle');
    const initialized = await page.evaluate(() => typeof emailjs !== 'undefined' && typeof emailjs.send === 'function');
    expect(initialized).toBe(true);
  });

  test('Botón enviar tiene onclick conectado', async ({ page }) => {
    await page.goto('index.html');
    const btnSend = page.locator('#btn-send');
    const onclick = await btnSend.getAttribute('onclick');
    expect(onclick).toContain('enviar');
  });
});

// ─── LOGIN (login.html) ──────────────────────────────────────────

test.describe('Funcional — Login', () => {

  test('Función entrar() existe', async ({ page }) => {
    await page.goto('login.html');
    const exists = await page.evaluate(() => typeof entrar === 'function');
    expect(exists).toBe(true);
  });

  test('Función hashPassword() existe', async ({ page }) => {
    await page.goto('login.html');
    const exists = await page.evaluate(() => typeof hashPassword === 'function');
    expect(exists).toBe(true);
  });

  test('Botón Entrar tiene onclick conectado a entrar()', async ({ page }) => {
    await page.goto('login.html');
    const onclick = await page.locator('#btn').getAttribute('onclick');
    expect(onclick).toContain('entrar');
  });

  test('Campo password tiene Enter handler', async ({ page }) => {
    await page.goto('login.html');
    const onkeydown = await page.locator('#password').getAttribute('onkeydown');
    expect(onkeydown).toContain('Enter');
    expect(onkeydown).toContain('entrar');
  });
});

// ─── PANEL (panel.html) ──────────────────────────────────────────

test.describe('Funcional — Panel del coach', () => {

  test('Función loadCands() existe para cargar candidatos', async ({ page }) => {
    await goWithSession(page, 'panel.html');
    const exists = await page.evaluate(() => typeof loadCands === 'function');
    expect(exists).toBe(true);
  });

  test('Función guardarInforme() existe', async ({ page }) => {
    await goWithSession(page, 'panel.html');
    const exists = await page.evaluate(() => typeof guardarInforme === 'function');
    expect(exists).toBe(true);
  });

  test('Función generarInformeAI() existe', async ({ page }) => {
    await goWithSession(page, 'panel.html');
    const exists = await page.evaluate(() => typeof generarInformeAI === 'function');
    expect(exists).toBe(true);
  });

  test('Función guardarCV() existe', async ({ page }) => {
    await goWithSession(page, 'panel.html');
    const exists = await page.evaluate(() => typeof guardarCV === 'function');
    expect(exists).toBe(true);
  });

  test('Función generarCVAI() existe', async ({ page }) => {
    await goWithSession(page, 'panel.html');
    const exists = await page.evaluate(() => typeof generarCVAI === 'function');
    expect(exists).toBe(true);
  });

  test('Función guardarCarta() existe', async ({ page }) => {
    await goWithSession(page, 'panel.html');
    const exists = await page.evaluate(() => typeof guardarCarta === 'function');
    expect(exists).toBe(true);
  });

  test('Función publicarCV() existe', async ({ page }) => {
    await goWithSession(page, 'panel.html');
    const exists = await page.evaluate(() => typeof publicarCV === 'function');
    expect(exists).toBe(true);
  });

  test('Función crearCliente() existe', async ({ page }) => {
    await goWithSession(page, 'panel.html');
    const exists = await page.evaluate(() => typeof crearCliente === 'function');
    expect(exists).toBe(true);
  });

  test('Función verPass() existe', async ({ page }) => {
    await goWithSession(page, 'panel.html');
    const exists = await page.evaluate(() => typeof verPass === 'function');
    expect(exists).toBe(true);
  });

  test('Función cambiarPass() existe', async ({ page }) => {
    await goWithSession(page, 'panel.html');
    const exists = await page.evaluate(() => typeof cambiarPass === 'function');
    expect(exists).toBe(true);
  });

  test('Función cerrarSesion() existe', async ({ page }) => {
    await goWithSession(page, 'panel.html');
    const exists = await page.evaluate(() => typeof cerrarSesion === 'function');
    expect(exists).toBe(true);
  });

  test('Función cambiarSemana() existe', async ({ page }) => {
    await goWithSession(page, 'panel.html');
    const exists = await page.evaluate(() => typeof cambiarSemana === 'function');
    expect(exists).toBe(true);
  });

  test('Función guardarPagoMonto() existe', async ({ page }) => {
    await goWithSession(page, 'panel.html');
    const exists = await page.evaluate(() => typeof guardarPagoMonto === 'function');
    expect(exists).toBe(true);
  });

  test('Botón Nuevo Cliente tiene onclick conectado', async ({ page }) => {
    await goWithSession(page, 'panel.html');
    const btn = page.locator('button', { hasText: 'NUEVO CLIENTE' });
    const onclick = await btn.getAttribute('onclick');
    expect(onclick).toContain('Crear');
  });

  test('Botón Actualizar tiene onclick conectado', async ({ page }) => {
    await goWithSession(page, 'panel.html');
    const btn = page.locator('button', { hasText: 'Actualizar' });
    const onclick = await btn.getAttribute('onclick');
    expect(onclick).toContain('loadCands');
  });

  test('Botón Cerrar sesión tiene onclick conectado', async ({ page }) => {
    await goWithSession(page, 'panel.html');
    const btn = page.locator('button', { hasText: 'Cerrar sesión' });
    const onclick = await btn.getAttribute('onclick');
    expect(onclick).toContain('cerrarSesion');
  });
});

// ─── CLIENTE (cliente.html) ──────────────────────────────────────

test.describe('Funcional — Portal del cliente', () => {

  test('Función entrar() existe para login del cliente', async ({ page }) => {
    await page.goto('cliente.html');
    const exists = await page.evaluate(() => typeof entrar === 'function');
    expect(exists).toBe(true);
  });

  test('Función render() existe para renderizar secciones', async ({ page }) => {
    await page.goto('cliente.html');
    const exists = await page.evaluate(() => typeof render === 'function');
    expect(exists).toBe(true);
  });

  test('Función goSec() existe para navegación', async ({ page }) => {
    await page.goto('cliente.html');
    const exists = await page.evaluate(() => typeof goSec === 'function');
    expect(exists).toBe(true);
  });

  test('Constantes de Supabase configuradas', async ({ page }) => {
    await page.goto('cliente.html');
    const config = await page.evaluate(() => ({
      hasSB: typeof SB === 'string' && SB.includes('supabase'),
      hasKEY: typeof KEY === 'string' && KEY.length > 20,
    }));
    expect(config.hasSB).toBe(true);
    expect(config.hasKEY).toBe(true);
  });
});
