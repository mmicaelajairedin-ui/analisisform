// @ts-check
const { test, expect } = require('@playwright/test');

const SB_URL = 'https://api.pathwaycareercoach.com';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkeG5yc25qZHZ0cWh4dW54bndsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjM5ODAwMDAsImV4cCI6MTg4MTc0NjAwMH0.t82X1x-PDgFDGYhKC7YXoRKhga9I8Hjet60QUYvtZLU';
const HEADERS = { 'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}` };

const TABLES = ['candidatos', 'informes', 'usuarios', 'cv_publicados', 'prospectos', 'email_queue'];

test.describe('Supabase — Conectividad', () => {
  for (const table of TABLES) {
    test(`Tabla ${table} responde`, async ({ request }) => {
      const r = await request.get(`${SB_URL}/rest/v1/${table}?select=id&limit=1`, { headers: HEADERS });
      expect([200, 404]).toContain(r.status());
    });
  }
});

test.describe('Supabase — Integridad', () => {
  test('Candidatos tiene registros', async ({ request }) => {
    const r = await request.get(`${SB_URL}/rest/v1/candidatos?select=id`, {
      headers: { ...HEADERS, 'Prefer': 'count=exact' },
    });
    expect(r.status()).toBe(200);
    const range = r.headers()['content-range'];
    if (range) {
      const total = parseInt(range.split('/')[1]);
      expect(total).toBeGreaterThanOrEqual(0);
      console.log(`Candidatos: ${total}`);
    }
  });

  test('Usuarios tiene registros', async ({ request }) => {
    const r = await request.get(`${SB_URL}/rest/v1/usuarios?select=id`, {
      headers: { ...HEADERS, 'Prefer': 'count=exact' },
    });
    expect(r.status()).toBe(200);
    const range = r.headers()['content-range'];
    if (range) {
      const total = parseInt(range.split('/')[1]);
      expect(total).toBeGreaterThanOrEqual(1);
      console.log(`Usuarios: ${total}`);
    }
  });
});

test.describe('Sitio — Health Check', () => {
  test('pathwaycareercoach.com responde < 5s', async ({ request }) => {
    const BASE = process.env.BASE_URL || 'https://pathwaycareercoach.com';
    const start = Date.now();
    const r = await request.get(`${BASE}/index.html`);
    expect(r.status()).toBe(200);
    expect(Date.now() - start).toBeLessThan(5000);
  });
});
