import { defineConfig } from '@playwright/test';

const PORT = 4400;
const ADDRESS = `http://127.0.0.1:${PORT}`;
const CI = Boolean(process.env['CI']);
const BROWSER_PATH = process.env['BROWSER_PATH'];

/** Ein Board ist ein Bild je Gerät. Ein Fluss läuft nur am Telefon. */
const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1280, height: 820 };

export default defineConfig({
  testDir: 'e2e',
  outputDir: 'e2e/ergebnisse',
  fullyParallel: true,
  forbidOnly: CI,
  retries: 0,
  workers: CI ? 2 : undefined,
  reporter: CI ? [['list'], ['html', { outputFolder: 'e2e/bericht', open: 'never' }]] : [['list']],
  snapshotPathTemplate: '{testDir}/boards/baseline/{arg}{ext}',
  use: {
    baseURL: ADDRESS,
    browserName: 'chromium',
    launchOptions: BROWSER_PATH ? { executablePath: BROWSER_PATH } : {},
    trace: 'retain-on-failure',
    colorScheme: 'light',
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
  },
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.005, animations: 'disabled', caret: 'hide' },
  },
  projects: [
    { name: 'phone', testMatch: /boards\/.*\.spec\.ts$/, use: { viewport: PHONE } },
    { name: 'desktop', testMatch: /boards\/.*\.spec\.ts$/, use: { viewport: DESKTOP } },
    { name: 'flows', testMatch: /flows\/.*\.spec\.ts$/, use: { viewport: PHONE } },
  ],
  webServer: {
    command: `node e2e/serve.mjs ${PORT}`,
    url: ADDRESS,
    reuseExistingServer: !CI,
    timeout: 60_000,
  },
});
