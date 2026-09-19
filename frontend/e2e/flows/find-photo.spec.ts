import { expect, test } from '../fixtures/test';
import { type Page } from '@playwright/test';
import { mockApi } from '../fixtures/api';
import { authConfig, mockSignIn } from '../fixtures/auth';
import { GROUPS } from '../fixtures/groups';
import { SPECIES_BUNDLE, mockMap } from '../fixtures/map';

const BASE = `http://127.0.0.1:${process.env['E2E_PORT'] ?? '4400'}`;

const FINDS = {
  items: [
    {
      id: 'find-eins',
      ownerId: 'person-eins',
      lat: 48.5203,
      lon: 9.0511,
      speciesId: '00000000-0000-4000-8000-000000000014',
      foundOn: '2026-09-06',
      count: 3,
      reviewState: 'accepted',
      visibility: 'shared',
      groupId: GROUPS[0].id,
      forTraining: true,
      note: null,
      updatedAt: '2026-09-06T08:00:00Z',
      deleted: false,
    },
  ],
  nextCursor: null,
};

/** Zwei Fotos am Fund: der Dialog kann damit auch weiterblättern. */
const PHOTOS = {
  items: [
    { id: 'foto-eins', findId: 'find-eins', state: 'accepted', source: 'own', ownerName: 'Frederik' },
    { id: 'foto-zwei', findId: 'find-eins', state: 'accepted', source: 'own', ownerName: 'Frederik' },
  ],
  nextCursor: null,
};

/** Geht über die Liste der Einträge in das Blatt des Fundes. */
async function openFind(page: Page): Promise<void> {
  await mockSignIn(page);
  await mockApi(page, {
    '/api/config': authConfig(BASE),
    '/api/species/bundle': SPECIES_BUNDLE,
    '/api/combinations': [],
    '/api/markers': { items: [], nextCursor: null },
    '/api/zones': { items: [], nextCursor: null },
    '/api/finds': FINDS,
    '/api/photos': PHOTOS,
    '/api/groups': { items: GROUPS },
  });
  await mockMap(page, { detent: 1 });
  await page.goto('/eintraege');
  await page.getByRole('tab', { name: 'Funde' }).click();
  const entry = page.getByRole('button').filter({ hasText: 'Steinpilz' }).first();
  await expect(entry).toBeVisible();
  // Unter Last kommt der Tipp vor dem Zuhörer der Zeile an.
  await expect(async () => {
    await entry.click();
    await expect(page).toHaveURL(/\/karte$/, { timeout: 2000 });
  }).toPass({ timeout: 20000 });
  await expect(page.getByRole('heading', { name: 'Steinpilz' })).toBeVisible();
}

test('Ein Tipp auf ein Foto öffnet den Dialog über dem Fundblatt', async ({ page }) => {
  await openFind(page);

  const tile = page.getByRole('button', { name: 'Foto 1' });
  await tile.click();

  const dialog = page.getByRole('dialog', { name: 'Foto 1' });
  await expect(dialog).toBeVisible();
  // Das Blatt bleibt hinter dem Dialog offen.
  await expect(page.getByRole('heading', { name: 'Steinpilz' })).toBeVisible();

  await dialog.locator('.photo__close').click();

  await expect(dialog).toHaveCount(0);
  await expect(tile).toBeFocused();
});

test('Der Dialog blättert zum zweiten Foto und schließt über Escape', async ({ page }) => {
  await openFind(page);

  await page.getByRole('button', { name: 'Foto 1' }).click();
  await expect(page.getByRole('dialog', { name: 'Foto 1' })).toBeVisible();

  await page.getByRole('button', { name: 'Nächstes Bild' }).click();
  await expect(page.getByRole('dialog', { name: 'Foto 2' })).toBeVisible();

  await page.keyboard.press('Escape');

  await expect(page.getByRole('dialog', { name: 'Foto 2' })).toHaveCount(0);
});
