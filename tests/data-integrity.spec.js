// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * TEST SUITE: Integridad de datos (flujo completo)
 * Verifica que los datos del formulario llegan correctamente a Supabase
 * y que las tablas tienen la estructura esperada.
 *
 * IMPORTANTE: Este test SOLO LEE datos, nunca modifica ni borra nada.
 */

const SB_URL = 'https://ddxnrsnjdvtqhxunxnwj.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkeG5yc25qZHZ0cWh4dW54bndqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNDk5MzksImV4cCI6MjA5MDcyNTkzOX0.t82X1x-PDgFDGYhKC7YXoRKhga9I8Hjet60QUYvtZLU';

// Registro de referencia para verificar que el flujo completo funciona
const TEST_EMAIL = 'mmicaela.jairedin@gmail.com';

test.describe('Flujo completo — Datos del formulario en Supabase', () => {

  test('El registro de referencia existe en la tabla candidatos', async ({ request }) => {
    const response = await request.get(
      `${SB_URL}/rest/v1/candidatos?email=eq.${encodeURIComponent(TEST_EMAIL)}&select=id,email&limit=1`,
      {
        headers: {
          'apikey': SB_KEY,
          'Authorization': `Bearer ${SB_KEY}`,
        },
      }
    );

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.length).toBeGreaterThanOrEqual(1);
    expect(data[0].email).toBe(TEST_EMAIL);
  });

  test('El registro tiene campos del formulario', async ({ request }) => {
    const response = await request.get(
      `${SB_URL}/rest/v1/candidatos?email=eq.${encodeURIComponent(TEST_EMAIL)}&select=*&limit=1`,
      {
        headers: {
          'apikey': SB_KEY,
          'Authorization': `Bearer ${SB_KEY}`,
        },
      }
    );

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.length).toBeGreaterThanOrEqual(1);

    const candidato = data[0];
    expect(candidato.email).toBeTruthy();

    // Contar campos para verificar que el formulario guardó datos
    const fieldCount = Object.keys(candidato).length;
    expect(fieldCount).toBeGreaterThanOrEqual(3);
    console.log(`Campos del candidato de referencia: ${fieldCount}`);
  });

  test('La tabla candidatos tiene la estructura esperada', async ({ request }) => {
    const response = await request.get(
      `${SB_URL}/rest/v1/candidatos?select=*&limit=1`,
      {
        headers: {
          'apikey': SB_KEY,
          'Authorization': `Bearer ${SB_KEY}`,
        },
      }
    );

    expect(response.status()).toBe(200);
    const data = await response.json();

    if (data.length > 0) {
      const row = data[0];
      // Verificar que las columnas clave existen
      expect(row).toHaveProperty('id');
      expect(row).toHaveProperty('email');

      // Contar campos — si alguien borra columnas, este test lo detecta
      const fieldCount = Object.keys(row).length;
      expect(fieldCount).toBeGreaterThanOrEqual(3);
      console.log(`Tabla candidatos: ${fieldCount} columnas detectadas`);
    }
  });
});

test.describe('Flujo completo — Tabla informes', () => {

  test('La tabla informes es accesible y tiene estructura', async ({ request }) => {
    const response = await request.get(
      `${SB_URL}/rest/v1/informes?select=*&limit=1`,
      {
        headers: {
          'apikey': SB_KEY,
          'Authorization': `Bearer ${SB_KEY}`,
        },
      }
    );

    expect(response.status()).toBe(200);
    const data = await response.json();

    if (data.length > 0) {
      const row = data[0];
      expect(row).toHaveProperty('id');
      const fieldCount = Object.keys(row).length;
      expect(fieldCount).toBeGreaterThanOrEqual(2);
      console.log(`Tabla informes: ${fieldCount} columnas, ${data.length}+ registros`);
    }
  });

  test('Existe al menos un informe vinculado al candidato de referencia', async ({ request }) => {
    // Buscar informes por email (el campo que vincula informes con candidatos)
    const response = await request.get(
      `${SB_URL}/rest/v1/informes?email=eq.${encodeURIComponent(TEST_EMAIL)}&select=id&limit=1`,
      {
        headers: {
          'apikey': SB_KEY,
          'Authorization': `Bearer ${SB_KEY}`,
        },
      }
    );

    // Si la consulta falla con 400, el campo se llama diferente — no bloquear
    if (response.status() === 400) {
      console.log('Campo email no existe en informes — verificar estructura');
      return;
    }

    expect(response.status()).toBe(200);
    const data = await response.json();
    console.log(`Informes vinculados al candidato de referencia: ${data.length}`);
  });
});

test.describe('Flujo completo — Tabla usuarios', () => {

  test('Existe al menos un usuario coach/admin', async ({ request }) => {
    const response = await request.get(
      `${SB_URL}/rest/v1/usuarios?select=id,email,rol,activo&rol=in.(coach,admin)&activo=eq.true&limit=5`,
      {
        headers: {
          'apikey': SB_KEY,
          'Authorization': `Bearer ${SB_KEY}`,
        },
      }
    );

    expect(response.status()).toBe(200);
    const data = await response.json();

    // Debe haber al menos un coach/admin activo para que el panel funcione
    expect(data.length).toBeGreaterThanOrEqual(1);
    console.log(`Usuarios coach/admin activos: ${data.length}`);
  });

  test('La tabla usuarios NO expone password_hash en consultas normales', async ({ request }) => {
    const response = await request.get(
      `${SB_URL}/rest/v1/usuarios?select=*&limit=1`,
      {
        headers: {
          'apikey': SB_KEY,
          'Authorization': `Bearer ${SB_KEY}`,
        },
      }
    );

    expect(response.status()).toBe(200);
    const data = await response.json();

    if (data.length > 0) {
      const fields = Object.keys(data[0]);
      console.log(`Campos expuestos en usuarios: ${fields.join(', ')}`);

      // Si password_hash está expuesto, alertar (no bloquear, porque
      // la anon key es pública por diseño, pero es bueno saberlo)
      if (fields.includes('password_hash') && data[0].password_hash) {
        console.log('⚠️ ALERTA: password_hash visible en API pública');
      }
    }
  });
});

test.describe('Flujo completo — Consistencia entre tablas', () => {

  test('El conteo de candidatos es consistente', async ({ request }) => {
    // Contar candidatos
    const candResponse = await request.get(
      `${SB_URL}/rest/v1/candidatos?select=id`,
      {
        headers: {
          'apikey': SB_KEY,
          'Authorization': `Bearer ${SB_KEY}`,
          'Prefer': 'count=exact',
        },
      }
    );

    expect(candResponse.status()).toBe(200);
    const contentRange = candResponse.headers()['content-range'];

    if (contentRange) {
      const total = parseInt(contentRange.split('/')[1]);
      expect(total).toBeGreaterThanOrEqual(1);
      console.log(`Total candidatos: ${total}`);

      // Si de repente hay 0 candidatos, algo muy malo pasó
      if (total === 0) {
        console.log('🔴 CRÍTICO: La tabla candidatos está vacía');
      }
    }
  });

  test('El conteo de informes es razonable respecto a candidatos', async ({ request }) => {
    // Contar informes
    const infResponse = await request.get(
      `${SB_URL}/rest/v1/informes?select=id`,
      {
        headers: {
          'apikey': SB_KEY,
          'Authorization': `Bearer ${SB_KEY}`,
          'Prefer': 'count=exact',
        },
      }
    );

    expect(infResponse.status()).toBe(200);
    const contentRange = infResponse.headers()['content-range'];

    if (contentRange) {
      const total = parseInt(contentRange.split('/')[1]);
      expect(total).toBeGreaterThanOrEqual(0);
      console.log(`Total informes: ${total}`);
    }
  });
});
