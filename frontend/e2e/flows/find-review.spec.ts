import { type Page } from '@playwright/test';
import { expect, test } from '../fixtures/test';
import { mockApi } from '../fixtures/api';
import { authConfig, mockSignIn } from '../fixtures/auth';
import { bundle } from '../fixtures/species';
import { CHANTERELLE_SPECIES, STONE_ID, STONE_SPECIES } from '../fixtures/photos';

const BASE = `http://127.0.0.1:${process.env['E2E_PORT'] ?? '4400'}`;

function find(id: string, lat: number, note: string | null): Record<string, unknown> {
  return {
    id,
    ownerId: 'person-eins',
    speciesId: STONE_ID,
    lat,
    lon: 9.0511,
    foundOn: '2026-09-06',
    count: 3,
    forTraining: false,
    reviewState: 'open',
    reviewedById: null,
    reviewedAt: null,
    visibility: 'private',
    groupId: null,
    note,
    createdAt: '2026-09-06T08:00:00+02:00',
    updatedAt: '2026-09-06T08:00:00+02:00',
    deleted: false,
  };
}

const OPEN_FINDS = {
  items: [find('fund-eins', 48.5203, 'Am Wegrand'), find('fund-zwei', 48.6, null)],
  nextCursor: null,
};

/** Signs in and opens the review queue of the finds. */
async function start(page: Page): Promise<void> {
  await mockSignIn(page);
  await mockApi(page, {
    '/api/config': authConfig(BASE),
    '/api/species/bundle': bundle([STONE_SPECIES, CHANTERELLE_SPECIES]),
    '/api/finds/reviews/open': OPEN_FINDS,
    '/api/photos': { items: [], nextCursor: null },
    '/api/me/permissions': { permissions: ['find.review'], roles: [] },
  });
  await page.goto('/verwaltung/funde');
  await expectOpen(page, '2', '2 offene Funde');
}

/** The head badge shows the open count; a hidden label reads it out. */
async function expectOpen(page: Page, badge: string, label: string): Promise<void> {
  await expect(page.locator('.queue__badge')).toHaveText(badge);
  await expect(page.getByText(label)).toBeAttached();
}

test('nimmt den obersten Fund an und zählt weiter', async ({ page }) => {
  const decided: string[] = [];
  await start(page);
  await page.route('**/api/finds/*/review', async (route) => {
    decided.push(`${new URL(route.request().url()).pathname} ${route.request().postData() ?? ''}`);
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  await expect(page.getByText('Am Wegrand')).toBeVisible();
  await page.getByRole('button', { name: 'Freigeben' }).click();

  await expect.poll(() => decided).toEqual(['/api/finds/fund-eins/review {"decision":"accepted"}']);
  await expectOpen(page, '1', '1 offener Fund');
});

test('nimmt eine Entscheidung auch auf dem Server zurück', async ({ page }) => {
  const calls: string[] = [];
  await start(page);
  await page.route('**/api/finds/*/review', async (route) => {
    calls.push(`${route.request().method()} ${new URL(route.request().url()).pathname}`);
    await route.fulfill({ status: 200, contentType: 'application/json', body: 'null' });
  });

  await page.getByRole('button', { name: 'Freigeben' }).click();
  await expectOpen(page, '1', '1 offener Fund');
  await page.getByRole('button', { name: 'Rückgängig' }).click();

  await expect
    .poll(() => calls)
    .toEqual(['POST /api/finds/fund-eins/review', 'DELETE /api/finds/fund-eins/review']);
  await expectOpen(page, '2', '2 offene Funde');
  await expect(page.getByText('Am Wegrand')).toBeVisible();
});
