import { expect, test, type Locator } from '@playwright/test';
import { mockApi } from '../../fixtures/api';

async function cursorOf(target: Locator): Promise<string> {
  return target.evaluate((el) => getComputedStyle(el).cursor);
}

test.describe('Zeiger-Cursor am Rechner', () => {
  test('klickbare Bausteine zeigen den Zeiger, Textfelder den Text-Cursor', async ({ page }) => {
    await mockApi(page);
    await page.goto('/bausteine');

    const pointerTargets = [
      page.locator('[data-block="app-button"] button').first(),
      page.locator('[data-block="app-choice-row"] .row').first(),
      page.locator('[data-block="app-segmented"] .seg__choice').first(),
      page.locator('[data-block="app-chip-group"] .chip').first(),
      page.locator('[data-block="app-filter-chip"] .filterchip__remove').first(),
      page.locator('[data-block="app-switch"] .switch').first(),
      page.locator('[data-block="app-photo-picker"] .tile--add'),
    ];
    for (const target of pointerTargets) {
      await expect(target).toBeVisible();
      expect(await cursorOf(target)).toBe('pointer');
    }

    const textTargets = [
      page.locator('[data-block="app-search-field"] .search__input').first(),
      page.locator('[data-block="app-search-field"] .search').first(),
    ];
    for (const target of textTargets) {
      await expect(target).toBeVisible();
      expect(await cursorOf(target)).toBe('text');
    }

    const undo = page.locator('[data-block="app-review-queue"] .queue__round--undo');
    await expect(undo).toBeVisible();
    await expect(undo).toBeDisabled();
    expect(await cursorOf(undo)).toBe('default');
  });

  test('Reiter der Navigation zeigen den Zeiger', async ({ page }) => {
    await mockApi(page);
    await page.goto('/arten');

    const tab = page.getByRole('navigation').locator('a[href="/arten"]');
    await expect(tab).toBeVisible();
    expect(await cursorOf(tab)).toBe('pointer');
  });
});
