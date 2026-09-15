import { expect, test, type Page } from '@playwright/test';
import { mockApi } from '../fixtures/api';
import { authConfig, mockSignIn } from '../fixtures/auth';
import { flatMap } from '../fixtures/flat-map';
import { bundle, species } from '../fixtures/species';
import { expectBoard, skipPending } from './board';

const BASE = `http://127.0.0.1:${process.env['E2E_PORT'] ?? '4400'}`;

/** Die Rechte, die jeden Punkt der Verwaltung zeigen. */
const EVERY_RIGHT = [
  'text.edit',
  'image.review',
  'species.edit',
  'role.manage',
  'role.assign',
  'find.review',
  'run.manage',
];

/** Die Zähler des Bretts `Admin`. */
const SUMMARY = {
  texts: 1284,
  photos: 312,
  photosPending: 4,
  species: 306,
  roles: 4,
  permissions: 12,
  people: 7,
  finds: 382,
  findsPending: 14,
  runs: 4,
  runsRunning: 1,
};

const NOW = '2026-09-12T10:00:00+02:00';

/** Eine Rolle, so wie `/api/roles` sie liefert. */
function role(
  slug: string,
  name: string,
  description: string,
  peopleCount: number,
  builtIn = false,
): Record<string, unknown> {
  return {
    id: `rolle-${slug}`,
    slug,
    name,
    description,
    builtIn,
    permissions: [],
    peopleCount,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

/** Die vier Rollen des Bretts `Roles`. */
const ROLES = {
  items: [
    role('admin', 'Admin', 'Alle Rechte', 1, true),
    role('user', 'Nutzer', 'Hat jeder · lesen, eigene Einträge', 0, true),
    role('advisor', 'Pilzberater', 'Arten und Bilder pflegen', 3),
    role('translator', 'Übersetzer', 'Texte ändern', 2),
  ],
  nextCursor: null,
};

/** Die vier Arten des Bretts `AdminSpecies` mit ihren Zahlen. */
const SPECIES = [
  { slug: 'boletus-edulis', name: 'Steinpilz', latin: 'Boletus edulis', edibility: 'good', forecast: true },
  {
    slug: 'imleria-badia',
    name: 'Maronenröhrling',
    latin: 'Imleria badia',
    edibility: 'good',
    forecast: true,
  },
  {
    slug: 'tylopilus-felleus',
    name: 'Gallenröhrling',
    latin: 'Tylopilus felleus',
    edibility: 'inedible',
    forecast: true,
  },
  {
    slug: 'tricholoma-terreum',
    name: 'Erdritterling',
    latin: 'Tricholoma terreum',
    edibility: 'edible',
    forecast: false,
  },
];

const SPECIES_COUNTS = {
  items: [
    { speciesId: (species(SPECIES[0], 0) as { id: string }).id, records: 1284, finds: 12, photos: 3 },
    { speciesId: (species(SPECIES[1], 1) as { id: string }).id, records: 842, finds: 7, photos: 2 },
    { speciesId: (species(SPECIES[2], 2) as { id: string }).id, records: 214, finds: 3, photos: 1 },
    { speciesId: (species(SPECIES[3], 3) as { id: string }).id, records: 58, finds: 0, photos: 0 },
  ],
};

/** Ein Brett gehört zu einem Gerät und läuft nicht, solange es aussteht. */
function guard(board: string, device: 'phone' | 'desktop'): void {
  test.skip(test.info().project.name !== device, `Brett gehört zu ${device}`);
  skipPending(board);
}

/** Meldet an und öffnet einen Weg der Verwaltung. */
async function open(page: Page, path: string): Promise<void> {
  await mockSignIn(page);
  await mockApi(page, {
    '/api/config': authConfig(BASE),
    '/api/me/permissions': { permissions: EVERY_RIGHT, roles: [] },
    '/api/admin/summary': SUMMARY,
    '/api/roles': ROLES,
    '/api/species/bundle': bundle(SPECIES),
    '/api/admin/species-counts': SPECIES_COUNTS,
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
