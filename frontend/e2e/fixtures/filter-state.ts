import type { Page } from '@playwright/test';

const KEY = 'pilzkarte.speciesfilter';

/** Puts the filter choice into storage before the page starts. */
export async function presetFilter(page: Page, choice: unknown): Promise<void> {
  await page.addInitScript(
    ([key, value]) => {
      localStorage.setItem(key, value);
    },
    [KEY, JSON.stringify(choice)] as const,
  );
}
