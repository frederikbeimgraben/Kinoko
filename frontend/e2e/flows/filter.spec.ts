import { expect, test } from '../fixtures/test';
import { mockApi } from '../fixtures/api';
import { bundle } from '../fixtures/species';

/** Zwei Arten, die sich nur in der Farbe von Hut und Stiel unterscheiden. */
const CATALOGUE = bundle([
  {
    slug: 'boletus-edulis',
    name: 'Steinpilz',
    latin: 'Boletus edulis',
    edibility: 'edible',
    cap: ['#6b4423'],
    stem: ['#e8d9b5'],
  },
  {
    slug: 'russula-emetica',
    name: 'Speitäubling',
    latin: 'Russula emetica',
    edibility: 'poisonous',
    cap: ['#b8322a'],
    stem: ['#f3efe6'],
  },
]);

test('Filter mit Farbe je Teil', async ({ page }) => {
  await mockApi(page, { '/api/species/bundle': CATALOGUE });
  await page.goto('/arten');
  await expect(page.getByText('Speitäubling')).toBeVisible();

  await page.getByRole('button', { name: 'Filter', exact: true }).click();

  await page.getByRole('dialog').getByRole('radio', { name: 'Braun', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Stiel' }).click();
  await page.getByRole('dialog').getByRole('radio', { name: 'Creme', exact: true }).click();

  await page.getByRole('button', { name: /Arten anzeigen/ }).click();

  await expect(page.getByText('Steinpilz')).toBeVisible();
  await expect(page.getByText('Speitäubling')).toHaveCount(0);
  await expect(page.getByText('Farbe · 2 Teile', { exact: true })).toBeVisible();
});

test('Marke entfernt die Farbe wieder', async ({ page }) => {
  await mockApi(page, { '/api/species/bundle': CATALOGUE });
  await page.goto('/arten');
  await page.getByRole('button', { name: 'Filter', exact: true }).click();
  await page.getByRole('dialog').getByRole('radio', { name: 'Braun', exact: true }).click();
  await page.getByRole('button', { name: /Arten anzeigen/ }).click();
  await expect(page.getByText('Speitäubling')).toHaveCount(0);

  await page.getByRole('button', { name: /^Farbe/ }).click();
  await page.getByRole('dialog').getByRole('radio', { name: 'Braun', exact: true }).click();
  await page.getByRole('button', { name: /Arten anzeigen/ }).click();

  await expect(page.getByText('Speitäubling')).toBeVisible();
});
