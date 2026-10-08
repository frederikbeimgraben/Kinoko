import { expect, test } from '../fixtures/test';
import { type Page } from '@playwright/test';
import { mockApi } from '../fixtures/api';
import { authConfig, mockSignIn } from '../fixtures/auth';

const BASE = `http://127.0.0.1:${process.env['E2E_PORT'] ?? '4400'}`;

const EXPORT = {
  me: { id: 'konto-eins', sub: 'sub-eins', email: 'frederik@beimgraben.net', name: 'Frederik' },
  finds: [{}, {}],
  markers: [{}],
  zones: [],
  combinations: [{}, {}, {}],
  photos: [{}],
};

/** Signs in and puts the contract on the page. */
async function start(page: Page, path: string, extra: Record<string, unknown> = {}): Promise<void> {
  await mockSignIn(page);
  await mockApi(page, { '/api/config': authConfig(BASE), ...extra });
  await page.goto(path);
}

test('Meine Daten zeigt Zähler, exportiert und löscht alles', async ({ page }) => {
  const deletes: string[] = [];
  await start(page, '/konto/daten', { '/api/me/export': EXPORT });
  await page.route('**/api/me/data', async (route) => {
    deletes.push(route.request().method());
    await route.fulfill({ status: 204 });
  });

  await expect(page.getByText('Funde', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Daten exportieren' }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportieren', exact: true }).click();
  expect((await download).suggestedFilename()).toMatch(/^kinoko-export-\d{4}-\d{2}-\d{2}\.json$/);

  await page.getByRole('button', { name: 'Daten exportieren' }).click();
  await page.getByRole('tab', { name: 'GPX' }).click();
  const gpx = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportieren', exact: true }).click();
  expect((await gpx).suggestedFilename()).toMatch(/\.gpx$/);

  await page.getByRole('button', { name: 'Alles löschen' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Alles löschen' }).click();

  await expect(page).toHaveURL(/\/konto$/);
  expect(deletes).toEqual(['DELETE']);
  await expect(page.getByText('Alle Daten gelöscht')).toBeVisible();
});
