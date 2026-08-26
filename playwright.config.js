// @ts-check
const { defineConfig } = require('@playwright/test');

const BASE_URL = process.env.BASE_URL || 'https://pathwaycareercoach.com/';

// Chromium ya instalado en la maquina. Sirve para correr la suite en entornos
// sin salida a internet para bajar el browser que trae Playwright (contenedores,
// CI aislado): PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npx playwright test
// Sin la variable, todo queda exactamente como antes.
const CHROMIUM_PATH = process.env.PW_CHROMIUM_PATH || '';

module.exports = defineConfig({
  testDir: './tests',
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
