import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { withStorageSync } from '../../core/state';
import { BACKGROUNDS, type Background } from '../../map/background';
import type { Detent } from '../../ui/sheet/sheet-snap';

/** The three views of the map sheet. */
export type ViewMode = 'forecast' | 'layer' | 'combination';

export const VIEW_MODES: readonly ViewMode[] = ['forecast', 'layer', 'combination'];

/** The species that the map shows when nobody chose one. */
export const DEFAULT_SPECIES = 'boletus-edulis';

/** The input layer that the map shows when nobody chose one: rain of the last four weeks. */
export const DEFAULT_LAYER = 'regen_4w';

const SLUG_PATTERN = /^[a-z0-9-]{1,60}$/;
const LAYER_PATTERN = /^[a-z0-9_]{1,40}$/;

/** The key in the device storage. A new shape gets a new key. */
export const STORAGE_KEY = 'pilzkarte.map.v1';

/** The time in ms between the last change and the write. A slider changes many times each second. */
export const SAVE_DELAY = 300;

/** The three kinds of object that a sheet over the map can show. */
export const OBJECT_KINDS = ['find', 'marker', 'zone'] as const;
export type ObjectKind = (typeof OBJECT_KINDS)[number];

/** The object that is open over the map. */
export interface OpenObject {
  kind: ObjectKind;
  id: string;
}

interface MapStoreState {
  species: string;
  /** The layers sheet. Its button is on each tab. */
  layersSheetOpen: boolean;
  /** Year and week as `YYYY-WW`, or `null` for the current week. */
  week: string | null;
  view: ViewMode;
  /** The chosen input layer. `null` means the first one in the list. */
  layer: string | null;
  /** The opacity of the value layer, from 0 to 1. */
  opacity: number;
  background: Background;
  /** In the layer view, the species forecast stays below the layer. */
  forecastBelow: boolean;
  detent: Detent;
  showMarkers: boolean;
  showZones: boolean;
  showSharedFinds: boolean;
  object: OpenObject | null;
  /** The height in px of the sheet over the map. The map pads its centre by it. */
  overlayHeight: number;
  /** Counts each pan. A reader of the point below the crosshair reads it again. */
  moved: number;
}

/** The part of the state in the device storage. The week and the open object are not in it. */
type Saved = Pick<
  MapStoreState,
  | 'species'
  | 'view'
  | 'layer'
  | 'opacity'
  | 'background'
  | 'forecastBelow'
  | 'showMarkers'
  | 'showZones'
  | 'showSharedFinds'
  | 'detent'
>;

const INITIAL: MapStoreState = {
  species: DEFAULT_SPECIES,
  layersSheetOpen: false,
  week: null,
  view: 'forecast',
  layer: null,
  opacity: 1,
  background: 'map',
  forecastBelow: false,
  detent: 1,
  showMarkers: true,
  showZones: true,
  showSharedFinds: true,
  object: null,
  overlayHeight: 0,
  moved: 0,
};

function isView(value: unknown): value is ViewMode {
  return typeof value === 'string' && (VIEW_MODES as readonly string[]).includes(value);
}

/** Accepts only a background that exists. A strange value from the storage goes. */
function asBackground(value: unknown): Background | null {
  const found = BACKGROUNDS.find((entry) => entry === value);
  return found ?? null;
}

function asDetent(value: unknown): Detent | null {
  return value === 0 || value === 1 || value === 2 ? value : null;
}

function asFlag(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

/** Makes a patch from a stored value. Each field with a wrong shape is ignored. */
export function restoreMap(stored: unknown): Partial<MapStoreState> | null {
  if (typeof stored !== 'object' || stored === null) return null;
  const raw = stored as Record<string, unknown>;
  const opacity = raw['opacity'];
  const candidates: Partial<Record<keyof Saved, unknown>> = {
    species: typeof raw['species'] === 'string' && SLUG_PATTERN.test(raw['species']) ? raw['species'] : null,
    view: isView(raw['view']) ? raw['view'] : null,
    layer: typeof raw['layer'] === 'string' && LAYER_PATTERN.test(raw['layer']) ? raw['layer'] : null,
    opacity:
      typeof opacity === 'number' && Number.isFinite(opacity) ? Math.min(Math.max(opacity, 0), 1) : null,
    background: asBackground(raw['background']),
    forecastBelow: asFlag(raw['forecastBelow']),
    showMarkers: asFlag(raw['showMarkers']),
    showZones: asFlag(raw['showZones']),
    showSharedFinds: asFlag(raw['showSharedFinds']),
    detent: asDetent(raw['detent']),
  };
  const patch: Partial<MapStoreState> = Object.fromEntries(
    Object.entries(candidates).filter(([, value]) => value !== null),
  );
  return patch;
}

function saved(state: MapStoreState): Saved {
  return {
    species: state.species,
    view: state.view,
    layer: state.layer,
    opacity: state.opacity,
    background: state.background,
    forecastBelow: state.forecastBelow,
    showMarkers: state.showMarkers,
    showZones: state.showZones,
    showSharedFinds: state.showSharedFinds,
    detent: state.detent,
  };
}

/** Species, week, view, layer and opacity of the map. The single source for both devices. */
export const MapStore = signalStore(
  { providedIn: 'root' },
  withState<MapStoreState>(INITIAL),
  withStorageSync<MapStoreState, Saved>({
    key: STORAGE_KEY,
    select: saved,
    restore: restoreMap,
    debounceMs: SAVE_DELAY,
  }),
  withMethods((store) => ({
    setSpecies(species: string): void {
      patchState(store, { species });
    },
    setWeek(week: string | null): void {
      patchState(store, { week });
    },
    setView(view: ViewMode): void {
      patchState(store, { view });
    },
    setLayer(layer: string | null): void {
      patchState(store, { layer });
    },
    setOpacity(opacity: number): void {
      patchState(store, { opacity: Math.min(Math.max(opacity, 0), 1) });
    },
    /** Accepts only a background that exists. A strange value from the storage is ignored. */
    setBackground(choice: string): void {
      const background = asBackground(choice);
      if (background !== null) patchState(store, { background });
    },
    setForecastBelow(forecastBelow: boolean): void {
      patchState(store, { forecastBelow });
    },
    setDetent(detent: Detent): void {
      patchState(store, { detent });
    },
    setShowMarkers(showMarkers: boolean): void {
      patchState(store, { showMarkers });
    },
    setShowZones(showZones: boolean): void {
      patchState(store, { showZones });
    },
    setShowSharedFinds(showSharedFinds: boolean): void {
      patchState(store, { showSharedFinds });
    },
    setLayersSheetOpen(layersSheetOpen: boolean): void {
      patchState(store, { layersSheetOpen });
    },
    toggleLayersSheet(): void {
      patchState(store, (state) => ({ layersSheetOpen: !state.layersSheetOpen }));
    },
    setObject(object: OpenObject | null): void {
      patchState(store, { object });
    },
    setOverlayHeight(overlayHeight: number): void {
      patchState(store, { overlayHeight });
    },
    countMove(): void {
      patchState(store, (state) => ({ moved: state.moved + 1 }));
    },
  })),
);

/** The instance type of {@link MapStore}. */
export type MapStore = InstanceType<typeof MapStore>;
