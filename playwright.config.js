// @ts-check
const { defineConfig } = require('@playwright/test');

// F2.7 — BASE_URL NO tiene valor por defecto a proposito.
//
// Antes caia a produccion en silencio, y por eso el cron diario
// (.github/workflows/daily-testing-agent.yml) lleva meses escribiendo fixtures
// en la base real: 27 de los 73 clientes, 13 usuarios y 2 organizaciones de
// produccion son de test, y contaminan retencion, embudo y ranking de coaches.
//
// Ahora la suite FALLA si no se declara el entorno. Es deliberado: es preferible
// un fallo ruidoso a un escritor silencioso contra produccion.
const BASE_URL = process.env.BASE_URL;
if (!BASE_URL) {
  throw new Error(
    'BASE_URL no definida. Declara el entorno explicitamente, por ejemplo:\n' +
    '  BASE_URL=http://localhost:8080/ npx playwright test\n' +
    'No se asume produccion por defecto (ver F2.7 del runbook de remediacion).'
  );
}

// Chromium ya instalado en la maquina. Sirve para correr la suite en entornos
// sin salida a internet para bajar el browser que trae Playwright (contenedores,
// CI aislado): PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npx playwright test
// Sin la variable, todo queda exactamente como antes.
const CHROMIUM_PATH = process.env.PW_CHROMIUM_PATH || '';

module.exports = defineConfig({
  testDir: './tests',
  // Solo *.spec.js — que es como se llaman los 10 tests de Playwright del repo.
  //
  // POR QUE HACE FALTA DECIRLO. El patron por defecto tambien recoge *.test.js,
  // y `tests/coach-services-ios-blocking.test.js` esta escrito en estilo Jest:
  // usa `describe`/`test` globales sin importarlos, `document`/`window` (necesita
  // un DOM, que en Playwright vive en el navegador, no en el proceso de Node) y
  // `jest.fn()`. Al recogerlo, el runner petaba con "describe is not defined"
  // ANTES de ejecutar nada, y la suite ENTERA se quedaba en 0 tests. Es decir:
  // este repositorio llevaba tiempo sin correr un solo test de Playwright, y el
  // verde del CI no significaba nada.
  //
  // Este filtro deja el archivo de iOS exactamente como esta —no se le toca una
  // linea de logica— y devuelve la suite a la vida. Para que ese test corra de
  // verdad hace falta un runner con DOM (Jest + jsdom, o vitest), que hoy no
  // esta en package.json: es tarea aparte, anotada en su cabecera.
  testMatch: '**/*.spec.js',
  // El bot logueado (entrar + render + recorrer secciones) de un panel pesado
  // (dueño multicoach) necesita más de 30s legítimamente. 60s da margen sin tapar
  // roturas reales (un panel roto igual falla el render en 15s).
  timeout: 60000,
  // 1 reintento: absorbe flaky de una sola corrida (blip de red, carga fría) para
  // que el reporte diario solo marque en rojo lo que falla de verdad, no un tropezón.
  retries: 1,
  workers: 2,
  reporter: [
    ['list'],
    ['json', { outputFile: 'tests/results/test-results.json' }]
  ],
  use: {
    baseURL: BASE_URL,
    screenshot: 'off',
    trace: 'off',
    headless: true,
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
    actionTimeout: 10000,
    navigationTimeout: 20000,
    launchOptions: CHROMIUM_PATH ? { executablePath: CHROMIUM_PATH } : {},
  },
  projects: [
    {
      name: 'Desktop Chrome',
      use: { browserName: 'chromium' },
    },
  ],
  outputDir: 'tests/results/artifacts',
});
