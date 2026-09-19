import { expect, test } from '../fixtures/test';
import { mockApi } from '../fixtures/api';

const TABS = ['/karte', '/arten', '/eintraege'];

test('Reiter wechseln', async ({ page }) => {
  await mockApi(page);
  await page.goto('/');
  const bar = page.getByRole('navigation');
  await expect(bar).toBeVisible();
  for (const path of TABS) {
    await bar.locator(`a[href="${path}"]`).click();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expect(bar.locator(`a[href="${path}"]`)).toHaveAttribute('aria-current', 'page');
  }
});
