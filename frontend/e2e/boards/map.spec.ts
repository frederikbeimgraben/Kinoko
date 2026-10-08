import { expect, test } from '../fixtures/test';
import { type Page } from '@playwright/test';
import { mockApi } from '../fixtures/api';
import { ROW_PHOTO } from '../fixtures/photos';
import { authConfig, mockSignIn, mockSignInPending, mockSignedOut } from '../fixtures/auth';
import {
  BOARD_FACTORS,
  COMBINATIONS,
  FICHTE_LAYERS_MANIFEST,
  MARKERS,
  SHARED_FINDS,
  SPECIES_BUNDLE,
  ZONES,
  mockMap,
  showDesignMap,
  type DesignMap,
  type BoardState,
} from '../fixtures/map';
import { expectBoard, skipPending } from './board';

const BASE = `http://127.0.0.1:${process.env['E2E_PORT'] ?? '4400'}`;

/** Die Drehung der Boards `MapRotated` und `MapDesktopRotated`. */
const BOARD_BEARING = 30;

/** Ein Board gehört zu einem Gerät und läuft nicht, solange es aussteht. */
function guard(board: string, device: 'phone' | 'wide'): void {
  test.skip(test.info().project.name !== device, `Board gehört zu ${device}`);
  skipPending(board);
}

/** Die Antworten des Vertrags, die die Karte braucht. */
const REPLIES = {
  '/api/species/bundle': SPECIES_BUNDLE,
  '/api/combinations': COMBINATIONS,
  '/api/markers': MARKERS,
  '/api/zones': ZONES,
  '/api/finds': SHARED_FINDS,
};

async function openMap(
  page: Page,
  state: BoardState = {},
  factors = '',
  layersManifest?: unknown,
): Promise<void> {
  await page.context().grantPermissions(['geolocation']);
  await mockSignIn(page);
  await mockApi(page, { ...REPLIES, '/api/config': authConfig(BASE) }, { photo: ROW_PHOTO });
  await mockMap(page, state, factors, layersManifest);
  await page.goto('/karte');
  await expect(page.getByRole('region', { name: 'Karte von Deutschland' })).toBeVisible();
}

/** The map surface ends 28 px below the top of the map sheet, as in the kit `.sheet`. */
const BELOW_SHEET: DesignMap = { belowSheet: 28 };

/** Puts the design map surface on the canvas and compares the page with the board. */
async function board(page: Page, stem: string, map: DesignMap = BELOW_SHEET): Promise<void> {
  await showDesignMap(page, map);
  await expectBoard(page, stem);
}

/** Dieselbe Karte, aber mit Konto: Speichern fragt dann nicht erst nach. */
async function openSignedIn(page: Page, factors = ''): Promise<void> {
  await openMap(page, { view: 'combination', detent: 2 }, factors);
  await expect(page.getByRole('button', { name: 'Speichern' })).toBeVisible();
}

/** Ein Board zeigt weder Fokusring noch Mauszustand. */
async function blur(page: Page): Promise<void> {
  await page.mouse.move(0, 0);
  await page.evaluate(() => {
    const active: Element | null = document.activeElement;
    if (active instanceof HTMLElement) active.blur();
  });
}

/** Speichern führt ohne Konto zuerst durch die Anmeldung. */
async function askForName(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Speichern' }).first().click();
  const signIn = page.getByRole('button', { name: /beimgraben\.net/ });
  if (await signIn.isVisible().catch(() => false)) {
    await signIn.click();
    await page.getByRole('button', { name: 'Speichern' }).first().click();
  }
}

test('Map', async ({ page }) => {
  guard('Map', 'phone');
  await openMap(page);
  await board(page, 'Map');
});

/** Dreht die Karte über den Testhaken, wie eine Geste es täte. */
async function turnMap(page: Page, bearing: number): Promise<void> {
  await page.waitForFunction(() => 'pilzMap' in window);
  await page.evaluate((angle) => {
    (window as unknown as { pilzMap: { rotate: (b: number, p: number) => void } }).pilzMap.rotate(angle, 0);
  }, bearing);
}

test('MapRotated', async ({ page }) => {
  guard('MapRotated', 'phone');
  await openMap(page);
  await turnMap(page, -BOARD_BEARING);
  await expect(page.getByRole('button', { name: 'Nach Norden drehen' })).toBeVisible();
  await showDesignMap(page, { rotated: true, belowSheet: 28 });
  await expectBoard(page, 'MapRotated');
});

test('MapDesktopRotated', async ({ page }) => {
  guard('MapDesktopRotated', 'wide');
  await openMap(page);
  await turnMap(page, -BOARD_BEARING);
  await expect(page.getByRole('button', { name: 'Nach Norden drehen' })).toBeVisible();
  await showDesignMap(page, { rotated: true });
  await expectBoard(page, 'MapDesktopRotated');
});

test('MapCollapsed', async ({ page }) => {
  guard('MapCollapsed', 'phone');
  await openMap(page, { detent: 0 });
});

test('MapLayers', async ({ page }) => {
  guard('MapLayers', 'phone');
  await openMap(page, { detent: 0, zones: false });
  await page.getByRole('button', { name: 'Ebenen' }).click();
  await board(page, 'MapLayers', {});
});

test('MapLayer', async ({ page }) => {
  guard('MapLayer', 'phone');
  await openMap(page, { view: 'layer' });
  await board(page, 'MapLayer', { heat: 'rain', belowSheet: 28 });
});

test('LayerTabCredit', async ({ page }) => {
  guard('LayerTabCredit', 'phone');
  await openMap(page, { view: 'layer', layer: 'fichte' }, '', FICHTE_LAYERS_MANIFEST);
});

test('MapCombination', async ({ page }) => {
  guard('MapCombination', 'phone');
  await openMap(page, { view: 'combination', detent: 2 }, BOARD_FACTORS);
  await board(page, 'MapCombination', { heat: 'rain', belowSheet: 28 });
});

test('MapFactor', async ({ page }) => {
  guard('MapFactor', 'phone');
  await openMap(page, { view: 'combination', detent: 2 }, BOARD_FACTORS);
  await page.getByRole('button', { name: '≥ 80 mm' }).click();
  await board(page, 'MapFactor', { heat: 'rain' });
});

test('MapSpecies', async ({ page }) => {
  guard('MapSpecies', 'phone');
  await openMap(page);
  await page.getByRole('button', { name: 'Steinpilz' }).click();
  await board(page, 'MapSpecies', {});
});

test('MapFactorPicker', async ({ page }) => {
  guard('MapFactorPicker', 'phone');
  await openMap(page, { view: 'combination', detent: 2 }, BOARD_FACTORS);
  await page.getByRole('button', { name: 'Faktor hinzufügen' }).click();
  await board(page, 'MapFactorPicker', { heat: 'rain' });
});

test('MapCombinationSave', async ({ page }) => {
  guard('MapCombinationSave', 'phone');
  await openSignedIn(page, BOARD_FACTORS);
  await askForName(page);
  await expect(page.getByText('Kombination speichern')).toBeVisible();
  await page.getByRole('textbox').fill('Herbst Steinpilz');
  await blur(page);
  await board(page, 'MapCombinationSave', { heat: 'rain' });
});

test('MapCombinations', async ({ page }) => {
  guard('MapCombinations', 'phone');
  await openSignedIn(page, BOARD_FACTORS);
  await page.getByRole('button', { name: /Gespeicherte Kombinationen/ }).click();
  await board(page, 'MapCombinations', { heat: 'rain' });
});

test('MapUpdate', async ({ page }) => {
  guard('MapUpdate', 'phone');
  await openMap(page);
  await page.evaluate(() => {
    navigator.serviceWorker.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'VERSION_READY', currentVersion: { hash: 'a' }, latestVersion: { hash: 'b' } },
      }),
    );
  });
  await expect(page.getByRole('status')).toContainText('Neue Version');
  await board(page, 'MapUpdate');
});

test('MapOffline', async ({ page }) => {
  guard('MapOffline', 'phone');
  await openMap(page);
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    window.dispatchEvent(new Event('offline'));
  });
  await expect(page.getByRole('status')).toContainText('Keine Verbindung');
  await board(page, 'MapOffline');
});

test('MapSignIn', async ({ page }) => {
  guard('MapSignIn', 'phone');
  await page.context().grantPermissions(['geolocation']);
  await mockSignedOut(page);
  await mockApi(page, { ...REPLIES, '/api/config': authConfig(BASE) }, { photo: ROW_PHOTO });
  await mockMap(page, { view: 'combination' }, BOARD_FACTORS);
  await page.goto('/karte');
  // Without an account, the save asks for the sign-in first.
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByRole('button', { name: 'Später', exact: true })).toBeVisible();
  // The board shows the question over the forecast. The tab changes below the modal layer.
  await page.evaluate(() => {
    const tab = [...document.querySelectorAll<HTMLElement>('[role="tab"]')].find(
      (one) => one.textContent.trim() === 'Vorhersage',
    );
    tab?.click();
  });
  await blur(page);
  await board(page, 'MapSignIn');
});

test('MapSkeleton', async ({ page }) => {
  guard('MapSkeleton', 'phone');
  // Ohne Antwort des SSO bleibt die Sitzung offen und der Avatar ein Skelett.
  await mockSignInPending(page);
  await mockApi(page, { ...REPLIES, '/api/config': authConfig(BASE) }, { photo: ROW_PHOTO });
  await mockMap(page);
  // Ohne Manifest zeigt die Karte ihr Raster; ein Kartenbild gehört nicht dazu.
  await page.route(/\/[a-z0-9_-]+\.json$/, async (route) => {
    await route.fulfill({ status: 404, body: '' });
  });
  await page.goto('/karte');
  await expectBoard(page, 'MapSkeleton', { idle: false });
});

test('MapDesktop', async ({ page }) => {
  guard('MapDesktop', 'wide');
  await openMap(page);
  await board(page, 'MapDesktop', {});
});

test('MapDesktopSpecies', async ({ page }) => {
  guard('MapDesktopSpecies', 'wide');
  await openMap(page);
  await page.getByRole('button', { name: 'Steinpilz' }).click();
  await board(page, 'MapDesktopSpecies', {});
});

test('MapDesktopLayers', async ({ page }) => {
  guard('MapDesktopLayers', 'wide');
  await openMap(page);
  await page.getByRole('button', { name: 'Ebenen' }).click();
  await board(page, 'MapDesktopLayers', {});
});

test('MapDesktopLayersCredit', async ({ page }) => {
  guard('MapDesktopLayersCredit', 'wide');
  await openMap(page, { layer: 'fichte' }, '', FICHTE_LAYERS_MANIFEST);
  await page.getByRole('button', { name: 'Ebenen' }).click();
});

test('MapDesktopFactorPicker', async ({ page }) => {
  guard('MapDesktopFactorPicker', 'wide');
  await openMap(page, { view: 'combination' }, BOARD_FACTORS);
  await page.getByRole('button', { name: 'Faktor hinzufügen' }).click();
  await board(page, 'MapDesktopFactorPicker', {});
});

test('MapDesktopCombinations', async ({ page }) => {
  guard('MapDesktopCombinations', 'wide');
  await openMap(page, { view: 'combination' }, BOARD_FACTORS);
  await page.getByRole('button', { name: /Gespeicherte Kombinationen/ }).click();
  await board(page, 'MapDesktopCombinations', {});
});

test('MapDesktopCombinationSave', async ({ page }) => {
  guard('MapDesktopCombinationSave', 'wide');
  await openMap(page, { view: 'combination' }, BOARD_FACTORS);
  await askForName(page);
  await expect(page.getByRole('heading', { name: 'Kombination speichern' })).toBeVisible();
  await page.getByRole('textbox').fill('Herbst Steinpilz');
  await blur(page);
  await board(page, 'MapDesktopCombinationSave', {});
});

test('MapDesktopFactor', async ({ page }) => {
  guard('MapDesktopFactor', 'wide');
  await openMap(page, { view: 'combination' }, BOARD_FACTORS);
  await page.getByRole('button', { name: '≥ 80 mm' }).click();
  await board(page, 'MapDesktopFactor', {});
});

test('MapDesktopTimelineEnd', async ({ page }) => {
  guard('MapDesktopTimelineEnd', 'wide');
  await openMap(page);
  await page.getByRole('button', { name: 'KW 41 · 2026 · Prognose' }).click();
  await page.waitForTimeout(400);
  await blur(page);
});
