import { test } from '@playwright/test';
import { mockApi } from '../fixtures/api';
import { mockTiles } from '../fixtures/map';
import { expectBoard } from './board';

test('Map', async ({ page }) => {
  await mockApi(page);
  await mockTiles(page);
  await page.goto('/karte');
  await expectBoard(page, 'Map');
});
