import { TestBed } from '@angular/core/testing';
import { MapComponent } from '../features/map/map.component';
import { MAP_ADAPTER, VALUE_WORKER } from '../map/map.tokens';
import type { Viewbox } from '../map/tile-grid';
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
} from '../map/map-adapter';
import type { ValueReply, ValueJob } from '../map/value-messages';
import type { ColorizeWorker } from '../map/value-protocol';

/** Eine Karte ohne WebGL. Sie merkt sich, was die Seite von ihr wollte. */
export class MapAdapterDouble implements MapAdapter {
  options: MapOptions | null = null;
  styles: string[] = [];
  /** Je Rolle, was zuletzt gefragt wurde. `null` heißt „abgeräumt“. */
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
  /** Wie oft die Karte aufgebaut wurde. Ein zweites Mal hieße: neu geladen. */
  started = 0;
  /** Der Ort unter dem Fadenkreuz, den ein Test setzen kann. */
  centerPoint: readonly [number, number] | null = [9.05, 48.52];
  flights: { target: readonly [number, number]; zoom?: number }[] = [];
  layers = new Map<ObjectLayer, FeatureCollection>();
  chosen: ((layer: ObjectLayer, id: string) => void) | null = null;

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

  /** Was für eine Rolle gefragt wurde, ohne die Abräum-Aufrufe. */
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

  center(): readonly [number, number] | null {
    return this.centerPoint;
  }

  /** Der Punkt, der zuletzt aus einem Bildpunkt gefragt wurde. */
  asked: { x: number; y: number } | null = null;
  /** Was `pointAt` zurückgibt. Ohne Wert antwortet es wie die Mitte. */
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

  /** Was unter dem Finger liegt. Ein Test setzt es selbst. */
  hit: ObjectHit | null = null;

  objectAt(): ObjectHit | null {
    return this.hit;
  }

  /** Ohne WebGL gibt es keine echte Karte; ein Test setzt hier eine Attrappe. */
  raw: MapLibreMap | null = null;

  rawMap(): MapLibreMap | null {
    return this.raw;
  }
}

/** Ein Worker, der nichts färbt. Der Test antwortet selbst über `antworte`. */
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

/**
 * Hängt der Kartenseite Attrappen statt MapLibre und Worker unter. Muss vor
 * dem ersten `render` laufen, sonst steht die echte Karte schon.
 */
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

/**
 * Eine Wertkachel ohne Netz und ohne Leinwand: jeder Punkt trägt dasselbe
 * Byte. Byte 0 heißt „keine Daten“, so wie im Rendering.
 */
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

/** Die Manifeste vom Server, ohne Server. */
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

/** Zwei Wochenebenen und zwei feste, wie sie `input_layers.py` schreibt. */
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

/** Zwei gemessene Wochen und eine Prognose, wie sie das Rendering schreibt. */
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

/** Eine gespeicherte Kombination, wie der Dienst sie liefert. */
export const SAVED_COMBINATION = {
  id: 'k1',
  name: 'Buchenwald im Herbst',
  rule: 'graded',
  factors: [
    { source: 'wald', condition: 'above', low: 0.3, high: null, active: true },
    { source: 'boden_ph', condition: 'below', low: null, high: 5.5, active: true },
  ],
  createdAt: '2026-09-01T10:00:00+02:00',
  updatedAt: '2026-09-01T10:00:00+02:00',
};

/** Das Bündel, wie die Karte es zur Artwahl braucht. */
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
