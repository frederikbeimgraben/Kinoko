import type { Map as MapLibreMap } from 'maplibre-gl';
import { geometryFor, startDrawing, type TerraModule } from './zone-drawer';
import type { Location } from './add-entry.state';

const RING: Location[] = [
  [9.0, 48.5],
  [9.1, 48.5],
  [9.1, 48.6],
];

/** Terra Draw ohne Karte: die Attrappe schreibt mit, was sie bekommen hat. */
class DrawDouble {
  static last: DrawDouble | null = null;
  readonly features: { id: string | number; geometry: { type: string } }[] = [];
  readonly modi: string[] = [];
  started = 0;
  stopped = 0;
  cleared = 0;
  selected: (string | number)[] = [];
  patch: (() => void) | null = null;
  snapshot: unknown = null;

  constructor() {
    DrawDouble.last = this;
  }

  start(): void {
    this.started += 1;
  }

  stop(): void {
    this.stopped += 1;
  }

  setMode(mode: string): void {
    this.modi.push(mode);
  }

  clear(): void {
    this.cleared += 1;
    this.features.length = 0;
  }

  getFeatureId(): string {
    return `f-${this.features.length + 1}`;
  }

  addFeatures(features: { id: string | number; geometry: { type: string } }[]): void {
    this.features.push(...features);
  }

  selectFeature(id: string | number): void {
    this.selected.push(id);
  }

  on(_kind: string, handler: () => void): void {
    this.patch = handler;
  }

  getSnapshotFeature(): unknown {
    return this.snapshot;
  }
}

/** Die zuletzt gebaute Zeichnung. Ohne sie gäbe es nichts zu prüfen. */
function drawDouble(): DrawDouble {
  if (DrawDouble.last === null) throw new Error('Es wurde keine Zeichnung gebaut.');
  return DrawDouble.last;
}

class ModeDouble {
  constructor(readonly options: unknown) {}
}

const loader = (): Promise<TerraModule> =>
  Promise.resolve({
    terra: {
      TerraDraw: DrawDouble,
      TerraDrawPointMode: ModeDouble,
      TerraDrawLineStringMode: ModeDouble,
      TerraDrawPolygonMode: ModeDouble,
      TerraDrawSelectMode: ModeDouble,
    },
    adapter: { TerraDrawMapLibreGLAdapter: ModeDouble },
  } as unknown as TerraModule);

/** Eine Karte, die mitschreibt, welche Ebenen und Daten sie bekommen hat. */
class MapDouble {
  readonly layers: string[] = [];
  data: {
    features: { geometry: { type: string }; properties?: Record<string, unknown> }[];
  } | null = null;
  private has = false;

  getSource(): unknown {
    return this.has ? { setData: (next: unknown) => (this.data = next as never) } : undefined;
  }

  addSource(_id: string, source: { data: unknown }): void {
    this.has = true;
    this.data = source.data as never;
  }

  addLayer(layer: { id: string }): void {
    this.layers.push(layer.id);
  }

  getLayer(id: string): unknown {
    return this.layers.includes(id) ? {} : undefined;
  }

  removeLayer(id: string): void {
    this.layers.splice(this.layers.indexOf(id), 1);
  }

  removeSource(): void {
    this.has = false;
  }

  once(): void {
    // Der Stil steht in der Attrappe sofort.
  }
}

function map(): MapLibreMap {
  return new MapDouble() as unknown as MapLibreMap;
}

describe('geometrieFuer', () => {
  it('macht aus einem Punkt einen Punkt, aus zwei eine Linie, aus dreien eine Fläche', () => {
    expect(geometryFor([])).toBeNull();
    expect(geometryFor(RING.slice(0, 1))?.mode).toBe('point');
    expect(geometryFor(RING.slice(0, 2))?.mode).toBe('linestring');
    const surface = geometryFor(RING);
    expect(surface?.mode).toBe('polygon');
    expect((surface?.geometry as { coordinates: number[][][] }).coordinates[0]).toHaveLength(4);
  });
});

describe('starteZeichnen', () => {
  it('startet im Auswahlmodus, damit ein Tipp nichts zeichnet', async () => {
    await startDrawing(map(), '#004225', loader);

    expect(DrawDouble.last?.started).toBe(1);
    expect(DrawDouble.last?.modi).toEqual(['select']);
  });

  it('malt den Ring als eigene Ebenen mit einem Punkt je Ecke', async () => {
    const surface = new MapDouble();
    const session = await startDrawing(surface as unknown as MapLibreMap, '#004225', loader);

    session.showRing(RING);

    expect(surface.layers).toEqual([
      'pilz-ring-fill',
      'pilz-ring-line',
      'pilz-ring-preview',
      'pilz-ring-corners',
      'pilz-ring-mark',
    ]);
    const kinds = surface.data?.features.map((feature) => feature.geometry.type);
    expect(kinds).toEqual(['Polygon', 'Point', 'Point', 'Point']);
    expect(DrawDouble.last?.features).toHaveLength(0);
  });

  it('hängt den Ring am Rechner an den Zeiger', async () => {
    const surface = new MapDouble();
    const session = await startDrawing(surface as unknown as MapLibreMap, '#004225', loader);

    session.showRing(RING, { pointer: [9.1, 48.6] });

    const kinds = surface.data?.features.map((feature) => feature.geometry.type);
    expect(kinds).toEqual(['Polygon', 'Point', 'Point', 'Point', 'LineString', 'LineString', 'LineString']);
    const closing = surface.data?.features.at(-1)?.properties?.['closing'];
    expect(closing).toBe(true);
  });

  it('malt den gesetzten Ort als Marke', async () => {
    const surface = new MapDouble();
    const session = await startDrawing(surface as unknown as MapLibreMap, '#004225', loader);

    session.showRing([], { mark: [9.05, 48.52] });

    const marks = surface.data?.features.filter((feature) => feature.properties?.['mark'] === true);
    expect(marks).toHaveLength(1);
  });

  it('malt nur Punkte, solange die Fläche noch fehlt', async () => {
    const surface = new MapDouble();
    const session = await startDrawing(surface as unknown as MapLibreMap, '#004225', loader);

    session.showRing(RING.slice(0, 2));

    const kinds = surface.data?.features.map((feature) => feature.geometry.type);
    expect(kinds).toEqual(['Point', 'Point']);
  });

  it('nimmt die Ebenen weg, sobald die Eckpunkte gezogen werden', async () => {
    const surface = new MapDouble();
    const session = await startDrawing(surface as unknown as MapLibreMap, '#004225', loader);
    session.showRing(RING);

    session.edit(() => undefined);

    expect(surface.layers).toEqual([]);
    expect(DrawDouble.last?.features[0].geometry.type).toBe('Polygon');
  });

  it('meldet den verschobenen Ring ohne den doppelten Endpunkt', async () => {
    const session = await startDrawing(map(), '#004225', loader);
    session.showRing(RING);
    const dragged: Location[][] = [];
    session.edit((ring) => dragged.push(ring));
    const draw = drawDouble();
    draw.snapshot = {
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [9, 48.5],
            [9.2, 48.5],
            [9.2, 48.7],
            [9, 48.5],
          ],
        ],
      },
    };

    draw.patch?.();

    expect(dragged[0]).toEqual([
      [9, 48.5],
      [9.2, 48.5],
      [9.2, 48.7],
    ]);
  });

  it('meldet nichts, wenn der Schnappschuss keine Fläche ist', async () => {
    const session = await startDrawing(map(), '#004225', loader);
    session.showRing(RING);
    const dragged: Location[][] = [];
    session.edit((ring) => dragged.push(ring));
    const draw = drawDouble();
    draw.snapshot = { geometry: { type: 'Point', coordinates: [9, 48] } };

    draw.patch?.();

    expect(dragged).toHaveLength(0);
  });

  it('lässt nichts auswählen, solange kein Ring liegt', async () => {
    const session = await startDrawing(map(), '#004225', loader);

    session.edit(() => undefined);

    expect(DrawDouble.last?.selected).toEqual([]);
  });

  it('räumt beim Beenden auf', async () => {
    const session = await startDrawing(map(), '#004225', loader);

    session.stop();

    expect(DrawDouble.last?.stopped).toBe(1);
  });
});
