import type { Page } from '@playwright/test';

const KEY = 'pilzkarte.speciesfilter';

/** Legt die Filterwahl in den Speicher, bevor die Seite startet. */
export async function presetFilter(page: Page, choice: unknown): Promise<void> {
  await page.addInitScript(
    ([key, value]) => {
      localStorage.setItem(key, value);
    },
    [KEY, JSON.stringify(choice)] as const,
  );
}
