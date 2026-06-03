// @ts-check
const { test, expect } = require('@playwright/test');

const ALL_PUBLIC = [
  'index.html', 'blog.html', 'coaches.html', 'precios-coaching.html',
  'legales.html', 'soy-coach.html', 'soy-candidato.html', 'comunidad.html',
  'resena.html', 'checklist-linkedin.html',
  // Blog posts
  '5-errores-cv.html', '7-preguntas-entrevista.html', 'cv-con-ia-2026.html',
  'primeros-10-clientes-coaching.html', 'rechazo-entrevista-final.html',
  'mejor-plataforma-career-coaches.html',
  // Salary pages
  'calculadora-sueldo-2026.html', 'sueldo-developer-2026.html',
  'sueldo-data-analyst-2026.html', 'sueldo-disenador-ux-2026.html',
  'sueldo-product-manager-2026.html',
];

const ALL_AUTH = [
  'login.html', 'registro.html', 'auth-callback.html',
  'verify.html',
];

const ALL_TOOLS = [
  'cv-express.html', 'cv.html', 'cv-ats.html', 'carta.html',
  'hub.html', 'linkedin-viewer.html', 'upgrade.html',
  'post-demo.html',
];

const ALL_PROTECTED = [
  'panel-v2.html',
  'coach.html', 'admin-express.html', 'cliente.html',
];

test.describe('Páginas públicas — cargan sin error', () => {
  for (const page of ALL_PUBLIC) {
    test(`${page} responde 200`, async ({ request }) => {
      const BASE = process.env.BASE_URL || 'https://pathwaycareercoach.com/';
      const r = await request.get(`${BASE}${page}`);
      expect(r.status()).toBe(200);
    });
  }
});

test.describe('Páginas de auth — cargan sin error', () => {
  for (const page of ALL_AUTH) {
    test(`${page} responde 200`, async ({ request }) => {
      const BASE = process.env.BASE_URL || 'https://pathwaycareercoach.com/';
      const r = await request.get(`${BASE}${page}`);
      expect(r.status()).toBe(200);
    });
  }
});

test.describe('Herramientas — cargan sin error', () => {
  for (const page of ALL_TOOLS) {
    test(`${page} responde 200`, async ({ request }) => {
      const BASE = process.env.BASE_URL || 'https://pathwaycareercoach.com/';
      const r = await request.get(`${BASE}${page}`);
      expect(r.status()).toBe(200);
    });
  }
});

test.describe('Páginas protegidas — cargan sin error de servidor', () => {
  for (const page of ALL_PROTECTED) {
    test(`${page} responde 200 (redirige a login si no hay sesión)`, async ({ request }) => {
      const BASE = process.env.BASE_URL || 'https://pathwaycareercoach.com/';
      const r = await request.get(`${BASE}${page}`);
      expect(r.status()).toBe(200);
    });
  }
});

test.describe('Formulario — carga con access gate', () => {
  test('formulario.html con ?access=mj2026 responde 200', async ({ request }) => {
    const BASE = process.env.BASE_URL || 'https://pathwaycareercoach.com/';
    const r = await request.get(`${BASE}formulario.html?access=mj2026`);
    expect(r.status()).toBe(200);
  });
});
