import { test } from '@playwright/test';
import { mockApi } from '../fixtures/api';
import { expectBoard } from './board';

test('Blocks', async ({ page }) => {
  await mockApi(page);
  await page.goto('/bausteine');
  await expectBoard(page, 'Blocks');
});
