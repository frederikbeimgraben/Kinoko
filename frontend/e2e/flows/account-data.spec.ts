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

/** Meldet an und legt den Vertrag auf die Seite. */
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

  await expect(page.getByText('Funde')).toBeVisible();
  await expect(page.getByText('Kombinationen')).toBeVisible();

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Als JSON exportieren' }).click();
  expect((await download).suggestedFilename()).toMatch(/^kinoko-export-\d{4}-\d{2}-\d{2}\.json$/);

  await page.getByRole('button', { name: 'Alles löschen' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Löschen' }).click();

  await expect(page).toHaveURL(/\/konto$/);
  expect(deletes).toEqual(['DELETE']);
  await expect(page.getByText('Alle Daten gelöscht')).toBeVisible();
});
