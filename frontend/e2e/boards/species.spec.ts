import { expect, test, type Page } from '@playwright/test';
import { mockApi } from '../fixtures/api';
import { authConfig, mockSignIn } from '../fixtures/auth';
import { flatMap } from '../fixtures/flat-map';
import { presetFilter } from '../fixtures/filter-state';
import { bundle, SEVEN, STONE } from '../fixtures/species';
import { CORE_CHOICE, SIZE_CHOICE, largeBundle } from '../fixtures/species-catalogue';
import {
  DESKTOP_SPECIES,
  FILTER_DESKTOP,
  RESULT_HITS,
  RESULT_REST,
  RESULT_UNKNOWN,
  TAXON,
} from '../fixtures/species-boards';
import { expectBoard, skipPending } from './board';

const BASE = `http://127.0.0.1:${process.env['E2E_PORT'] ?? '4400'}`;

/** Was die angemeldete App nebenher holt. Ohne Antwort meldet sie einen Fehler. */
const EMPTY_PAGE = { eintraege: [], gesamt: 0 };
const EMPTY_FINDS = { items: [], nextCursor: null };
const SIGNED_IN: Record<string, unknown> = {
  '/api/combinations': { eintraege: [], gesamt: 0 },
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

/** Öffnet den Reiter Arten mit einem Katalog. */
async function openList(page: Page, items: unknown, extra: Record<string, unknown> = {}): Promise<void> {
  await mockApi(page, { '/api/species/bundle': items, ...extra });
  await flatMap(page);
  await page.goto('/arten');
}

/** Wartet, bis eine Art in der Liste steht. */
async function seen(page: Page, name: string): Promise<void> {
  await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
}

/** Öffnet das Filterblatt und darin eine Gruppe. */
async function openGroup(page: Page, group: string): Promise<void> {
  await page.getByRole('button', { name: 'Filter', exact: true }).click();
  await page.getByRole('button', { name: group }).first().click();
}

test('Species', async ({ page }) => {
  guard('Species', 'phone');
  await openList(page, bundle(SEVEN));
  await seen(page, 'Speisemorchel');
  await expectBoard(page, 'Species');
});

test('SpeciesSearch', async ({ page }) => {
  guard('SpeciesSearch', 'phone');
  await openList(page, bundle(STONE));
  await seen(page, 'Kiefernsteinpilz');
  await page.getByRole('textbox').fill('stein');
  await page.getByRole('textbox').blur();
  await expectBoard(page, 'SpeciesSearch');
});

test('SpeciesEmpty', async ({ page }) => {
  guard('SpeciesEmpty', 'phone');
  await presetFilter(page, {
    values: { edibility: ['edible'], capShape: ['convex'] },
    colours: { cap: '#6b4423' },
    sizes: {},
    keepUnknown: [],
  });
  await openList(page, bundle(STONE));
  await expect(page.getByText('Keine Art passt zu dieser Auswahl')).toBeVisible();
  await expectBoard(page, 'SpeciesEmpty');
});

test('SpeciesSkeleton', async ({ page }) => {
  guard('SpeciesSkeleton', 'phone');
  await mockApi(page);
  await flatMap(page);
  await page.route('**/api/species/bundle', () => {
    // Der Katalog bleibt aus: das Brett zeigt den Ladezustand.
  });
  await page.goto('/arten');
  await page.waitForTimeout(700);
  await expectBoard(page, 'SpeciesSkeleton', { idle: false });
});

test('SpeciesError', async ({ page }) => {
  guard('SpeciesError', 'phone');
  await mockApi(page);
  await flatMap(page);
  await page.route('**/api/species/bundle', (route) => route.abort());
  await page.goto('/arten');
  await expect(page.getByText('Laden fehlgeschlagen')).toBeVisible();
  await expectBoard(page, 'SpeciesError');
});

test('SpeciesFilter', async ({ page }) => {
  guard('SpeciesFilter', 'phone');
  await presetFilter(page, CORE_CHOICE);
  await openList(page, largeBundle());
  await page.getByRole('button', { name: 'Filter', exact: true }).click();
  await expect(page.getByRole('button', { name: /Arten anzeigen/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Vorhersage/ })).toBeVisible();
  await expectBoard(page, 'SpeciesFilter');
});

test('FilterEdibility', async ({ page }) => {
  guard('FilterEdibility', 'phone');
  await presetFilter(page, CORE_CHOICE);
  await openList(page, largeBundle());
  await openGroup(page, 'Speisewert');
  await expect(page.getByRole('checkbox', { name: /bedingt essbar/ })).toBeVisible();
  await expectBoard(page, 'FilterEdibility');
});

test('FilterCapShape', async ({ page }) => {
  guard('FilterCapShape', 'phone');
  await presetFilter(page, CORE_CHOICE);
  await openList(page, largeBundle());
  await openGroup(page, 'Hutform');
  await expect(page.getByRole('checkbox', { name: /halbkugelig/ })).toBeVisible();
  await expectBoard(page, 'FilterCapShape');
});

test('FilterColour', async ({ page }) => {
  guard('FilterColour', 'phone');
  await presetFilter(page, CORE_CHOICE);
  await openList(page, largeBundle());
  await openGroup(page, 'Farbe');
  await expect(page.getByRole('radio', { name: 'Dunkelbraun', exact: true })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Grau', exact: true })).toBeVisible();
  await expectBoard(page, 'FilterColour');
});

test('FilterSize', async ({ page }) => {
  guard('FilterSize', 'phone');
  await presetFilter(page, SIZE_CHOICE);
  await openList(page, largeBundle());
  await openGroup(page, 'Maße und Zeit');
  await expect(page.getByRole('group', { name: 'Wachstumszeit' })).toBeVisible();
  await expectBoard(page, 'FilterSize');
});

test('FilterResult', async ({ page }) => {
  guard('FilterResult', 'phone');
  await presetFilter(page, {
    values: { edibility: ['edible'], capShape: ['convex'], treePartner: ['picea-abies'] },
    colours: {},
    sizes: {},
    keepUnknown: [],
  });
  await openList(page, bundle([...RESULT_HITS, ...RESULT_UNKNOWN, ...RESULT_REST]));
  await seen(page, 'Perlpilz');
  await expectBoard(page, 'FilterResult');
});

test('Taxonomy', async ({ page }) => {
  guard('Taxonomy', 'phone');
  await mockApi(page, {
    '/api/species/bundle': bundle(TAXON.catalogue),
    '/api/taxa/family/boletaceae': TAXON.page,
  });
  await flatMap(page);
  await page.goto('/taxonomie/family/boletaceae');
  await seen(page, 'Rotfußröhrling');
  await expectBoard(page, 'Taxonomy');
});

test('SpeciesDesktop', async ({ page }) => {
  guard('SpeciesDesktop', 'desktop');
  await mockSignIn(page);
  await openList(page, bundle(DESKTOP_SPECIES), {
    '/api/config': authConfig(BASE),
    ...SIGNED_IN,
  });
  await seen(page, 'Perlpilz');
  await expectBoard(page, 'SpeciesDesktop');
});

test('FilterDesktop', async ({ page }) => {
  guard('FilterDesktop', 'desktop');
  await presetFilter(page, FILTER_DESKTOP.choice);
  await mockSignIn(page);
  await openList(page, bundle(FILTER_DESKTOP.catalogue), {
    '/api/config': authConfig(BASE),
    ...SIGNED_IN,
  });
  await seen(page, 'Wiesenchampignon');
  await expectBoard(page, 'FilterDesktop');
});
