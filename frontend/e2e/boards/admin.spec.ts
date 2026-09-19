import { expect, test, type Page } from '@playwright/test';
import {
  ADMIN_SPECIES,
  CATALOGUE,
  EVERY_RIGHT,
  PEOPLE,
  ROLES,
  SUMMARY,
  TEXTS,
  text,
} from '../fixtures/admin';
import { mockApi } from '../fixtures/api';
import { NOW, RUNS, RUN_DETAIL } from '../fixtures/runs';
import { authConfig, mockSignIn } from '../fixtures/auth';
import { flatMap } from '../fixtures/flat-map';
import { bundle, species } from '../fixtures/species';
import { STONE_EDIT, STONE_EDIT_COUNTS } from '../fixtures/species-editor';
import { PALETTE, PART_SECTIONS, STONE_SECTIONS, TERMS } from '../fixtures/species-sections';
import { expectBoard, skipPending } from './board';

const BASE = `http://127.0.0.1:${process.env['E2E_PORT'] ?? '4400'}`;

/** Die Zahlen der vier Arten des Bretts `AdminSpecies`. */
const SPECIES_COUNTS = {
  items: [
    { speciesId: (species(ADMIN_SPECIES[0], 0) as { id: string }).id, records: 1284, finds: 12, photos: 3 },
    { speciesId: (species(ADMIN_SPECIES[1], 1) as { id: string }).id, records: 842, finds: 7, photos: 2 },
    { speciesId: (species(ADMIN_SPECIES[2], 2) as { id: string }).id, records: 214, finds: 3, photos: 1 },
    { speciesId: (species(ADMIN_SPECIES[3], 3) as { id: string }).id, records: 58, finds: 0, photos: 0 },
  ],
};

/** Die Rollhöhe des Bretts `SpeciesEditScrolled`, aus seinem Bild gemessen. */
const EDITOR_SCROLL = 417;

/** Ein Brett gehört zu einem Gerät und läuft nicht, solange es aussteht. */
function guard(board: string, device: 'phone' | 'desktop'): void {
  test.skip(test.info().project.name !== device, `Brett gehört zu ${device}`);
  skipPending(board);
}

/** Meldet an und öffnet einen Weg der Verwaltung. */
async function open(page: Page, path: string, extra: Record<string, unknown> = {}): Promise<void> {
  await mockSignIn(page);
  await mockApi(page, {
    '/api/config': authConfig(BASE),
    '/api/me/permissions': { permissions: EVERY_RIGHT, roles: [] },
    '/api/admin/summary': SUMMARY,
    '/api/roles': ROLES,
    '/api/species/bundle': bundle(ADMIN_SPECIES),
    '/api/admin/species-counts': SPECIES_COUNTS,
    '/api/people': PEOPLE,
    '/api/permissions': { items: CATALOGUE },
    '/api/texts': TEXTS,
    ...extra,
  });
  await flatMap(page);
  await page.goto(path);
}

test('Admin', async ({ page }) => {
  guard('Admin', 'phone');
  await open(page, '/verwaltung');
  await expect(page.getByText('1 284')).toBeVisible();
  await expect(page.getByText('382 · 14')).toBeVisible();
  await expectBoard(page, 'Admin');
});

test('Roles', async ({ page }) => {
  guard('Roles', 'phone');
  await open(page, '/verwaltung/rollen');
  await expect(page.getByText('Arten und Bilder pflegen · 3 Personen')).toBeVisible();
  await expectBoard(page, 'Roles');
});

test('AdminDesktop', async ({ page }) => {
  guard('AdminDesktop', 'desktop');
  await open(page, '/verwaltung/rollen');
  await expect(page.getByText('4 · 12')).toBeVisible();
  await expect(page.getByText('Texte ändern · 2 Personen')).toBeVisible();
  await expectBoard(page, 'AdminDesktop');
});

test('AdminSpecies', async ({ page }) => {
  guard('AdminSpecies', 'phone');
  await open(page, '/verwaltung/arten');
  await expect(page.getByText('1 284')).toBeVisible();
  await expect(page.getByText('Tricholoma terreum')).toBeVisible();
  await expectBoard(page, 'AdminSpecies');
});

test('People', async ({ page }) => {
  guard('People', 'phone');
  await open(page, '/verwaltung/personen');
  await expect(page.getByText('frederik@beimgraben.net')).toBeVisible();
  await expectBoard(page, 'People');
});

test('PersonRoles', async ({ page }) => {
  guard('PersonRoles', 'phone');
  await open(page, '/verwaltung/personen');
  await page.getByRole('button', { name: /Jonas/ }).click();
  await expect(page.getByRole('dialog', { name: 'Jonas' })).toBeVisible();
  await expectBoard(page, 'PersonRoles');
});

/** Das Brett `Role` zeigt die Rolle ohne Beschreibung. */
const PLAIN_ROLE = {
  items: [{ ...ROLES.items[2], description: null }],
  nextCursor: null,
};

test('Role', async ({ page }) => {
  guard('Role', 'phone');
  await open(page, '/verwaltung/rollen/rolle-advisor', { '/api/roles': PLAIN_ROLE });
  await expect(page.getByText('Bilder freigeben')).toBeVisible();
  await expectBoard(page, 'Role');
});

test('RoleDelete', async ({ page }) => {
  guard('RoleDelete', 'phone');
  await open(page, '/verwaltung/rollen/rolle-advisor', { '/api/roles': PLAIN_ROLE });
  await page.getByRole('button', { name: 'Rolle löschen' }).click();
  await expect(page.getByRole('dialog', { name: /Pilzberater/ })).toBeVisible();
  await expectBoard(page, 'RoleDelete');
});

test('PersonDelete', async ({ page }) => {
  guard('PersonDelete', 'phone');
  await open(page, '/verwaltung/personen');
  await page.getByRole('button', { name: /Testerin/ }).click();
  await page.getByRole('button', { name: 'Person löschen' }).click();
  await expect(page.getByText('Testerin löschen?')).toBeVisible();
  await expectBoard(page, 'PersonDelete');
});

test('Texts', async ({ page }) => {
  guard('Texts', 'phone');
  await open(page, '/verwaltung/texte');
  await expect(page.getByText('karte.legende')).toBeVisible();
  await expectBoard(page, 'Texts');
});

/** Die drei Schlüssel des Bretts `TextEdit`. */
const EDIT_TEXTS = {
  revision: 'e2e',
  locales: ['de', 'en'],
  entries: [
    text('art.zuWenigFunde', 'Zu wenig Funde für eine Vorhersage', 'Not enough finds for a forecast', true),
    text('karte.legende', 'Fundwahrscheinlichkeit je Begehung', 'Probability of a find per visit'),
    text('melden.freigabe', 'Für das Training freigeben', 'Share for training'),
  ],
};

test('TextEdit', async ({ page }) => {
  guard('TextEdit', 'phone');
  await open(page, '/verwaltung/texte', { '/api/texts': EDIT_TEXTS });
  await page.getByRole('button', { name: /art\.zuWenigFunde/ }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expectBoard(page, 'TextEdit');
});

test('SpeciesEdit', async ({ page }) => {
  guard('SpeciesEdit', 'phone');
  await open(page, '/verwaltung/arten/boletus-edulis', {
    '/api/species/boletus-edulis': STONE_EDIT,
    '/api/species/boletus-edulis/counts': STONE_EDIT_COUNTS,
  });
  await expect(page.getByText('Röhren rosa, Netz grob, bitter')).toBeVisible();
  await expectBoard(page, 'SpeciesEdit');
});

test('SpeciesEditScrolled', async ({ page }) => {
  guard('SpeciesEditScrolled', 'phone');
  await open(page, '/verwaltung/arten/boletus-edulis', {
    '/api/species/boletus-edulis': STONE_EDIT,
    '/api/species/boletus-edulis/counts': STONE_EDIT_COUNTS,
  });
  await expect(page.getByText('de.wikipedia.org/wiki/Gemeiner_Steinpilz')).toBeVisible();
  await page.locator('.editor').evaluate((one, top) => {
    one.scrollTo(0, top);
  }, EDITOR_SCROLL);
  await expectBoard(page, 'SpeciesEditScrolled');
});

test('PartPicker', async ({ page }) => {
  guard('PartPicker', 'phone');
  await open(page, '/verwaltung/arten/boletus-edulis', {
    '/api/species/boletus-edulis': STONE_EDIT,
    '/api/species/boletus-edulis/counts': STONE_EDIT_COUNTS,
  });
  await page.getByRole('button', { name: 'Teil hinzufügen' }).click();
  await expect(page.getByRole('dialog', { name: 'Teil hinzufügen' })).toBeVisible();
  await expectBoard(page, 'PartPicker');
});

test('EditSource', async ({ page }) => {
  guard('EditSource', 'phone');
  await open(page, '/verwaltung/arten/boletus-edulis/quelle/0', {
    '/api/species/boletus-edulis': STONE_EDIT,
    '/api/species/boletus-edulis/counts': STONE_EDIT_COUNTS,
  });
  await expect(page.getByLabel('Titel')).toHaveValue('123pilzsuche.de');
  await expectBoard(page, 'EditSource');
});

test('SpeciesDelete', async ({ page }) => {
  guard('SpeciesDelete', 'phone');
  await open(page, '/verwaltung/arten/boletus-edulis', {
    '/api/species/boletus-edulis': STONE_EDIT,
    '/api/species/boletus-edulis/counts': STONE_EDIT_COUNTS,
  });
  await page.getByRole('button', { name: 'Art löschen' }).click();
  await expect(page.getByText('12 Funde · Karte vorhanden')).toBeVisible();
  await expectBoard(page, 'SpeciesDelete');
});

test('SpeciesCreate', async ({ page }) => {
  guard('SpeciesCreate', 'phone');
  await open(page, '/verwaltung/arten/neu');
  await page.getByLabel('Name', { exact: true }).fill('Schopftintling');
  await page.getByLabel('Wissenschaftlicher Name').fill('Coprinus comatus');
  await page.getByLabel('Quelle').fill('123pilzsuche.de/daten/details/Schopftintling.htm');
  await page.getByRole('button', { name: 'Röhrling' }).click();
  await page.getByRole('button', { name: 'Tintling', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await page.evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur();
  });
  await expectBoard(page, 'SpeciesCreate');
});

test('Runs', async ({ page }) => {
  guard('Runs', 'phone');
  await page.clock.setFixedTime(new Date(NOW));
  await open(page, '/verwaltung/laeufe', { '/api/pipeline-runs': RUNS });
  await expect(page.getByText('Woche 3 von 12 · seit 22 Minuten')).toBeVisible();
  await expectBoard(page, 'Runs');
});

test('RunStart', async ({ page }) => {
  guard('RunStart', 'phone');
  await page.clock.setFixedTime(new Date(NOW));
  await open(page, '/verwaltung/laeufe', { '/api/pipeline-runs': RUNS });
  await page.getByRole('button', { name: 'Lauf anstoßen' }).click();
  await expect(page.getByRole('tab', { name: 'Rendern' })).toBeVisible();
  await expectBoard(page, 'RunStart');
});

test('Run', async ({ page }) => {
  guard('Run', 'phone');
  await open(page, '/verwaltung/laeufe/lauf-training', {
    '/api/pipeline-runs/lauf-training': RUN_DETAIL,
  });
  await expect(page.getByText('Brier 0,061 · besser')).toBeVisible();
  await expectBoard(page, 'Run');
});

test('EditSize', async ({ page }) => {
  guard('EditSize', 'phone');
  await open(page, '/verwaltung/arten/boletus-edulis/mass/cap', {
    '/api/species/boletus-edulis': STONE_SECTIONS,
    '/api/species/boletus-edulis/counts': STONE_EDIT_COUNTS,
  });
  await expect(page.getByRole('heading', { name: 'Hutbreite' })).toBeVisible();
  await expectBoard(page, 'EditSize');
});

test('EditSeason', async ({ page }) => {
  guard('EditSeason', 'phone');
  await open(page, '/verwaltung/arten/boletus-edulis/zeitraum', {
    '/api/species/boletus-edulis': STONE_SECTIONS,
    '/api/species/boletus-edulis/counts': STONE_EDIT_COUNTS,
  });
  await expect(page.getByText('Oktober')).toBeVisible();
  await expectBoard(page, 'EditSeason');
});

test('EditHymenium', async ({ page }) => {
  guard('EditHymenium', 'phone');
  await open(page, '/verwaltung/arten/boletus-edulis/fruchtschicht', {
    '/api/species/boletus-edulis': STONE_SECTIONS,
    '/api/species/boletus-edulis/counts': STONE_EDIT_COUNTS,
  });
  await expect(page.getByText('ausgebuchtet')).toBeVisible();
  await expectBoard(page, 'EditHymenium');
});

test('EditSenses', async ({ page }) => {
  guard('EditSenses', 'phone');
  await open(page, '/verwaltung/arten/boletus-edulis/sinne/geruch', {
    '/api/species/boletus-edulis': STONE_SECTIONS,
    '/api/species/boletus-edulis/counts': STONE_EDIT_COUNTS,
    '/api/terms': TERMS,
  });
  await expect(page.getByRole('button', { name: 'rettichartig' })).toBeVisible();
  await expectBoard(page, 'EditSenses');
});

test('EditColour', async ({ page }) => {
  guard('EditColour', 'phone');
  await open(page, '/verwaltung/arten/boletus-edulis/farbe/cap/0', {
    '/api/species/boletus-edulis': STONE_SECTIONS,
    '/api/species/boletus-edulis/counts': STONE_EDIT_COUNTS,
    '/api/species/bundle': { items: [], standardColours: PALETTE, facets: {} },
  });
  await expect(page.getByText('#7A3B6A').first()).toBeVisible();
  await expectBoard(page, 'EditColour');
});

test('EditColourChange', async ({ page }) => {
  guard('EditColourChange', 'phone');
  await open(page, '/verwaltung/arten/boletus-edulis/verfaerbung/cap/0', {
    '/api/species/boletus-edulis': STONE_SECTIONS,
    '/api/species/boletus-edulis/counts': STONE_EDIT_COUNTS,
    '/api/terms': TERMS,
  });
  await expect(page.getByRole('button', { name: 'Verletzung' })).toBeVisible();
  await expectBoard(page, 'EditColourChange');
});

test('EditLookalike', async ({ page }) => {
  guard('EditLookalike', 'phone');
  await open(page, '/verwaltung/arten/boletus-edulis/verwechslung/0', {
    '/api/species/boletus-edulis': STONE_EDIT,
    '/api/species/boletus-edulis/counts': STONE_EDIT_COUNTS,
  });
  await expect(page.getByLabel('Unterscheidung')).toHaveValue('Röhren rosa, Netz grob, bitter');
  await expectBoard(page, 'EditLookalike');
});

test('EditPart', async ({ page }) => {
  guard('EditPart', 'phone');
  await open(page, '/verwaltung/arten/boletus-edulis/teil/cap', {
    '/api/species/boletus-edulis': PART_SECTIONS,
    '/api/species/boletus-edulis/counts': STONE_EDIT_COUNTS,
  });
  await expect(page.getByText('Breite')).toBeVisible();
  await expectBoard(page, 'EditPart');
});
