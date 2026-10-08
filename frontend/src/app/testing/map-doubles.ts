import { TestBed } from '@angular/core/testing';
import { MapComponent } from '../features/map/map.component';
import { MAP_ADAPTER, VALUE_WORKER } from '../map/map.tokens';
import type { Viewbox } from '../map/tile-grid';
import type { Combination } from '../core/api/models';
import type { FeatureCollection } from 'geojson';
import type { Map as MapLibreMap } from 'maplibre-gl';
import type {
  Bounds,
  MapOptions,
  MapAdapter,
  ObjectHit,
  ObjectLayer,
  Padding,
  Role,
  Rotation,
} from '../map/map-adapter';
import type { ValueReply, ValueJob } from '../map/value-messages';
import type { ColorizeWorker } from '../map/value-protocol';

/** A map without WebGL. It records what the page asked of it. */
export class MapAdapterDouble implements MapAdapter {
  options: MapOptions | null = null;
  styles: string[] = [];
  /** For each role, the last request. `null` means "removed". */
  readonly templatesPerRole = new Map<Role, (string | null)[]>();
  readonly opacity = new Map<Role, number>();
  centered: { point: readonly [number, number]; zoom: number } | null = null;
  padding: Padding[] = [];
  fitted: { bounds: Bounds; padding: Padding }[] = [];
  movement: (() => void) | null = null;
  destroyed = false;
  view: { zoom: number; extent: Viewbox } | null = {
    zoom: 7,
    extent: { west: 9.9, south: 50.9, ost: 10.9, nord: 51.9 },
  };

  warmed = 0;
  /** How often the map was built. A second time means a reload. */
  started = 0;
  /** The location below the crosshair. A test can set it. */
  centerPoint: readonly [number, number] | null = [9.05, 48.52];
  flights: { target: readonly [number, number]; zoom?: number }[] = [];
  layers = new Map<ObjectLayer, FeatureCollection>();
  chosen: ((layer: ObjectLayer, id: string) => void) | null = null;
  /** How often the area measured its size again after a delay. */
  resized = 0;

  warmUp(): void {
    this.warmed += 1;
  }

  start(_host: HTMLElement, options: MapOptions): Promise<void> {
    this.options = options;
    this.started += 1;
    return Promise.resolve();
  }

  setStyle(style: string): void {
    this.styles.push(style);
  }

  showValue(role: Role, template: string | null): void {
    const bisher = this.templatesPerRole.get(role) ?? [];
    bisher.push(template);
    this.templatesPerRole.set(role, bisher);
  }

  setOpacity(role: Role, value: number): void {
    this.opacity.set(role, value);
  }

  centerOn(point: readonly [number, number], zoom: number): void {
    this.centered = { point, zoom };
  }

  /** The requests for a role, without the remove calls. */
  templates(role: Role = 'forecast'): string[] {
    return (this.templatesPerRole.get(role) ?? []).filter((value): value is string => value !== null);
  }

  fitBounds(bounds: Bounds, padding: Padding): void {
    this.fitted.push({ bounds, padding });
  }

  setPadding(padding: Padding): void {
    this.padding.push(padding);
  }

  extent(): { zoom: number; extent: Viewbox } | null {
    return this.view;
  }

  onMove(handler: () => void): void {
    this.movement = handler;
  }

  destroy(): void {
    this.destroyed = true;
  }

  resize(): void {
    this.resized += 1;
  }

  center(): readonly [number, number] | null {
    return this.centerPoint;
  }

  /** The last pixel that the page converted to a location. */
  asked: { x: number; y: number } | null = null;
  /** What `pointAt` gives back. Without a value, it gives the centre. */
  pointPoint: readonly [number, number] | null = null;

  pointAt(x: number, y: number): readonly [number, number] | null {
    this.asked = { x, y };
    return this.pointPoint ?? this.centerPoint;
  }

  flyTo(target: readonly [number, number], zoom?: number): void {
    this.flights.push({ target, zoom });
  }

  showObjects(layer: ObjectLayer, data: FeatureCollection): void {
    this.layers.set(layer, data);
  }

  hideObjects(layer: ObjectLayer): void {
    this.layers.delete(layer);
  }

  onObjectSelect(handler: (layer: ObjectLayer, id: string) => void): void {
    this.chosen = handler;
  }

  /** What is below the finger. A test sets it. */
  hit: ObjectHit | null = null;

  objectAt(): ObjectHit | null {
    return this.hit;
  }

  /** Without WebGL there is no real map. A test sets a double here. */
  raw: MapLibreMap | null = null;

  rawMap(): MapLibreMap | null {
    return this.raw;
  }

  /** The bearing and the pitch that a test sets. */
  turn: Rotation = { bearing: 0, pitch: 0 };
  /** What the page does after a rotation. */
  rotated: (() => void) | null = null;
  /** How often the map turned back to north. */
  norths: boolean[] = [];
  cursors: string[] = [];
  clicked: ((point: readonly [number, number]) => void) | null = null;
  moved: ((point: readonly [number, number]) => void) | null = null;
  /** Where `project` puts a location. */
  screen: { x: number; y: number } | null = { x: 100, y: 100 };

  rotation(): Rotation {
    return this.turn;
  }

  onRotate(handler: () => void): void {
    this.rotated = handler;
  }

  resetNorth(smooth: boolean): void {
    this.norths.push(smooth);
    this.turn = { bearing: 0, pitch: 0 };
    this.rotated?.();
  }

  setCursor(cursor: string): void {
    this.cursors.push(cursor);
  }

  onMapClick(handler: (point: readonly [number, number]) => void): () => void {
    this.clicked = handler;
    return () => (this.clicked = null);
  }

  onPointerMove(handler: (point: readonly [number, number]) => void): () => void {
    this.moved = handler;
    return () => (this.moved = null);
  }

  project(): { x: number; y: number } | null {
    return this.screen;
  }

  /** What the page does on a press and a release. */
  down: ((point: readonly [number, number]) => void) | null = null;
  up: (() => void) | null = null;
  /** Whether the map can pan now. */
  dragPan = true;

  onPointerDown(handler: (point: readonly [number, number]) => void): () => void {
    this.down = handler;
    return () => (this.down = null);
  }

  onPointerUp(handler: () => void): () => void {
    this.up = handler;
    return () => (this.up = null);
  }

  setDragPan(enabled: boolean): void {
    this.dragPan = enabled;
  }

  /** Turns the map, as a gesture does. */
  turnTo(bearing: number, pitch = 0): void {
    this.turn = { bearing, pitch };
    this.rotated?.();
  }
}

/** A worker that paints nothing. The test gives the answers itself. */
export class WorkerDouble implements ColorizeWorker {
  readonly jobs: ValueJob[] = [];
  stopped = false;
  private handler: ((event: MessageEvent<ValueReply>) => void) | null = null;

  postMessage(job: ValueJob): void {
    this.jobs.push(job);
  }

  addEventListener(_kind: 'message', handler: (event: MessageEvent<ValueReply>) => void): void {
    this.handler = handler;
  }

  terminate(): void {
    this.stopped = true;
  }

  answer(reply: ValueReply): void {
    this.handler?.({ data: reply } as MessageEvent<ValueReply>);
  }
}

/** Gives the map page doubles for MapLibre and the worker. Call it before the first `render`. */
export function mapWithDoubles(): { map: MapAdapterDouble; worker: WorkerDouble } {
  const map = new MapAdapterDouble();
  const worker = new WorkerDouble();
  TestBed.overrideComponent(MapComponent, {
    add: {
      providers: [
        { provide: MAP_ADAPTER, useValue: map },
        { provide: VALUE_WORKER, useValue: () => worker },
      ],
    },
  });
  return { map, worker };
}

/** A value tile without network and canvas: each pixel has the same byte. Byte 0 means "no data". */
export function answerValueTile(byte: number): void {
  vi.stubGlobal('createImageBitmap', () =>
    Promise.resolve({ width: 256, height: 256, close: () => undefined }),
  );
  vi.stubGlobal(
    'OffscreenCanvas',
    class {
      getContext(): { drawImage: () => void; getImageData: () => { data: number[] } } {
        return { drawImage: () => undefined, getImageData: () => ({ data: [byte, byte, byte, 255] }) };
      }
    },
  );
}

/** The manifests of the server, without a server. */
export function answerManifest(data: unknown = RAW_MANIFEST, layers: unknown = RAW_LAYERS): void {
  vi.stubGlobal('fetch', (path: string) =>
    Promise.resolve({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: () => Promise.resolve(path === '/layers.json' ? layers : data),
    } as Response),
  );
}

/** Two layers per week and two fixed layers, as the backend writes them. */
export const RAW_LAYERS = {
  bounds: [
    [47.14, 4.93],
    [55.25, 15.14],
  ],
  layers: {
    regen_4w: {
      label: 'Niederschlag der letzten 4 Wochen',
      unit: 'mm',
      static: false,
      low: 0,
      high: 151.9,
      weeks: ['2025W39', '2025W40'],
      tiles: 'layers_kacheln/regen_4w',
      zooms: [5, 7],
      have: { '7': ['66/42', '67/42'] },
      histograms: {
        '2025W39': { classes: [0, 50, 100, 151.9], shares: [0.5, 0.3, 0.2] },
        '2025W40': { classes: [0, 50, 100, 151.9], shares: [0.6, 0.3, 0.1] },
      },
    },
    temperatur: {
      label: 'Mitteltemperatur der Woche',
      unit: 'Grad',
      static: false,
      low: -3.6,
      high: 24.7,
      weeks: ['2025W39', '2025W40'],
      tiles: 'layers_kacheln/temperatur',
      zooms: [5, 7],
      have: { '7': ['66/42'] },
    },
    wald: {
      label: 'Waldanteil',
      unit: '',
      static: true,
      low: 0,
      high: 1,
      tiles: 'layers_kacheln/wald',
      zooms: [5, 8],
      have: { '7': ['66/42'] },
      histogram: { classes: [0, 0.5, 1], shares: [0.7, 0.3] },
    },
    boden_ph: {
      label: 'Boden-pH',
      unit: '',
      static: true,
      low: 4.663,
      high: 6.899,
      tiles: 'layers_kacheln/boden_ph',
      zooms: [5, 8],
      have: { '7': ['66/42'] },
    },
  },
};

/** Two measured weeks and one forecast, as the rendering writes them. */
export const RAW_MANIFEST = {
  name: 'boletus_edulis',
  species: ['Boletus edulis'],
  top: 0.5,
  bounds: [
    [47.14, 4.93],
    [55.25, 15.14],
  ],
  tiles: { zooms: [5, 8], have: { '7': ['66/42', '67/42'] } },
  weeks: [
    { year: 2025, week: 39, forecast: false, tiles: 'boletus_edulis_kacheln/2025W39', mean: 0.05, max: 0.3 },
    {
      year: 2025,
      week: 40,
      forecast: false,
      tiles: 'boletus_edulis_kacheln/2025W40',
      mean: 0.1,
      max: 0.5,
      histogram: { classes: [0, 0.25, 0.5], shares: [0.8, 0.2] },
    },
    { year: 2025, week: 41, forecast: true, tiles: 'boletus_edulis_kacheln/2025W41', mean: 0.08, max: 0.4 },
  ],
};

/** A saved combination, as the service sends it. */
export const SAVED_COMBINATION: Combination = {
  id: 'k1',
  name: 'Buchenwald im Herbst',
  rule: 'graded',
  factors: [
    { source: 'wald', condition: 'above', low: 0.3, high: null, active: true },
    { source: 'boden_ph', condition: 'below', low: null, high: 5.5, active: true },
  ],
  createdAt: '2026-09-01T10:00:00+02:00',
  updatedAt: '2026-09-01T10:00:00+02:00',
  deleted: false,
};

/** The bundle that the map needs for the species choice. */
export const BUNDLE_ITEMS = [
  {
    id: '00000000-0000-4000-8000-000000000001',
    slug: 'boletus-edulis',
    name: 'Steinpilz',
    scientificName: 'Boletus edulis',
    group: 'bolete',
    edibility: 'edible',
    protection: 'none',
    forecastEnabled: true,
    updatedAt: '2025-10-01T00:00:00Z',
  },
  {
    id: '00000000-0000-4000-8000-000000000002',
    slug: 'cantharellus-cibarius',
    name: 'Pfifferling',
    scientificName: 'Cantharellus cibarius',
    group: 'chanterelle',
    edibility: 'edible',
    protection: 'none',
    forecastEnabled: true,
    updatedAt: '2025-10-01T00:00:00Z',
  },
  {
    id: '00000000-0000-4000-8000-000000000003',
    slug: 'amanita-phalloides',
    name: 'Knollenblätterpilz',
    scientificName: 'Amanita phalloides',
    group: 'amanita',
    edibility: 'deadly',
    protection: 'none',
    forecastEnabled: false,
    updatedAt: '2025-10-01T00:00:00Z',
  },
];
