import type { Page } from '@playwright/test';
import { ACCOUNT_EXPORT, seedOfflineAreas, seedPendingTransfer } from '../fixtures/account';
import { mockApi } from '../fixtures/api';
import { flatMap } from '../fixtures/flat-map';
import { PROVIDER, authConfig, mockSignIn, mockSignedOut } from '../fixtures/auth';
import { ME } from '../fixtures/groups';
import { ROW_PHOTO, photo, photoPage } from '../fixtures/photos';
import { SPECIES_BUNDLE } from '../fixtures/map';
import { expect, test } from '../fixtures/test';
import { expectBoard, skipPending } from './board';

const BASE = `http://127.0.0.1:${process.env['E2E_PORT'] ?? '4400'}`;

/** A board belongs to one device and does not run while it is pending. */
function guard(board: string, device: 'phone' | 'wide'): void {
  test.skip(test.info().project.name !== device, `board belongs to ${device}`);
  skipPending(board);
}

/** The own photos of the board `MyImages`. */
const MY_PHOTOS = photoPage([
  photo({
    id: 'image-one',
    speciesId: '',
    photographer: 'Frederik',
    licence: 'cc_by_4',
    createdAt: '2026-09-06T08:00:00Z',
  }),
  photo({
    id: 'image-two',
    speciesId: '',
    photographer: 'Frederik',
    licence: 'cc_by_4',
    state: 'submitted',
    createdAt: '2026-09-04T08:00:00Z',
  }),
  photo({
    id: 'image-three',
    speciesId: '',
    photographer: 'Frederik',
    licence: 'cc_by_4',
    state: 'rejected',
    createdAt: '2026-09-01T08:00:00Z',
  }),
]);

/** The zones of the board `AreaPicker`. */
const ZONES = {
  items: [
    ['zone-kirnbach', 'Kirnbachtal', 18],
    ['zone-bromberg', 'Bromberg Süd', 27],
  ].map(([id, name, areaHa]) => ({
    id,
    name,
    areaHa,
    colour: 'green',
    visibility: 'private',
    polygon: {
      type: 'Polygon',
      coordinates: [
        [
          [9, 48],
          [9.01, 48],
          [9.01, 48.01],
          [9, 48],
        ],
      ],
    },
    createdAt: '2026-09-01T08:00:00Z',
    updatedAt: '2026-09-01T08:00:00Z',
    deleted: false,
  })),
  nextCursor: null,
};

/** Signs in (or not) and opens a path of the account. */
async function open(page: Page, path: string, signedIn = true): Promise<void> {
  if (signedIn) await mockSignIn(page);
  else await mockSignedOut(page);
  await seedOfflineAreas(page);
  await seedPendingTransfer(page);
  await mockApi(
    page,
    {
      '/api/config': authConfig(BASE),
      '/api/me': ME,
      '/api/me/permissions': { permissions: ['group.manage'], roles: [] },
      '/api/me/export': ACCOUNT_EXPORT,
      '/api/species/bundle': SPECIES_BUNDLE,
      '/api/photos': MY_PHOTOS,
      '/api/zones': ZONES,
      '/api/finds': { items: [], nextCursor: null },
      '/api/markers': { items: [], nextCursor: null },
      '/api/combinations': { items: [], nextCursor: null },
      '/api/groups': { items: [] },
    },
    { photo: ROW_PHOTO },
  );
  await flatMap(page);
  await page.goto(path);
}

/** Waits for the counts of "My data". */
async function countsShown(page: Page): Promise<void> {
  await expect(page.getByText('Funde', { exact: true })).toBeVisible();
}

const ready = {
  account: async (page: Page): Promise<void> => {
    await expect(page.getByText('Kombinationen')).toBeVisible();
  },
  guest: async (page: Page): Promise<void> => {
    await expect(page.getByRole('button', { name: `Anmelden mit ${PROVIDER}` })).toBeVisible();
  },
  myData: countsShown,
  exportSheet: async (page: Page): Promise<void> => {
    await countsShown(page);
    await page.getByRole('button', { name: 'Daten exportieren' }).click();
    await expect(page.getByRole('button', { name: 'Exportieren', exact: true })).toBeVisible();
  },
  gpxSheet: async (page: Page): Promise<void> => {
    await countsShown(page);
    await page.getByRole('button', { name: 'Daten exportieren' }).click();
    await page.getByRole('tab', { name: 'GPX' }).click();
    await expect(page.getByRole('checkbox', { name: /Bilder/ })).toBeDisabled();
  },
  deleteAll: async (page: Page): Promise<void> => {
    await countsShown(page);
    await page.getByRole('button', { name: 'Alles löschen' }).click();
    await expect(page.getByText('Alle eigenen Daten löschen?')).toBeVisible();
  },
  myImages: async (page: Page): Promise<void> => {
    await expect(page.getByText('frei', { exact: true })).toBeVisible();
  },
  offlineAreas: async (page: Page): Promise<void> => {
    await expect(page.getByText('42 ha · 84 MB')).toBeVisible();
  },
  areaPicker: async (page: Page): Promise<void> => {
    await expect(page.getByText('Kirnbachtal')).toBeVisible();
  },
  heading:
    (name: string) =>
    async (page: Page): Promise<void> => {
      await expect(page.getByRole('heading', { name })).toBeVisible();
    },
};

/** Opens the path, waits for the content and compares the board. */
async function shoot(
  page: Page,
  board: string,
  path: string,
  done: (page: Page) => Promise<void>,
  signedIn = true,
): Promise<void> {
  await open(page, path, signedIn);
  await done(page);
  await expectBoard(page, board);
}

test('Account', async ({ page }) => {
  guard('Account', 'phone');
  await shoot(page, 'Account', '/konto', ready.account);
});

test('AccountDesktop', async ({ page }) => {
  guard('AccountDesktop', 'wide');
  await shoot(page, 'AccountDesktop', '/konto', ready.account);
});

test('AccountGuest', async ({ page }) => {
  guard('AccountGuest', 'phone');
  await shoot(page, 'AccountGuest', '/konto', ready.guest, false);
});

test('MyData', async ({ page }) => {
  guard('MyData', 'phone');
  await shoot(page, 'MyData', '/konto/daten', ready.myData);
});

test('AccountDesktopMyData', async ({ page }) => {
  guard('AccountDesktopMyData', 'wide');
  await shoot(page, 'AccountDesktopMyData', '/konto/daten', ready.myData);
});

test('DataExport', async ({ page }) => {
  guard('DataExport', 'phone');
  await shoot(page, 'DataExport', '/konto/daten', ready.exportSheet);
});

test('AccountDesktopDataExport', async ({ page }) => {
  guard('AccountDesktopDataExport', 'wide');
  await shoot(page, 'AccountDesktopDataExport', '/konto/daten', ready.exportSheet);
});

test('DataExportGpx', async ({ page }) => {
  guard('DataExportGpx', 'phone');
  await shoot(page, 'DataExportGpx', '/konto/daten', ready.gpxSheet);
});

test('AccountDesktopDataExportGpx', async ({ page }) => {
  guard('AccountDesktopDataExportGpx', 'wide');
  await shoot(page, 'AccountDesktopDataExportGpx', '/konto/daten', ready.gpxSheet);
});

test('DeleteAll', async ({ page }) => {
  guard('DeleteAll', 'phone');
  await shoot(page, 'DeleteAll', '/konto/daten', ready.deleteAll);
});

test('AccountDesktopDeleteAll', async ({ page }) => {
  guard('AccountDesktopDeleteAll', 'wide');
  await shoot(page, 'AccountDesktopDeleteAll', '/konto/daten', ready.deleteAll);
});

test('MyImages', async ({ page }) => {
  guard('MyImages', 'phone');
  await shoot(page, 'MyImages', '/konto/bilder', ready.myImages);
});

test('AccountDesktopMyImages', async ({ page }) => {
  guard('AccountDesktopMyImages', 'wide');
  await shoot(page, 'AccountDesktopMyImages', '/konto/bilder', ready.myImages);
});

test('OfflineAreas', async ({ page }) => {
  guard('OfflineAreas', 'phone');
  await shoot(page, 'OfflineAreas', '/konto/offline', ready.offlineAreas);
});

test('AccountDesktopOfflineAreas', async ({ page }) => {
  guard('AccountDesktopOfflineAreas', 'wide');
  await shoot(page, 'AccountDesktopOfflineAreas', '/konto/offline', ready.offlineAreas);
});

test('AreaPicker', async ({ page }) => {
  guard('AreaPicker', 'phone');
  await shoot(page, 'AreaPicker', '/konto/offline/zonen', ready.areaPicker);
});

test('AccountDesktopAreaPicker', async ({ page }) => {
  guard('AccountDesktopAreaPicker', 'wide');
  await shoot(page, 'AccountDesktopAreaPicker', '/konto/offline/zonen', ready.areaPicker);
});

test('AboutMethod', async ({ page }) => {
  guard('AboutMethod', 'phone');
  await shoot(page, 'AboutMethod', '/konto/methode', ready.heading('Methode'));
});

test('AccountDesktopAboutMethod', async ({ page }) => {
  guard('AccountDesktopAboutMethod', 'wide');
  await shoot(page, 'AccountDesktopAboutMethod', '/konto/methode', ready.heading('Methode'));
});

test('AboutLicences', async ({ page }) => {
  guard('AboutLicences', 'phone');
  await shoot(page, 'AboutLicences', '/konto/lizenzen', ready.heading('Quellen und Lizenzen'));
});

test('AccountDesktopAboutLicences', async ({ page }) => {
  guard('AccountDesktopAboutLicences', 'wide');
  await shoot(page, 'AccountDesktopAboutLicences', '/konto/lizenzen', ready.heading('Quellen und Lizenzen'));
});

test('AccountDesktopAbout', async ({ page }) => {
  guard('AccountDesktopAbout', 'wide');
  await shoot(page, 'AccountDesktopAbout', '/konto/ueber', ready.heading('Über die App'));
});
