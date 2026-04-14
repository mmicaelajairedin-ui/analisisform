// @ts-check
const { defineConfig } = require('@playwright/test');

const BASE_URL = process.env.BASE_URL || 'https://mmicaelajairedin-ui.github.io/analisisform';

module.exports = defineConfig({
  testDir: './tests',
  timeout: 15000,
  retries: 0,
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
    actionTimeout: 5000,
    navigationTimeout: 10000,
  },
  projects: [
    {
      name: 'Desktop Chrome',
      use: { browserName: 'chromium' },
    },
  ],
  outputDir: 'tests/results/artifacts',
});
