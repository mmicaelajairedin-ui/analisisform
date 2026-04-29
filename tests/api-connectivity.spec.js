// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * TEST SUITE: Conectividad con APIs externas
 * Verifica que Supabase y el endpoint de AI responden correctamente.
 */

const SB_URL = 'https://ddxnrsnjdvtqhxunxnwj.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkeG5yc25qZHZ0cWh4dW54bndqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNDk5MzksImV4cCI6MjA5MDcyNTkzOX0.t82X1x-PDgFDGYhKC7YXoRKhga9I8Hjet60QUYvtZLU';

test.describe('Supabase - Conectividad', () => {

  test('Supabase REST API responde (tabla candidatos)', async ({ request }) => {
    const response = await request.get(`${SB_URL}/rest/v1/candidatos?select=id&limit=1`, {
      headers: {
        'apikey': SB_KEY,
        'Authorization': `Bearer ${SB_KEY}`,
      }
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test('Supabase REST API responde (tabla informes)', async ({ request }) => {
    const response = await request.get(`${SB_URL}/rest/v1/informes?select=id&limit=1`, {
      headers: {
        'apikey': SB_KEY,
        'Authorization': `Bearer ${SB_KEY}`,
      }
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test('Supabase REST API responde (tabla usuarios)', async ({ request }) => {
    const response = await request.get(`${SB_URL}/rest/v1/usuarios?select=id&limit=1`, {
      headers: {
        'apikey': SB_KEY,
        'Authorization': `Bearer ${SB_KEY}`,
      }
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test('Supabase REST API responde (tabla cv_publicados)', async ({ request }) => {
    const response = await request.get(`${SB_URL}/rest/v1/cv_publicados?select=id&limit=1`, {
      headers: {
        'apikey': SB_KEY,
        'Authorization': `Bearer ${SB_KEY}`,
      }
    });

    // Puede ser 200 o 404 si la tabla no existe aún
    expect([200, 404]).toContain(response.status());
  });
});

test.describe('Supabase - Integridad de datos', () => {

  test('Tabla candidatos tiene estructura esperada', async ({ request }) => {
    const response = await request.get(`${SB_URL}/rest/v1/candidatos?select=*&limit=1`, {
      headers: {
        'apikey': SB_KEY,
        'Authorization': `Bearer ${SB_KEY}`,
      }
    });

    expect(response.status()).toBe(200);
    const data = await response.json();

    if (data.length > 0) {
      const candidato = data[0];
      // Verificar que campos esperados existen
      const expectedFields = ['id'];
      for (const field of expectedFields) {
        expect(candidato).toHaveProperty(field);
      }
    }
  });

  test('Conteo de candidatos es razonable', async ({ request }) => {
    const response = await request.get(`${SB_URL}/rest/v1/candidatos?select=id`, {
      headers: {
        'apikey': SB_KEY,
        'Authorization': `Bearer ${SB_KEY}`,
        'Prefer': 'count=exact',
      }
    });

    expect(response.status()).toBe(200);
    // El header content-range indica el conteo
    const contentRange = response.headers()['content-range'];
    if (contentRange) {
      const total = parseInt(contentRange.split('/')[1]);
      // Reportar el número, no debería ser negativo
      expect(total).toBeGreaterThanOrEqual(0);
      console.log(`Total candidatos en base de datos: ${total}`);
    }
  });
});

test.describe('Sitio desplegado - Health Check', () => {

  test('Sitio principal responde en < 5 segundos', async ({ request }) => {
    const BASE = process.env.BASE_URL || 'https://pathwaycareercoach.com';
    const start = Date.now();

    const response = await request.get(`${BASE}/index.html`);
    const duration = Date.now() - start;

    expect(response.status()).toBe(200);
    expect(duration).toBeLessThan(5000);
    console.log(`Tiempo de respuesta del sitio: ${duration}ms`);
  });

  test('Login page responde en < 5 segundos', async ({ request }) => {
    const BASE = process.env.BASE_URL || 'https://pathwaycareercoach.com';
    const start = Date.now();

    const response = await request.get(`${BASE}/login.html`);
    const duration = Date.now() - start;

    expect(response.status()).toBe(200);
    expect(duration).toBeLessThan(5000);
    console.log(`Tiempo de respuesta login: ${duration}ms`);
  });
});
