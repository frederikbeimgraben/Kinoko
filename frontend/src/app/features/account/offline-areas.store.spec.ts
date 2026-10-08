import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { Zone } from '../../core/api/models';
import type { Layer } from '../../core/tiles/layers';
import { tileKey } from '../../core/tiles/tile-paths';
import { TileService } from '../../core/tiles/tile.service';
import { toastSpy } from '../../testing/toast-spy';
import { OfflineAreasStore } from './offline-areas.store';
import { tileX, tileY } from './offline-tiles';

const zone = {
  id: 'zone-1',
  name: 'Wald',
  areaHa: 3,
  polygon: {
    type: 'Polygon',
    coordinates: [
      [
        [9, 48],
        [9.001, 48],
        [9.001, 48.001],
        [9, 48],
      ],
    ],
  },
} as unknown as Zone;

const layer = {
  fixed: true,
  tilePath: 'forest',
  zoomFrom: 8,
  haveZoom: 8,
  offlineZoomTo: 8,
  weeks: [],
  existing: new Set([tileKey(8, tileX(9, 8), tileY(48, 8))]),
} as unknown as Layer;

const tiles = {
  layerList: signal<readonly Layer[]>([layer]),
  manifests: signal(new Map()),
  loadLayers: (): Promise<void> => Promise.resolve(),
  url: (path: string): string => `https://tiles.test/${path}`,
};

/** A tile reply whose body is `body`, or whose body read fails when `body` is null. */
function reply(body: string | null): Response {
  return {
    ok: true,
    headers: new Headers({ 'content-type': 'image/png' }),
    blob: () => (body === null ? Promise.reject(new Error('aborted')) : Promise.resolve(new Blob([body]))),
    clone() {
      return this;
    },
  } as unknown as Response;
}

function build(): OfflineAreasStore {
  localStorage.clear();
  TestBed.configureTestingModule({ providers: [{ provide: TileService, useValue: tiles }] });
  return TestBed.inject(OfflineAreasStore);
}

describe('OfflineAreasStore', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('keeps the area with the bytes of the tiles that arrived', async () => {
    vi.stubGlobal('fetch', () => Promise.resolve(reply('abcd')));
    const store = build();

    await store.add(zone);

    expect(store.areas().map((area) => [area.id, area.bytes])).toEqual([['zone-1', 4]]);
    expect(store.loading()).toBeNull();
  });

  it('keeps no area and tells the user when no tile arrives', async () => {
    vi.stubGlobal('fetch', () => Promise.reject(new Error('offline')));
    const store = build();
    const toasts = toastSpy();

    await store.add(zone);

    expect(store.areas()).toEqual([]);
    expect(store.loading()).toBeNull();
    expect(toasts.failure).toHaveLength(1);
  });

  it('ends the download when a tile body fails, so a second download can start', async () => {
    vi.stubGlobal('fetch', () => Promise.resolve(reply(null)));
    const store = build();
    toastSpy();

    await store.add(zone);
    expect(store.loading()).toBeNull();

    vi.stubGlobal('fetch', () => Promise.resolve(reply('ab')));
    await store.add(zone);
    expect(store.holds('zone-1')).toBe(true);
  });

  it('ends the download when the layer manifest fails', async () => {
    const store = build();
    const toasts = toastSpy();
    vi.spyOn(tiles, 'loadLayers').mockRejectedValueOnce(new Error('offline'));

    await store.add(zone);

    expect(store.loading()).toBeNull();
    expect(toasts.failure).toHaveLength(1);
  });
});
