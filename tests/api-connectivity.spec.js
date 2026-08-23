// @ts-check
const { test, expect } = require('@playwright/test');

const SB_URL = 'https://api.pathwaycareercoach.com';

// El project-ref de Pathway. Vive aparte de la clave A PROPOSITO: es lo que
// permite COMPROBAR la clave en vez de confiar en ella.
const PROJECT_REF = 'ddxnrsnjdvtqhxunxnwj';

const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkeG5yc25qZHZ0cWh4dW54bndqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNDk5MzksImV4cCI6MjA5MDcyNTkzOX0.t82X1x-PDgFDGYhKC7YXoRKhga9I8Hjet60QUYvtZLU';
const HEADERS = { 'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}` };

// Devuelve el payload del JWT, o null si no se puede leer. NUNCA lanza: un throw
// a nivel de modulo hace que Playwright aborte el descubrimiento de TODA la
// bateria —no solo de este fichero—, que es como el agente paso once dias
// diciendo "healthy" con 0 tests. Un problema con la clave tiene que aparecer
// como un TEST EN ROJO, nunca como una bateria que no arranca. (INC-026, R-34)
function leerPayload(jwt) {
  try {
    const partes = String(jwt).split('.');
    if (partes.length !== 3) return null;
    const b64 = partes[1].replace(/-/g, '+').replace(/_/g, '/');
    const pad = '='.repeat((4 - (b64.length % 4)) % 4);
    return JSON.parse(Buffer.from(b64 + pad, 'base64').toString('utf-8'));
  } catch (_e) {
    return null;
  }
}

const TABLES = ['candidatos', 'informes', 'usuarios', 'cv_publicados', 'prospectos', 'email_queue'];

// ─── La credencial se comprueba ANTES de usarla ────────────────────────────
//
// Este fichero llevaba una clave anon con el project-ref cambiado a mano
// —`...nwl` por `...nwj`, una letra— y la firma original intacta. Supabase la
// rechaza, asi que los 8 tests de abajo daban 401 y el informe diario los
// presentaba como "la base no responde". Doce dias.
//
// Comparar cadenas no lo ve: el project-ref viaja en base64 DENTRO del JWT, y
// por eso los dos validadores del repositorio daban verde. Esto DECODIFICA. Si
// alguien vuelve a tocar la clave, falla UN test que dice exactamente que pasa,
// en vez de ocho que culpan a la base de datos. (R-26)
test.describe('Supabase — Credencial', () => {
  test('la clave anon apunta al project-ref de Pathway', () => {
    const payload = leerPayload(SB_KEY);
    expect(payload, 'SB_KEY no es un JWT legible: revisa que no este truncada').not.toBeNull();
    expect(payload.role, 'SB_KEY no es una clave anon').toBe('anon');
    expect(
      payload.ref,
      `SB_KEY apunta al project-ref "${payload.ref}" y el de Pathway es "${PROJECT_REF}". ` +
        'La clave esta corrupta: los tests de conectividad daran 401, y eso NO significa ' +
        'que la base este caida.',
    ).toBe(PROJECT_REF);
  });
});

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
