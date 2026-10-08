import { expect, test } from '../fixtures/test';
import { type Page } from '@playwright/test';
import { mockApi } from '../fixtures/api';
import { authConfig, mockSignIn } from '../fixtures/auth';
import { flatMap } from '../fixtures/flat-map';
import { COMPARE } from '../fixtures/compare';
import { expectBoard, skipPending } from './board';

const BASE = `http://127.0.0.1:${process.env['E2E_PORT'] ?? '4400'}`;

/** The data that the signed-in app gets in the background. Without a reply it shows an error. */

const EMPTY_FINDS = { items: [], nextCursor: null };
/** The photos of the species page. Without a reply the page shows an error. */
const NO_PHOTOS = { '/api/photos': { items: [], nextCursor: null } };

const SIGNED_IN: Record<string, unknown> = {
  '/api/combinations': EMPTY_FINDS,
  '/api/finds': EMPTY_FINDS,
  '/api/markers': EMPTY_FINDS,
  '/api/zones': EMPTY_FINDS,
};

/** A board belongs to one device. It does not run while it is pending. */
function guard(board: string, device: 'phone' | 'wide'): void {
  test.skip(test.info().project.name !== device, `Board gehört zu ${device}`);
  skipPending(board);
}

/** Opens the species page of the penny bun with the catalogue of the board. */
async function openSpecies(page: Page, items: unknown, extra: Record<string, unknown> = {}): Promise<void> {
  await mockApi(page, { '/api/species/bundle': items, ...NO_PHOTOS, ...extra });
  await flatMap(page);
  await page.goto('/arten/boletus-edulis');
}

/** Compares the species of this row with the open species. */
async function compareWith(page: Page, name: string): Promise<void> {
  await page
    .locator('app-list-row')
    .filter({ hasText: name })
    .getByRole('button', { name: 'Vergleichen' })
    .click();
  await expect(page.getByRole('heading', { name: 'Vergleich' })).toBeVisible();
}

test('Compare', async ({ page }) => {
  guard('Compare', 'phone');
  await openSpecies(page, COMPARE);
  await compareWith(page, 'Gallenröhrling');
  await expectBoard(page, 'Compare');
});

test('CompareDesktop', async ({ page }) => {
  guard('CompareDesktop', 'wide');
  await mockSignIn(page);
  await openSpecies(page, COMPARE, { '/api/config': authConfig(BASE), ...SIGNED_IN });
  await compareWith(page, 'Gallenröhrling');
  await expectBoard(page, 'CompareDesktop');
});
