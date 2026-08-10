// @ts-check
const { test, expect } = require('@playwright/test');

const SB_URL = 'https://api.pathwaycareercoach.com';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkeG5yc25qZHZ0cWh4dW54bndqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNDk5MzksImV4cCI6MjA5MDcyNTkzOX0.t82X1x-PDgFDGYhKC3YXoRKhga9I8Hjet60QUYvtZLU';
const HEADERS = { 'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}`, 'Content-Type': 'application/json' };

test.describe('Seguridad — Sin secretos en frontend', () => {
  const PAGES = ['formulario.html?access=mj2026', 'login.html', 'panel-v2.html', 'cliente.html', 'registro.html'];
  for (const page of PAGES) {
    test(`${page.split('?')[0]} no expone ANTHROPIC_API_KEY`, async ({ page: p }) => {
      await p.goto(page);
      const html = await p.content();
      expect(/sk-ant-[a-zA-Z0-9\-_]{20,}/.test(html)).toBe(false);
    });

    test(`${page.split('?')[0]} no expone service_role key`, async ({ page: p }) => {
      await p.goto(page);
      const html = await p.content();
      expect(/service_role/.test(html)).toBe(false);
    });
  }
});

test.describe('Seguridad — HTTPS', () => {
  test('Sitio accesible por HTTPS', async ({ request }) => {
    const r = await request.get('https://pathwaycareercoach.com/index.html');
    expect(r.status()).toBe(200);
  });
});
