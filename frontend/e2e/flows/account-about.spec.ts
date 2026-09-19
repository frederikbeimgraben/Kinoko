import { expect, test } from '../fixtures/test';
import { type Page } from '@playwright/test';
import { mockApi } from '../fixtures/api';
import { authConfig, mockSignIn } from '../fixtures/auth';

const BASE = `http://127.0.0.1:${process.env['E2E_PORT'] ?? '4400'}`;

/** Meldet an und legt den Vertrag auf die Seite. */
async function start(page: Page, path: string): Promise<void> {
  await mockSignIn(page);
  await mockApi(page, { '/api/config': authConfig(BASE) });
  await page.goto(path);
}

test('Methode und Quellen und Lizenzen zeigen ihre Absätze', async ({ page }) => {
  await start(page, '/konto');

  await page.getByText('Methode').click();
  await expect(page).toHaveURL(/\/konto\/methode$/);
  await expect(page.getByText('Was die Karte zeigt')).toBeVisible();

  await page.getByRole('button', { name: 'Zurück' }).click();
  await page.getByText('Quellen und Lizenzen').click();
  await expect(page).toHaveURL(/\/konto\/lizenzen$/);
  await expect(page.getByText('OpenStreetMap')).toBeVisible();
});
