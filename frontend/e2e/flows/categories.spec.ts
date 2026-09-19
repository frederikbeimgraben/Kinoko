import { type Page } from '@playwright/test';
import { expect, test } from '../fixtures/test';
import { mockApi } from '../fixtures/api';
import { authConfig, mockSignIn } from '../fixtures/auth';

const BASE = `http://127.0.0.1:${process.env['E2E_PORT'] ?? '4400'}`;

const TERMS = {
  items: [
    { id: 'begriff-anis', kind: 'smell', group: null, slug: 'anise', name: 'Anis', position: 0 },
    { id: 'begriff-mehl', kind: 'smell', group: null, slug: 'flour', name: 'Mehl', position: 1 },
    { id: 'begriff-eiche', kind: 'tree', group: null, slug: 'oak', name: 'Eiche', position: 0 },
  ],
};

/** Meldet an und öffnet die Kategorien der Verwaltung. */
async function start(page: Page): Promise<void> {
  await mockSignIn(page);
  await mockApi(page, {
    '/api/config': authConfig(BASE),
    '/api/terms': TERMS,
    '/api/me/permissions': { permissions: ['species.edit'], roles: [] },
  });
  await page.goto('/verwaltung/kategorien');
  await expect(page.getByRole('button', { name: /Anis/ })).toBeVisible();
}

test('legt eine Kategorie an', async ({ page }) => {
  const sent: string[] = [];
  await start(page);
  await page.route('**/api/terms', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback();
      return;
    }
    sent.push(route.request().postData() ?? '');
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'begriff-zimt',
        kind: 'smell',
        group: null,
        slug: 'zimt',
        name: 'Zimt',
        position: 0,
      }),
    });
  });

  await page.getByRole('button', { name: 'Kategorie anlegen' }).click();
  await page.getByRole('textbox', { name: 'Name' }).fill('Zimt');
  await page.getByRole('button', { name: 'Speichern' }).click();

  await expect.poll(() => sent).toEqual(['{"kind":"smell","slug":"zimt","name":"Zimt"}']);
  await expect(page.getByRole('button', { name: /Zimt/ })).toBeVisible();
});

test('führt eine Kategorie in eine andere', async ({ page }) => {
  const merged: string[] = [];
  await start(page);
  await page.route('**/api/terms/*/merge', async (route) => {
    merged.push(`${new URL(route.request().url()).pathname} ${route.request().postData() ?? ''}`);
    await route.fulfill({ status: 204, body: '' });
  });

  await page.getByRole('button', { name: /Anis/ }).click();
  await page.getByRole('button', { name: /Zusammenführen/ }).click();
  await page.getByRole('group', { name: 'Ziel' }).getByRole('button', { name: /Mehl/ }).click();
  await page.getByRole('button', { name: 'Zusammenführen', exact: true }).click();

  await expect.poll(() => merged).toEqual(['/api/terms/begriff-anis/merge {"into":"begriff-mehl"}']);
  await expect(page.getByRole('button', { name: /Anis/ })).toHaveCount(0);
});

test('löscht eine Kategorie nach der Bestätigung', async ({ page }) => {
  const removed: string[] = [];
  await start(page);
  await page.route('**/api/terms/*', async (route) => {
    if (route.request().method() !== 'DELETE') {
      await route.fallback();
      return;
    }
    removed.push(new URL(route.request().url()).pathname);
    await route.fulfill({ status: 204, body: '' });
  });

  await page.getByRole('button', { name: /Anis/ }).click();
  await page.getByRole('button', { name: 'Löschen' }).click();
  await expect(page.getByRole('heading', { name: 'Anis löschen?' })).toBeVisible();
  await page.getByRole('button', { name: 'Löschen' }).click();

  await expect.poll(() => removed).toEqual(['/api/terms/begriff-anis']);
  await expect(page.getByRole('button', { name: /Anis/ })).toHaveCount(0);
});
