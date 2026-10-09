import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withProps, withState } from '@ngrx/signals';
import type { Zone } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { withStorageSync } from '../../core/state';
import { cachedFetch, TILE_CACHE } from '../../core/tiles/tile-cache';
import { layerFolders } from '../../core/tiles/layers';
import { TileService } from '../../core/tiles/tile.service';
import { ToastService } from '../../ui/toast/toast.service';
import { areaTilePaths, MEAN_TILE_BYTES, polygonBounds, type TileSource } from './offline-tiles';

/** A zone whose tiles are on the device. */
export interface OfflineArea {
  /** The id of the zone. */
  readonly id: string;
  readonly name: string;
  readonly areaHa: number;
  readonly bytes: number;
  /** The tile paths of the area. A delete removes the paths that no other area uses. */
  readonly paths: readonly string[];
}

interface OfflineAreasState {
  areas: readonly OfflineArea[];
  /** The id of the zone that loads, `null` when nothing loads. */
  loading: string | null;
}

/** The number of tiles that load at the same time. */
const PARALLEL = 6;

function isArea(value: unknown): value is OfflineArea {
  if (typeof value !== 'object' || value === null) return false;
  const area = value as Record<string, unknown>;
  return (
    typeof area['id'] === 'string' &&
    typeof area['name'] === 'string' &&
    typeof area['areaHa'] === 'number' &&
    typeof area['bytes'] === 'number' &&
    Array.isArray(area['paths'])
  );
}

/** Reads the saved areas. A bad entry falls out, the good ones stay. */
export function restoreAreas(stored: unknown): Partial<OfflineAreasState> | null {
  return Array.isArray(stored) ? { areas: stored.filter(isArea) } : null;
}

/** Cuts a list into parts of `size` items. */
function batches<T>(items: readonly T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, (index + 1) * size),
  );
}

/** The result of a tile download. */
interface Loaded {
  readonly bytes: number;
  /** The number of tiles that arrived. */
  readonly count: number;
}

/** Gives the size of one tile, `null` when it did not arrive. */
async function loadTile(url: string): Promise<number | null> {
  try {
    const reply = await cachedFetch(url, 'image');
    return reply === null ? null : (await reply.blob()).size;
  } catch {
    return null;
  }
}

/** Loads the tiles into the tile cache and gives the bytes and the number of tiles that arrived. */
async function loadTiles(urls: readonly string[]): Promise<Loaded> {
  return batches(urls, PARALLEL).reduce<Promise<Loaded>>(
    async (sum, batch) => {
      const sizes = (await Promise.all(batch.map(loadTile))).filter((one) => one !== null);
      const before = await sum;
      return {
        bytes: before.bytes + sizes.reduce((total, one) => total + one, 0),
        count: before.count + sizes.length,
      };
    },
    Promise.resolve({ bytes: 0, count: 0 }),
  );
}

/** Removes tiles from the tile cache. A context without Cache Storage has nothing to remove. */
async function forgetTiles(urls: readonly string[]): Promise<void> {
  if (typeof caches === 'undefined' || urls.length === 0) return;
  try {
    const cache = await caches.open(TILE_CACHE);
    await Promise.all(urls.map((url) => cache.delete(url)));
  } catch {
    return;
  }
}

/** The offline areas: zones whose value tiles stay on the device. An area takes each input
 * layer in its latest week and each loaded species in its forecast weeks. */
export const OfflineAreasStore = signalStore(
  { providedIn: 'root' },
  withState<OfflineAreasState>({ areas: [], loading: null }),
  withStorageSync<OfflineAreasState, readonly OfflineArea[]>({
    key: 'pilzkarte.offlineAreas',
    select: (state) => state.areas,
    restore: restoreAreas,
  }),
  withProps(() => ({
    _tiles: inject(TileService),
    _i18n: inject(I18nService),
    _toasts: inject(ToastService),
  })),
  withComputed(({ areas, _tiles }) => ({
    totalBytes: computed(() => areas().reduce((total, area) => total + area.bytes, 0)),
    /** The folders and zoom levels that an area takes. */
    _sources: computed<readonly TileSource[]>(() => {
      const layers = _tiles.layerList().flatMap((layer): TileSource[] => {
        const folder = layerFolders(layer, null);
        return folder === null
          ? []
          : [
              {
                existing: layer.existing,
                haveZoom: layer.haveZoom,
                folder,
                zoomFrom: layer.zoomFrom,
                zoomTo: layer.offlineZoomTo,
              },
            ];
      });
      const species = [..._tiles.manifests().values()].flatMap((manifest) =>
        manifest.weeks
          .filter((week, index) => week.forecast || index === manifest.weeks.length - 1)
          .map((week): TileSource => ({
            existing: manifest.existing,
            haveZoom: manifest.haveZoom,
            folder: week.tilePath,
            zoomFrom: manifest.zoomFrom,
            zoomTo: manifest.offlineZoomTo,
          })),
      );
      return [...layers, ...species];
    }),
  })),
  withMethods((store) => {
    const pathsOf = (zone: Zone): readonly string[] =>
      areaTilePaths(polygonBounds(zone.polygon), store._sources());

    return {
      /** True when the zone is on the device. */
      holds(id: string): boolean {
        return store.areas().some((area) => area.id === id);
      },

      /** Loads the layer manifest, so that `estimate` knows the tiles. */
      prepare(): void {
        void store._tiles.loadLayers();
      },

      /** The size of a zone before the download, from the number of tiles. `null` without a layer manifest. */
      estimate(zone: Zone): number | null {
        return store._sources().length === 0 ? null : pathsOf(zone).length * MEAN_TILE_BYTES;
      },

      /** Loads the tiles of a zone. A second call while one runs has no effect.
       * When no tile arrives, the area does not go on the device and a toast tells the user. */
      async add(zone: Zone): Promise<void> {
        if (store.loading() !== null) return;
        patchState(store, { loading: zone.id });
        try {
          await store._tiles.loadLayers();
          const paths = pathsOf(zone);
          const { bytes, count } = await loadTiles(paths.map((path) => store._tiles.url(path)));
          if (count === 0) {
            store._toasts.error(store._i18n.translate('area.failed'));
            return;
          }
          const area: OfflineArea = { id: zone.id, name: zone.name, areaHa: zone.areaHa, bytes, paths };
          patchState(store, ({ areas }) => ({ areas: [...areas.filter((one) => one.id !== zone.id), area] }));
        } catch {
          store._toasts.error(store._i18n.translate('area.failed'));
        } finally {
          patchState(store, { loading: null });
        }
      },

      /** Removes an area and the tiles that no other area uses. */
      async remove(id: string): Promise<void> {
        const gone = store.areas().find((area) => area.id === id);
        if (gone === undefined) return;
        const rest = store.areas().filter((area) => area.id !== id);
        patchState(store, { areas: rest });
        const kept = new Set(rest.flatMap((area) => area.paths));
        await forgetTiles(gone.paths.filter((path) => !kept.has(path)).map((path) => store._tiles.url(path)));
      },
    };
  }),
);

/** The instance type of {@link OfflineAreasStore}. */
export type OfflineAreasStore = InstanceType<typeof OfflineAreasStore>;
