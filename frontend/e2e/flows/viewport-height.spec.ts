import { expect, test } from '../fixtures/test';
import { type Page } from '@playwright/test';
import { mockApi } from '../fixtures/api';
import { authConfig, mockSignIn } from '../fixtures/auth';
import { flatMap } from '../fixtures/flat-map';
import { bundle, SEVEN } from '../fixtures/species';
import { lookalikesBundle, profileBundle, profileManifest, profilePhotos } from '../fixtures/species-page';
import { CHANTERELLE_SPECIES, ROW_PHOTO, SPECIES_PHOTOS, STONE_SPECIES, photoPage } from '../fixtures/photos';
import {
  ADMIN_SPECIES,
  CATALOGUE,
  EMPTY_LIST,
  EMPTY_SUMMARY,
  EMPTY_TEXTS,
  EVERY_RIGHT,
  PEOPLE,
  ROLES,
  SUMMARY,
  TEXTS,
} from '../fixtures/admin';
import { TAXON } from '../fixtures/species-boards';
import { RUNS, RUN_DETAIL } from '../fixtures/runs';
import { PALETTE, PART_SECTIONS, STONE_SECTIONS, TERMS } from '../fixtures/species-sections';
import { STONE_EDIT, STONE_EDIT_COUNTS } from '../fixtures/species-editor';

const BASE = `http://127.0.0.1:${process.env['E2E_PORT'] ?? '4400'}`;
const EMPTY_BUNDLE = { items: [], standardColours: [], facets: {} };
const EMPTY_FINDS = { items: [], nextCursor: null };

/**
 * Am Telefon füllt die Hülle den Bildschirm. Trägt die Seite eine
 * Reiterleiste, steht sie ganz im Fenster. Nur der Inhalt scrollt, nicht die
 * Seite selbst.
 */
async function assertFillsViewport(page: Page): Promise<void> {
  const viewport = page.viewportSize();
  const bar = page.getByRole('navigation');
  if ((await bar.count()) > 0) {
    const box = await bar.boundingBox();
    expect(box).not.toBeNull();
    if (box !== null && viewport !== null) {
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
    }
  }
  const sizes = await page.evaluate(() => ({
    scrollHeight: document.scrollingElement?.scrollHeight ?? 0,
    innerHeight: window.innerHeight,
  }));
  expect(sizes.scrollHeight).toBeLessThanOrEqual(sizes.innerHeight);
}

async function open(page: Page, path: string, extra: Record<string, unknown> = {}): Promise<void> {
  await mockApi(page, extra, { photo: ROW_PHOTO });
  await flatMap(page);
  await page.goto(path);
}

test.describe('Seitenhöhe am Telefon', () => {
  test('Karte', async ({ page }) => {
    await open(page, '/karte');
    await assertFillsViewport(page);
  });

  test('Arten, Katalog leer', async ({ page }) => {
    await open(page, '/arten', { '/api/species/bundle': EMPTY_BUNDLE });
    await expect(page.getByRole('heading', { name: 'Arten' })).toBeVisible();
    await assertFillsViewport(page);
  });

  test('Arten, Katalog gefüllt', async ({ page }) => {
    await open(page, '/arten', { '/api/species/bundle': bundle(SEVEN) });
    await expect(page.getByText('Speisemorchel')).toBeVisible();
    await assertFillsViewport(page);
  });

  test('Arten, Filter offen', async ({ page }) => {
    await open(page, '/arten', { '/api/species/bundle': bundle(SEVEN) });
    await page.getByRole('button', { name: 'Filter', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await assertFillsViewport(page);
  });

  test('Artseite', async ({ page }) => {
    await mockApi(
      page,
      { '/api/species/bundle': profileBundle(), '/api/photos': profilePhotos() },
      { photo: { full: 'photo-358x269.png', list: 'photo-88x88.png' } },
    );
    await flatMap(page);
    await page.route('**/boletus-edulis.json', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(profileManifest()),
      });
    });
    await page.goto('/arten/boletus-edulis');
    await expect(page.getByRole('heading', { name: 'Steinpilz' })).toBeVisible();
    await assertFillsViewport(page);
  });

  test('Artseite, Verwechslungen', async ({ page }) => {
    await open(page, '/arten/boletus-edulis', {
      '/api/species/bundle': lookalikesBundle(),
      '/api/photos': EMPTY_FINDS,
    });
    await expect(page.getByText('Gallenröhrling')).toBeVisible();
    await assertFillsViewport(page);
  });

  test('Artseite, nicht gefunden', async ({ page }) => {
    await open(page, '/arten/gibt-es-nicht', { '/api/species/bundle': bundle(SEVEN) });
    await expect(page.getByText('Art nicht gefunden')).toBeVisible();
    await assertFillsViewport(page);
  });

  test('Vergleich', async ({ page }) => {
    await open(page, '/arten/vergleich', { '/api/species/bundle': bundle(SEVEN) });
    await expect(page.locator('app-page-header')).toBeVisible();
    await assertFillsViewport(page);
  });

  test('Taxonomie', async ({ page }) => {
    await open(page, '/taxonomie/family/boletaceae', {
      '/api/species/bundle': bundle(TAXON.catalogue),
      '/api/taxa/family/boletaceae': TAXON.page,
    });
    await expect(page.getByText('Rotfußröhrling')).toBeVisible();
    await assertFillsViewport(page);
  });

  test('Einträge, abgemeldet leer', async ({ page }) => {
    await open(page, '/eintraege');
    await expect(page.getByRole('heading', { name: 'Einträge' })).toBeVisible();
    await assertFillsViewport(page);
  });

  test('Einträge, angemeldet leer', async ({ page }) => {
    await mockSignIn(page);
    await open(page, '/eintraege', {
      '/api/config': authConfig(BASE),
      '/api/finds': EMPTY_FINDS,
      '/api/markers': EMPTY_FINDS,
      '/api/zones': EMPTY_FINDS,
    });
    await expect(page.getByRole('heading', { name: 'Einträge' })).toBeVisible();
    await assertFillsViewport(page);
  });

  test('Einträge, angemeldet gefüllt', async ({ page }) => {
    await mockSignIn(page);
    await open(page, '/eintraege', {
      '/api/config': authConfig(BASE),
      '/api/finds': {
        items: Array.from({ length: 8 }, (_, at) => ({
          id: `fund-${String(at)}`,
          speciesId: STONE_SPECIES.slug,
          lat: 48.5,
          lon: 9.05,
          foundOn: '2026-09-01',
          amount: null,
          note: null,
          visibility: 'private',
          objectId: null,
          updatedAt: '2026-09-01T08:00:00Z',
          deleted: false,
        })),
        nextCursor: null,
      },
      '/api/markers': EMPTY_FINDS,
      '/api/zones': EMPTY_FINDS,
      '/api/species/bundle': bundle([STONE_SPECIES, CHANTERELLE_SPECIES]),
    });
    await expect(page.getByRole('heading', { name: 'Einträge' })).toBeVisible();
    await assertFillsViewport(page);
  });

  test('Einträge, Filter offen', async ({ page }) => {
    await open(page, '/eintraege');
    await page.getByRole('button', { name: 'Filter', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await assertFillsViewport(page);
  });

  test('Konto, abgemeldet', async ({ page }) => {
    await open(page, '/konto');
    await expect(page.getByRole('heading', { name: 'Einstellungen', level: 1 })).toBeVisible();
    await assertFillsViewport(page);
  });

  test('Konto, angemeldet', async ({ page }) => {
    await mockSignIn(page);
    await open(page, '/konto', { '/api/config': authConfig(BASE) });
    await expect(page.getByRole('heading', { name: 'Einstellungen', level: 1 })).toBeVisible();
    await assertFillsViewport(page);
  });

  test('Konto, meine Bilder', async ({ page }) => {
    await mockSignIn(page);
    await open(page, '/konto/bilder', {
      '/api/config': authConfig(BASE),
      '/api/photos': photoPage(SPECIES_PHOTOS),
    });
    await expect(page.getByRole('heading', { name: 'Meine Bilder' })).toBeVisible();
    await assertFillsViewport(page);
  });

  test('Bild hinzufügen', async ({ page }) => {
    await mockSignIn(page);
    await open(page, '/arten/boletus-edulis/bilder/neu', {
      '/api/config': authConfig(BASE),
      '/api/species/bundle': bundle([STONE_SPECIES]),
      '/api/photos': photoPage(SPECIES_PHOTOS),
      '/api/me/permissions': { permissions: ['image.review'], roles: [] },
    });
    await expect(page.getByRole('heading', { name: 'Bild hinzufügen' })).toBeVisible();
    await assertFillsViewport(page);
  });

  test('Bild ansehen', async ({ page }) => {
    await mockSignIn(page);
    await open(page, '/arten/boletus-edulis/bilder/bild-zwei', {
      '/api/config': authConfig(BASE),
      '/api/species/bundle': bundle([STONE_SPECIES]),
      '/api/photos': photoPage(SPECIES_PHOTOS),
      '/api/me/permissions': { permissions: ['image.review'], roles: [] },
    });
    await expect(page.getByText('CC BY-SA 4.0')).toBeVisible();
    await assertFillsViewport(page);
  });

  async function admin(page: Page, path: string, extra: Record<string, unknown> = {}): Promise<void> {
    await mockSignIn(page);
    await open(page, path, {
      '/api/config': authConfig(BASE),
      '/api/me/permissions': { permissions: EVERY_RIGHT, roles: [] },
      '/api/admin/summary': SUMMARY,
      '/api/roles': ROLES,
      '/api/species/bundle': bundle(ADMIN_SPECIES),
      '/api/admin/species-counts': EMPTY_LIST,
      '/api/people': PEOPLE,
      '/api/permissions': { items: CATALOGUE },
      '/api/texts': TEXTS,
      ...extra,
    });
  }

  test('Verwaltung, Übersicht', async ({ page }) => {
    await admin(page, '/verwaltung');
    await expect(page.getByText('1 284')).toBeVisible();
    await assertFillsViewport(page);
  });

  test('Verwaltung, Übersicht leer', async ({ page }) => {
    await admin(page, '/verwaltung', { '/api/admin/summary': EMPTY_SUMMARY, '/api/roles': EMPTY_LIST });
    await assertFillsViewport(page);
  });

  test('Verwaltung, Rollen', async ({ page }) => {
    await admin(page, '/verwaltung/rollen');
    await expect(page.getByText('Arten und Bilder pflegen · 3 Personen')).toBeVisible();
    await assertFillsViewport(page);
  });

  test('Verwaltung, Rolle', async ({ page }) => {
    await admin(page, '/verwaltung/rollen/rolle-advisor');
    await assertFillsViewport(page);
  });

  test('Verwaltung, Bilder', async ({ page }) => {
    await admin(page, '/verwaltung/bilder', { '/api/photos': EMPTY_LIST });
    await assertFillsViewport(page);
  });

  test('Verwaltung, Personen', async ({ page }) => {
    await admin(page, '/verwaltung/personen');
    await expect(page.getByText('frederik@beimgraben.net')).toBeVisible();
    await assertFillsViewport(page);
  });

  test('Verwaltung, Personen leer', async ({ page }) => {
    await admin(page, '/verwaltung/personen', { '/api/people': EMPTY_LIST });
    await assertFillsViewport(page);
  });

  test('Verwaltung, Arten', async ({ page }) => {
    await admin(page, '/verwaltung/arten');
    await expect(page.getByText('Tricholoma terreum')).toBeVisible();
    await assertFillsViewport(page);
  });

  test('Verwaltung, Texte', async ({ page }) => {
    await admin(page, '/verwaltung/texte');
    await expect(page.getByText('karte.legende')).toBeVisible();
    await assertFillsViewport(page);
  });

  test('Verwaltung, Texte leer', async ({ page }) => {
    await admin(page, '/verwaltung/texte', { '/api/texts': EMPTY_TEXTS });
    await assertFillsViewport(page);
  });

  test('Verwaltung, Art anlegen', async ({ page }) => {
    await admin(page, '/verwaltung/arten/neu');
    await expect(page.getByRole('heading', { name: 'Art anlegen' })).toBeVisible();
    await assertFillsViewport(page);
  });

  test('Verwaltung, Teil einer Art', async ({ page }) => {
    await admin(page, '/verwaltung/arten/boletus-edulis/teil/cap', {
      '/api/species/boletus-edulis': PART_SECTIONS,
      '/api/species/boletus-edulis/counts': { records: 1, finds: 0, photos: 0 },
    });
    await expect(page.getByText('Breite')).toBeVisible();
    await assertFillsViewport(page);
  });

  test('Verwaltung, Farbe einer Art', async ({ page }) => {
    await admin(page, '/verwaltung/arten/boletus-edulis/farbe/cap/0', {
      '/api/species/boletus-edulis': STONE_SECTIONS,
      '/api/species/boletus-edulis/counts': { records: 1, finds: 0, photos: 0 },
      '/api/species/bundle': { items: [], standardColours: PALETTE, facets: {} },
    });
    await expect(page.getByText('#7A3B6A').first()).toBeVisible();
    await assertFillsViewport(page);
  });

  test('Verwaltung, Verfärbung einer Art', async ({ page }) => {
    await admin(page, '/verwaltung/arten/boletus-edulis/verfaerbung/cap/0', {
      '/api/species/boletus-edulis': STONE_SECTIONS,
      '/api/species/boletus-edulis/counts': { records: 1, finds: 0, photos: 0 },
      '/api/terms': TERMS,
    });
    await expect(page.getByRole('button', { name: 'Verletzung' })).toBeVisible();
    await assertFillsViewport(page);
  });

  test('Verwaltung, Verwechslung einer Art', async ({ page }) => {
    await admin(page, '/verwaltung/arten/boletus-edulis/verwechslung/0', {
      '/api/species/boletus-edulis': STONE_SECTIONS,
      '/api/species/boletus-edulis/counts': { records: 1, finds: 0, photos: 0 },
    });
    await expect(page.getByRole('heading', { name: 'Verwechslung' })).toBeVisible();
    await assertFillsViewport(page);
  });

  test('Verwaltung, Läufe', async ({ page }) => {
    await admin(page, '/verwaltung/laeufe', { '/api/pipeline-runs': RUNS });
    await expect(page.getByText('Training Steinpilz')).toBeVisible();
    await assertFillsViewport(page);
  });

  test('Verwaltung, Lauf', async ({ page }) => {
    await admin(page, '/verwaltung/laeufe/lauf-training', {
      '/api/pipeline-runs/lauf-training': RUN_DETAIL,
    });
    await expect(page.getByText('Karten rendern')).toBeVisible();
    await assertFillsViewport(page);
  });

  test('Verwaltung, Maß einer Art', async ({ page }) => {
    await admin(page, '/verwaltung/arten/boletus-edulis/mass/cap', {
      '/api/species/boletus-edulis': STONE_SECTIONS,
      '/api/species/boletus-edulis/counts': { records: 1, finds: 0, photos: 0 },
    });
    await expect(page.getByRole('heading', { name: 'Hutbreite' })).toBeVisible();
    await assertFillsViewport(page);
  });

  test('Verwaltung, Zeitraum einer Art', async ({ page }) => {
    await admin(page, '/verwaltung/arten/boletus-edulis/zeitraum', {
      '/api/species/boletus-edulis': STONE_SECTIONS,
      '/api/species/boletus-edulis/counts': { records: 1, finds: 0, photos: 0 },
    });
    await expect(page.getByText('Oktober')).toBeVisible();
    await assertFillsViewport(page);
  });

  test('Verwaltung, Fruchtschicht einer Art', async ({ page }) => {
    await admin(page, '/verwaltung/arten/boletus-edulis/fruchtschicht', {
      '/api/species/boletus-edulis': STONE_SECTIONS,
      '/api/species/boletus-edulis/counts': { records: 1, finds: 0, photos: 0 },
    });
    await expect(page.getByText('herablaufend')).toBeVisible();
    await assertFillsViewport(page);
  });

  test('Verwaltung, Geruch einer Art', async ({ page }) => {
    await admin(page, '/verwaltung/arten/boletus-edulis/sinne/geruch', {
      '/api/species/boletus-edulis': STONE_SECTIONS,
      '/api/species/boletus-edulis/counts': { records: 1, finds: 0, photos: 0 },
      '/api/terms': TERMS,
    });
    await expect(page.getByRole('button', { name: 'mehlig' })).toBeVisible();
    await assertFillsViewport(page);
  });

  test('Verwaltung, Art bearbeiten', async ({ page }) => {
    await admin(page, '/verwaltung/arten/boletus-edulis', {
      '/api/species/boletus-edulis': STONE_EDIT,
      '/api/species/boletus-edulis/counts': STONE_EDIT_COUNTS,
    });
    await expect(page.getByText('Röhren rosa, Netz grob, bitter')).toBeVisible();
    await assertFillsViewport(page);
  });
});
