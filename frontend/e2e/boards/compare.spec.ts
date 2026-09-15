import { expect, test, type Page } from '@playwright/test';
import { mockApi } from '../fixtures/api';
import { authConfig, mockSignIn } from '../fixtures/auth';
import { flatMap } from '../fixtures/flat-map';
import { COMPARE, COMPARE_DESKTOP } from '../fixtures/compare';
import { expectBoard, skipPending } from './board';

const BASE = `http://127.0.0.1:${process.env['E2E_PORT'] ?? '4400'}`;

/** Was die angemeldete App nebenher holt. Ohne Antwort meldet sie einen Fehler. */
const EMPTY_PAGE = { eintraege: [], gesamt: 0 };
const EMPTY_FINDS = { items: [], nextCursor: null };
/** Die Bilder der Artseite. Ohne Antwort meldet die Seite einen Fehler. */
const NO_PHOTOS = { '/api/photos': { items: [], nextCursor: null } };

const SIGNED_IN: Record<string, unknown> = {
  '/api/combinations': EMPTY_PAGE,
  '/api/funde': EMPTY_PAGE,
  '/api/finds': EMPTY_FINDS,
  '/api/marker': EMPTY_PAGE,
  '/api/zonen': EMPTY_PAGE,
};

/** Ein Board gehört zu einem Gerät und läuft nicht, solange es aussteht. */
function guard(board: string, device: 'phone' | 'desktop'): void {
  test.skip(test.info().project.name !== device, `Board gehört zu ${device}`);
  skipPending(board);
}

/** Öffnet die Artseite des Steinpilzes mit dem Katalog des Bretts. */
async function openSpecies(page: Page, items: unknown, extra: Record<string, unknown> = {}): Promise<void> {
  await mockApi(page, { '/api/species/bundle': items, ...NO_PHOTOS, ...extra });
  await flatMap(page);
  await page.goto('/arten/boletus-edulis');
  await expect(page.getByText('Verwechslung mit')).toBeVisible();
}

/** Stellt die Art dieser Zeile der offenen Art gegenüber. */
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
  guard('CompareDesktop', 'desktop');
  await mockSignIn(page);
  await openSpecies(page, COMPARE_DESKTOP, { '/api/config': authConfig(BASE), ...SIGNED_IN });
  await compareWith(page, 'Gallenröhrling');
  await page.goBack();
  await compareWith(page, 'Maronenröhrling');
  await expect(page.getByText('3 Arten')).toBeVisible();
  await expectBoard(page, 'CompareDesktop');
});
