import { defineConfig } from '@playwright/test';

// Several branches can measure at the same time, so the port can be set.
const PORT = Number(process.env['E2E_PORT'] ?? 4400);
const ADDRESS = `http://127.0.0.1:${PORT}`;
const CI = Boolean(process.env['CI']);
const BROWSER_PATH = process.env['BROWSER_PATH'];

/** A board is one image per device. A flow runs on the phone, except when it
 * checks a pointer device (`e2e/flows/desktop/`). */
const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1280, height: 820 };
const WIDE = { width: 1440, height: 900 };
const BLOCKS = { width: 900, height: 9813 };

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
    // The boards and the tests must render text the same way.
    launchOptions: {
      args: ['--disable-lcd-text', '--font-render-hinting=none'],
      ...(BROWSER_PATH ? { executablePath: BROWSER_PATH } : {}),
    },
    trace: 'retain-on-failure',
    colorScheme: 'dark',
    // A service worker catches the requests before a mock can answer them.
    // The install test turns it on again for itself.
    serviceWorkers: 'block',
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
    // Boards take the picture of a still state, not of a running transition.
    reducedMotion: 'reduce',
  },
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.005, animations: 'disabled', caret: 'hide' },
  },
  projects: [
    // The glob stops a branch name that contains "boards" from matching each file.
    // The CI browser denies the location without a grant. The boards show the enabled button.
    { name: 'phone', testMatch: 'boards/*.spec.ts', use: { viewport: PHONE, permissions: ['geolocation'] } },
    { name: 'desktop', testMatch: 'flows/desktop/*.spec.ts', use: { viewport: DESKTOP } },
    { name: 'wide', testMatch: 'boards/*.spec.ts', use: { viewport: WIDE, permissions: ['geolocation'] } },
    // The blocks board compares 119 cards in one test.
    {
      name: 'blocks',
      testMatch: 'boards/blocks.spec.ts',
      timeout: 600_000,
      use: { viewport: BLOCKS },
    },
    {
      name: 'flows',
      testMatch: 'flows/*.spec.ts',
      // Flows check transitions: reduced motion only where a flow asks for it.
      use: { viewport: PHONE, reducedMotion: 'no-preference' },
    },
  ],
  webServer: {
    command: `node e2e/serve.mjs ${PORT}`,
    url: ADDRESS,
    reuseExistingServer: !CI,
    timeout: 60_000,
  },
});
