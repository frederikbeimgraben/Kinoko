import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl';
import type { Location } from './add-entry.state';

/** Die Kennungen der Ebenen, die den Schritt auf die Karte malen. */
const SOURCE = 'pilz-ring';
const FILL = 'pilz-ring-fill';
const LINE = 'pilz-ring-line';
const PREVIEW = 'pilz-ring-preview';
const CORNERS = 'pilz-ring-corners';
const MARK = 'pilz-ring-mark';

/** Maße und Farben aus den Brettern `ZoneDraw` und `MapDesktopZoneDraw`. */
const OUTLINE_WIDTH = 2;
const DASH = [3, 2];
const FILL_OPACITY = 0.18;
const CORNER_RADIUS = 6;
/** Die erste Ecke steht dicker: ein Klick darauf schließt den Ring. */
const FIRST_RADIUS = 8;
/** Die Kante zur ersten Ecke steht schwächer als die zum Zeiger. */
const CLOSING_OPACITY = 0.5;
/** Der gesetzte Ort aus dem Brett `MapDesktopFindLocation`. */
const MARK_RADIUS = 8;

/** Was ein Schritt gerade auf die Karte malt. */
export interface StepView {
  /** Die gesetzten Ecken der Zone. */
  ring?: readonly Location[];
  /** Der Ort unter dem Zeiger, nur am Rechner. */
  pointer?: Location | null;
  /** Der gesetzte Ort eines Fundes oder eines Markers. */
  mark?: Location | null;
}

function line(points: readonly Location[], colour: string, closing = false): GeoJSON.Feature {
  return {
    type: 'Feature',
    properties: { colour, closing },
    geometry: { type: 'LineString', coordinates: points.map((point) => [point[0], point[1]]) },
  };
}

function features(view: StepView, colour: string): GeoJSON.FeatureCollection {
  const ring = view.ring ?? [];
  const pointer = view.pointer ?? null;
  const found: GeoJSON.Feature[] = ring.map((point, index) => ({
    type: 'Feature',
    properties: { colour, mark: false, first: index === 0 && pointer !== null },
    geometry: { type: 'Point', coordinates: [point[0], point[1]] },
  }));
  if (view.mark) {
    found.push({
      type: 'Feature',
      properties: { colour, mark: true },
      geometry: { type: 'Point', coordinates: [view.mark[0], view.mark[1]] },
    });
  }
  if (ring.length >= 3) {
    const closed = [...ring, ring[0]].map((point) => [point[0], point[1]]);
    found.unshift({
      type: 'Feature',
      properties: { colour },
      geometry: { type: 'Polygon', coordinates: [closed] },
    });
  }
  // Am Rechner hängt der Ring am Zeiger: die offene Kette, die Vorschau-Kante
  // und schwächer die Kante zurück zur ersten Ecke.
  if (pointer !== null && ring.length > 0) {
    if (ring.length > 1) found.push(line(ring, colour));
    found.push(line([ring[ring.length - 1], pointer], colour));
    found.push(line([pointer, ring[0]], colour, true));
  }
  return { type: 'FeatureCollection', features: found };
}

/** Malt den Schritt: Ring, Vorschau am Zeiger und den gesetzten Ort. */
export function paintRing(
  map: MapLibreMap,
  ring: readonly Location[],
  colour: string,
  view: StepView = {},
): void {
  const data = features({ ...view, ring }, colour);
  const source: GeoJSONSource | undefined = map.getSource(SOURCE);
  if (source === undefined) {
    // Der Stil kommt über das Netz. Vor ihm nimmt die Karte keine Ebene an.
    try {
      map.addSource(SOURCE, { type: 'geojson', data });
    } catch {
      map.once('styledata', () => {
        paintRing(map, ring, colour, view);
      });
      return;
    }
    map.addLayer({
      id: FILL,
      type: 'fill',
      source: SOURCE,
      filter: ['==', ['geometry-type'], 'Polygon'],
      paint: { 'fill-color': colour, 'fill-opacity': FILL_OPACITY },
    });
    map.addLayer({
      id: LINE,
      type: 'line',
      source: SOURCE,
      filter: ['==', ['geometry-type'], 'Polygon'],
      paint: { 'line-color': colour, 'line-width': OUTLINE_WIDTH, 'line-dasharray': DASH },
    });
    map.addLayer({
      id: PREVIEW,
      type: 'line',
      source: SOURCE,
      filter: ['==', ['geometry-type'], 'LineString'],
      paint: {
        'line-color': colour,
        'line-width': OUTLINE_WIDTH,
        'line-dasharray': DASH,
        'line-opacity': ['case', ['get', 'closing'], CLOSING_OPACITY, 1],
      },
    });
    map.addLayer({
      id: CORNERS,
      type: 'circle',
      source: SOURCE,
      filter: ['all', ['==', ['geometry-type'], 'Point'], ['!=', ['get', 'mark'], true]],
      paint: {
        'circle-radius': ['case', ['get', 'first'], FIRST_RADIUS, CORNER_RADIUS],
        'circle-color': ['case', ['get', 'first'], colour, '#ffffff'],
        'circle-stroke-color': ['case', ['get', 'first'], '#ffffff', colour],
        'circle-stroke-width': OUTLINE_WIDTH,
      },
    });
    map.addLayer({
      id: MARK,
      type: 'circle',
      source: SOURCE,
      filter: ['all', ['==', ['geometry-type'], 'Point'], ['==', ['get', 'mark'], true]],
      paint: {
        'circle-radius': MARK_RADIUS,
        'circle-color': colour,
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': OUTLINE_WIDTH,
      },
    });
    return;
  }
  void source.setData(data);
}

/** Nimmt die Ebenen des Schritts wieder von der Karte. */
export function clearRing(map: MapLibreMap): void {
  for (const layer of [FILL, LINE, PREVIEW, CORNERS, MARK]) {
    if (map.getLayer(layer) !== undefined) map.removeLayer(layer);
  }
  if (map.getSource(SOURCE) !== undefined) map.removeSource(SOURCE);
}
