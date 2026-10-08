import type { Page } from '@playwright/test';
import { ACCOUNT_EXPORT, seedOfflineAreas, seedPendingTransfer } from '../fixtures/account';
import { mockApi } from '../fixtures/api';
import { flatMap } from '../fixtures/flat-map';
import { authConfig, mockSignIn, mockSignedOut } from '../fixtures/auth';
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
  photo({ id: 'image-one', speciesId: '', photographer: 'Frederik', licence: 'cc_by_4', createdAt: '2026-09-06T08:00:00Z' }),
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
    polygon: { type: 'Polygon', coordinates: [[[9, 48], [9.01, 48], [9.01, 48.01], [9, 48]]] },
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
    },
    { photo: ROW_PHOTO },
  );
  await flatMap(page);
  await page.goto(path);
}

/** Waits for the counts of "My data". */
async function openMyData(page: Page): Promise<void> {
  await expect(page.getByText('Funde', { exact: true })).toBeVisible();
}

/** The phone boards and their desktop twin, with the path and the steps on the page. */
const BOARDS: readonly {
  phone: string | null;
  wide: string | null;
  path: string;
  ready: (page: Page) => Promise<void>;
  signedIn?: boolean;
}[] = [
  {
    phone: 'Account',
    wide: 'AccountDesktop',
    path: '/konto',
    ready: async (page) => {
      await expect(page.getByText('Kombinationen')).toBeVisible();
    },
  },
  {
    phone: 'AccountGuest',
    wide: null,
    path: '/konto',
    signedIn: false,
    ready: async (page) => {
      await expect(page.getByRole('button', { name: 'Anmelden mit beimgraben.net' })).toBeVisible();
    },
  },
  {
    phone: 'MyData',
    wide: 'AccountDesktopMyData',
    path: '/konto/daten',
    ready: async (page) => {
      await expect(page.getByText('Funde', { exact: true })).toBeVisible();
    },
  },
  {
    phone: 'DataExport',
    wide: 'AccountDesktopDataExport',
    path: '/konto/daten',
    ready: async (page) => {
      await openMyData(page);
      await page.getByRole('button', { name: 'Daten exportieren' }).click();
      await expect(page.getByRole('button', { name: 'Exportieren', exact: true })).toBeVisible();
    },
  },
  {
    phone: 'DataExportGpx',
    wide: 'AccountDesktopDataExportGpx',
    path: '/konto/daten',
    ready: async (page) => {
      await openMyData(page);
      await page.getByRole('button', { name: 'Daten exportieren' }).click();
      await page.getByRole('tab', { name: 'GPX' }).click();
      await expect(page.getByRole('checkbox', { name: /Bilder/ })).toBeDisabled();
    },
  },
  {
    phone: 'DeleteAll',
    wide: 'AccountDesktopDeleteAll',
    path: '/konto/daten',
    ready: async (page) => {
      await openMyData(page);
      await page.getByRole('button', { name: 'Alles löschen' }).click();
      await expect(page.getByText('Alle eigenen Daten löschen?')).toBeVisible();
    },
  },
  {
    phone: 'MyImages',
    wide: 'AccountDesktopMyImages',
    path: '/konto/bilder',
    ready: async (page) => {
      await expect(page.getByText('frei', { exact: true })).toBeVisible();
    },
  },
  {
    phone: 'OfflineAreas',
    wide: 'AccountDesktopOfflineAreas',
    path: '/konto/offline',
    ready: async (page) => {
      await expect(page.getByText('42 ha · 84 MB')).toBeVisible();
    },
  },
  {
    phone: 'AreaPicker',
    wide: 'AccountDesktopAreaPicker',
    path: '/konto/offline/zonen',
    ready: async (page) => {
      await expect(page.getByText('Kirnbachtal')).toBeVisible();
    },
  },
  {
    phone: 'AboutMethod',
    wide: 'AccountDesktopAboutMethod',
    path: '/konto/methode',
    ready: async (page) => {
      await expect(page.getByRole('heading', { name: 'Methode' })).toBeVisible();
    },
  },
  {
    phone: 'AboutLicences',
    wide: 'AccountDesktopAboutLicences',
    path: '/konto/lizenzen',
    ready: async (page) => {
      await expect(page.getByRole('heading', { name: 'Quellen und Lizenzen' })).toBeVisible();
    },
  },
  {
    phone: null,
    wide: 'AccountDesktopAbout',
    path: '/konto/ueber',
    ready: async (page) => {
      await expect(page.getByRole('heading', { name: 'Über die App' })).toBeVisible();
    },
  },
];

for (const board of BOARDS) {
  for (const [device, name] of [
    ['phone', board.phone],
    ['wide', board.wide],
  ] as const) {
    if (name === null) continue;
    test(name, async ({ page }) => {
      guard(name, device);
      await open(page, board.path, board.signedIn ?? true);
      await board.ready(page);
      await expectBoard(page, name);
    });
  }
}
