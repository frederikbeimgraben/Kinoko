import { expect, test } from '../../fixtures/test';
import { type Locator } from '@playwright/test';
import { mockApi } from '../../fixtures/api';

async function cursorOf(target: Locator): Promise<string> {
  return target.evaluate((el) => getComputedStyle(el).cursor);
}

test.describe('Pointer cursor on the desktop', () => {
  test('blocks that take a click show the pointer, text fields show the text cursor', async ({ page }) => {
    await mockApi(page);
    await page.goto('/dev/blocks');

    const pointerTargets = [
      page.locator('[data-block="Button"] button').first(),
      page.locator('[data-block="RadioRow"] .row').first(),
      page.locator('[data-block="Segment"] .seg__choice').first(),
      page.locator('[data-block="ChipSet"] .chip').first(),
      page.locator('[data-block="Chip"] .chip').first(),
      page.locator('[data-block="SwitchRow"] .switch').first(),
      page.locator('[data-block="PhotoStrip"] .pht--add'),
    ];
    for (const target of pointerTargets) {
      await expect(target).toBeVisible();
      expect.soft(await cursorOf(target), target.toString()).toBe('pointer');
    }

    const textTargets = [
      page.locator('[data-block="SearchBar"] .search__input').first(),
      page.locator('[data-block="SearchBar"] .search').first(),
    ];
    for (const target of textTargets) {
      await expect(target).toBeVisible();
      expect.soft(await cursorOf(target), target.toString()).toBe('text');
    }
  });

  test('the tabs of the navigation show the pointer', async ({ page }) => {
    await mockApi(page);
    await page.goto('/arten');

    const tab = page.getByRole('navigation').locator('a[href="/arten"]');
    await expect(tab).toBeVisible();
    expect(await cursorOf(tab)).toBe('pointer');
  });
});
