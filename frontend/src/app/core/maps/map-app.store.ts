import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { plainTextStorage, withStorageSync } from '../state';

/** OpenStreetMap or Google Maps, for "Open in map app" on a computer. */
export type MapApp = 'osm' | 'google';

interface MapAppState {
  choice: MapApp;
}

const STORAGE_KEY = 'pilzkarte.kartenApp';

function isMapApp(value: unknown): value is MapApp {
  return value === 'osm' || value === 'google';
}

/** The choice of the map app. Each device keeps its own choice. */
export const MapAppStore = signalStore(
  { providedIn: 'root' },
  withState<MapAppState>({ choice: 'osm' }),
  withStorageSync<MapAppState, MapApp>({
    key: STORAGE_KEY,
    select: (state) => state.choice,
    restore: (stored) => (isMapApp(stored) ? { choice: stored } : null),
    storage: plainTextStorage(),
  }),
  withMethods((store) => ({
    setChoice(choice: MapApp): void {
      patchState(store, { choice });
    },
  })),
);

/** The instance type of {@link MapAppStore}. */
export type MapAppStore = InstanceType<typeof MapAppStore>;
