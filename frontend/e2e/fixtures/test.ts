/** Der Testbaustein für Flüsse und Bretter: bricht bei einem fehlenden Textschlüssel ab. */

import { test as base, expect, type ConsoleMessage } from '@playwright/test';
import { MISSING_KEY_PREFIX } from '../../src/app/core/i18n/i18n.service';

export const test = base.extend<{ consoleGuard: true }>({
  consoleGuard: [
    async ({ page }, use) => {
      const found: string[] = [];
      const onConsole = (message: ConsoleMessage): void => {
        if (message.type() === 'error' && message.text().includes(MISSING_KEY_PREFIX)) {
          found.push(message.text());
        }
      };
      page.on('console', onConsole);

      await use(true);

      page.off('console', onConsole);
      expect(found, 'Die Seite meldete einen fehlenden Textschlüssel.').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
