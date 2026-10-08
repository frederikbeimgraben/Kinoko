import type { Page } from '@playwright/test';

/** The counts of the boards `Account` and `MyData`: 12 finds, 4 markers, 2 zones, 3 images, 2 combinations. */
export const ACCOUNT_EXPORT = {
  me: { id: '11111111-1111-1111-1111-111111111111', sub: 'sub-eins', name: 'Frederik', email: 'frederik@beimgraben.net' },
  finds: Array.from({ length: 12 }, (_, index) => ({
    id: `find-${String(index)}`,
    lat: 48.5,
    lon: 9.05,
    foundOn: '2026-09-06',
    updatedAt: '2026-09-06T08:00:00Z',
    deleted: false,
  })),
  markers: Array.from({ length: 4 }, (_, index) => ({
    id: `marker-${String(index)}`,
    name: 'Marker',
    lat: 48.5,
    lon: 9.05,
    updatedAt: '2026-09-06T08:00:00Z',
    deleted: false,
  })),
  zones: Array.from({ length: 2 }, (_, index) => ({
    id: `zone-${String(index)}`,
    name: 'Zone',
    updatedAt: '2026-09-06T08:00:00Z',
    deleted: false,
  })),
  photos: Array.from({ length: 3 }, (_, index) => ({ id: `photo-${String(index)}` })),
  combinations: Array.from({ length: 2 }, (_, index) => ({
    id: `combination-${String(index)}`,
    updatedAt: '2026-09-06T08:00:00Z',
    deleted: false,
  })),
};

/** The offline area of the board `OfflineAreas`: 42 ha and 84 MB. */
export const OFFLINE_AREA = { id: 'zone-schoenbuch', name: 'Schönbuch Nord', areaHa: 42, bytes: 84_000_000, paths: [] };

/** Puts the offline areas into the storage before the app starts. */
export async function seedOfflineAreas(page: Page, areas: readonly unknown[] = [OFFLINE_AREA]): Promise<void> {
  await page.addInitScript((saved) => {
    localStorage.setItem('pilzkarte.offlineAreas', saved);
  }, JSON.stringify(areas));
}

/** Puts one pending transfer into the queue of the device before the app starts. */
export async function seedPendingTransfer(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const request = indexedDB.open('primordium', 2);
    request.onupgradeneeded = (): void => {
      for (const area of ['catalog', 'texts', 'objects', 'queue']) request.result.createObjectStore(area);
    };
    request.onsuccess = (): void => {
      const db = request.result;
      const task = {
        id: 'task-one',
        kind: 'marker',
        operation: 'update',
        target: 'marker-one',
        body: { name: 'Marker', lat: 48.5, lon: 9.05 },
        photos: [],
        createdAt: '2026-09-10T08:00:00.000Z',
        conflict: false,
      };
      db.transaction('queue', 'readwrite').objectStore('queue').put(task, task.id);
    };
  });
}
