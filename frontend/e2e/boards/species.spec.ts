import { test } from '@playwright/test';
import { mockApi } from '../fixtures/api';
import { expectBoard } from './board';

test('Species', async ({ page }) => {
  await mockApi(page);
  await page.goto('/arten');
  await expectBoard(page, 'Species');
});
