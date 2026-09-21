import { expect, test } from '../fixtures/test';
import { type Page, type Request } from '@playwright/test';
import { mockApi } from '../fixtures/api';
import { authConfig, mockSignIn } from '../fixtures/auth';

/** Der Server kennt noch nichts Eigenes. */
const EMPTY_PAGE = { items: [], nextCursor: null };

/** Die Schalter des Netzes und die Anfragen, die der Abgleich sendet. */
interface Wire {
  sent: Request[];
  cut: () => Promise<void>;
  join: () => Promise<void>;
}

async function wire(page: Page, origin: string): Promise<Wire> {
  const sent: Request[] = [];
  let down = false;
  await mockSignIn(page);
  await mockApi(page, {
    '/api/config': authConfig(origin),
    '/api/finds': EMPTY_PAGE,
    '/api/markers': EMPTY_PAGE,
    '/api/zones': EMPTY_PAGE,
  });
  await page.route('**/api/markers/**', async (route) => {
    sent.push(route.request());
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{"id":"marker-eins"}' });
  });
  // Ohne Netz scheitert das Schreiben. Lesen bleibt bei dem, was schon da ist,
  // sonst deckte ein Schwall Toasts die Knöpfe zu.
  await page.route('**/api/**', async (route) => {
    if (down && route.request().method() !== 'GET') {
      await route.abort('internetdisconnected');
      return;
    }
    await route.fallback();
  });
  const say = (kind: string): Promise<void> =>
    page.evaluate((name) => {
      dispatchEvent(new Event(name));
    }, kind);
  return {
    sent,
    cut: async () => {
      down = true;
      await say('offline');
    },
    join: async () => {
      down = false;
      await say('online');
    },
  };
}

test('Melden ohne Netz, Senden bei Netz', async ({ page, baseURL }) => {
  const net = await wire(page, new URL(baseURL ?? '').origin);
  await page.goto('/karte');
  await expect(page.getByLabel(/Konto von/)).toBeVisible();

  await net.cut();
  await expect(page.locator('app-banner')).toContainText('Keine Verbindung');

  await page.getByRole('button', { name: 'Eintragen' }).click();
  await expect(page.getByRole('dialog', { name: 'Eintragen' })).toBeVisible();
  await page.getByRole('button', { name: 'Marker setzen' }).click();
  await page.getByRole('button', { name: 'Bestätigen' }).click();
  await expect(page.getByRole('dialog', { name: 'Marker setzen' })).toBeVisible();
  await page.getByLabel('Name').fill('Alter Fichtenhang');
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByRole('dialog', { name: 'Marker setzen' })).toBeHidden();
  expect(net.sent).toHaveLength(0);

  await page.getByRole('link', { name: 'Einträge' }).click();
  await expect(page).toHaveURL(/eintraege/);
  await page.getByRole('tab', { name: 'Marker', exact: true }).click();
  await expect(page.getByRole('img', { name: 'Übertragung ausstehend' })).toBeVisible();

  await net.join();

  await expect.poll(() => net.sent.length).toBeGreaterThan(0);
  expect(net.sent[0].method()).toBe('PUT');
});
