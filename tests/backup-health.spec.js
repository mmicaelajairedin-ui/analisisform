// @ts-check
// Salud de la FUENTE del backup: las tablas que scripts/backup-export.js
// exporta cada noche tienen que seguir accesibles y las críticas con datos.
// Si una se cae, el backup saldría incompleto SIN avisar — por eso lo metemos
// en el conteo de tests del reporte diario.
const { test, expect } = require('@playwright/test');

const SB_URL = 'https://ddxnrsnjdvtqhxunxnwj.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkeG5yc25qZHZ0cWh4dW54bndqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNDk5MzksImV4cCI6MjA5MDcyNTkzOX0.t82X1x-PDgFDGYhKC7YXoRKhga9I8Hjet60QUYvtZLU';
const HEADERS = { 'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}` };

// Mismas tablas que exporta el backup nocturno.
const BACKUP_TABLES = [
  'candidatos', 'usuarios', 'informes', 'cv_publicados', 'cv_express',
  'contactos_chat', 'leads_pricing', 'solicitudes', 'site_context',
  'analytics_reports', 'push_subscriptions',
];

test.describe('Backup — Fuente de datos accesible', () => {
  for (const table of BACKUP_TABLES) {
    test(`Tabla "${table}" exportable por el backup`, async ({ request }) => {
      const r = await request.get(`${SB_URL}/rest/v1/${table}?select=id&limit=1`, { headers: HEADERS });
      // 200 = OK · 404 = la tabla aún no existe (no es un fallo de backup).
      expect([200, 404]).toContain(r.status());
    });
  }
});

test.describe('Backup — Tablas críticas con datos', () => {
  for (const table of ['candidatos', 'usuarios']) {
    test(`"${table}" no está vacía`, async ({ request }) => {
      const r = await request.get(`${SB_URL}/rest/v1/${table}?select=id&limit=1`, {
        headers: { ...HEADERS, 'Prefer': 'count=exact' },
      });
      expect(r.status()).toBe(200);
      const range = r.headers()['content-range']; // "0-0/N"
      if (range) {
        const total = parseInt(range.split('/')[1], 10);
        expect(total).toBeGreaterThanOrEqual(1);
        console.log(`${table}: ${total} registros respaldables`);
      }
    });
  }
});
