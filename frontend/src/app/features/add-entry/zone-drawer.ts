import { InjectionToken } from '@angular/core';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { clearRing, paintRing, type StepView } from './step-painter';
import type { Location } from './add-entry.store';

/** A ring, as Terra Draw gives it back after a drag. */
export type RingListener = (ring: Location[]) => void;

/** Terra Draw over the map: it draws the ring and lets the finger drag its corners. */
export interface DrawSession {
  /** Puts the ring on the map again. An empty ring removes it. */
  showRing(ring: readonly Location[], view?: StepView): void;
  /** Sets the select mode: the corners can move. */
  edit(handler: RingListener): void;
  stop(): void;
}

/** Terra Draw refuses coordinates with more decimals. Six decimals are approximately 11 cm. */
const DECIMALS = 1e6;

function gerundet(location: Location): [number, number] {
  return [Math.round(location[0] * DECIMALS) / DECIMALS, Math.round(location[1] * DECIMALS) / DECIMALS];
}

/** The shapes that Terra Draw keeps for each number of corners. */
export type Geometry =
  | { type: 'Point'; coordinates: [number, number] }
  | { type: 'LineString'; coordinates: [number, number][] }
  | { type: 'Polygon'; coordinates: [number, number][][] };

/** The shape of a ring. Terra Draw accepts only features of its modes, and two points are not an area. */
export function geometryFor(ring: readonly Location[]): { geometry: Geometry; mode: string } | null {
  if (ring.length === 0) return null;
  if (ring.length === 1)
    return { geometry: { type: 'Point', coordinates: gerundet(ring[0]) }, mode: 'point' };
  const punkte = ring.map(gerundet);
  if (ring.length === 2) {
    return { geometry: { type: 'LineString', coordinates: punkte }, mode: 'linestring' };
  }
  return { geometry: { type: 'Polygon', coordinates: [[...punkte, punkte[0]]] }, mode: 'polygon' };
}

/** Terra Draw and its MapLibre adapter. */
export interface TerraModule {
  terra: typeof import('terra-draw');
  adapter: typeof import('terra-draw-maplibre-gl-adapter');
}

/** Loads both as a separate chunk, only when an area is necessary. */
export type TerraLoader = () => Promise<TerraModule>;

const defaultLoader: TerraLoader = async () => {
  const [terra, adapter] = await Promise.all([
    import('terra-draw'),
    import('terra-draw-maplibre-gl-adapter'),
  ]);
  return { terra, adapter };
};

/** The corner edit in the zone colour, with the white corner handles of the draw step (`ZoneDraw`). */
export function selectStyles(farbe: `#${string}`) {
  return {
    selectedPolygonColor: farbe,
    selectedPolygonFillOpacity: 0.18,
    selectedPolygonOutlineColor: farbe,
    selectedPolygonOutlineWidth: 3,
    selectionPointColor: '#ffffff',
    selectionPointWidth: 7,
    selectionPointOutlineColor: farbe,
    selectionPointOutlineWidth: 3,
    midPointColor: farbe,
    midPointWidth: 4,
    midPointOutlineColor: '#ffffff',
    midPointOutlineWidth: 2,
  } as const;
}

/** Starts Terra Draw on the map. The step sets the corners, Terra Draw then moves them. */
export async function startDrawing(
  map: MapLibreMap,
  farbe: `#${string}`,
  load: TerraLoader = defaultLoader,
): Promise<DrawSession> {
  const { terra, adapter } = await load();
  const draw = new terra.TerraDraw({
    adapter: new adapter.TerraDrawMapLibreGLAdapter({ map: map }),
    modes: [
      new terra.TerraDrawPointMode({ styles: { pointColor: farbe } }),
      new terra.TerraDrawLineStringMode({ styles: { lineStringColor: farbe } }),
      new terra.TerraDrawPolygonMode({
        styles: { fillColor: farbe, outlineColor: farbe, outlineWidth: 2, fillOpacity: 0.18 },
      }),
      new terra.TerraDrawSelectMode({
        styles: selectStyles(farbe),
        flags: {
          polygon: {
            feature: {
              draggable: false,
              coordinates: { midpoints: true, draggable: true, deletable: true },
            },
          },
        },
      }),
    ],
  });
  draw.start();
  // Only the select mode draws nothing on a tap. The ring comes in only through `showRing`.
  draw.setMode('select');

  let id: string | number | null = null;

  let held: readonly Location[] = [];

  return {
    // While the step draws, own layers paint the ring: Terra Draw has no dashes and no corner marks.
    showRing: (ring, view) => {
      held = ring;
      draw.clear();
      id = null;
      paintRing(map, ring, farbe, view);
    },
    edit: (handler) => {
      clearRing(map);
      const form = geometryFor(held);
      if (form === null) return;
      id = draw.getFeatureId();
      draw.addFeatures([
        { id: id, type: 'Feature', geometry: form.geometry, properties: { mode: form.mode } },
      ]);
      draw.selectFeature(id);
      draw.on('change', () => {
        const feature = id === null ? undefined : draw.getSnapshotFeature(id);
        if (feature?.geometry.type !== 'Polygon') return;
        // The closed ring has the first point twice. The step counts corners, not ring points.
        const punkte = feature.geometry.coordinates[0].slice(0, -1);
        handler(punkte.map((point) => [point[0], point[1]] as Location));
      });
    },
    stop: () => {
      clearRing(map);
      draw.clear();
      draw.stop();
    },
  };
}

/** The drawer behind a token, so a test can give it without WebGL. */
export const ZONE_DRAWER = new InjectionToken<typeof startDrawing>('ZonenZeichner', {
  providedIn: 'root',
  factory: () => startDrawing,
});
