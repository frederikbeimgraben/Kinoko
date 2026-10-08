import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl';
import type { Location } from './add-entry.store';

/** The identifiers of the layers that draw the step on the map. */
const SOURCE = 'pilz-ring';
const FILL = 'pilz-ring-fill';
const LINE = 'pilz-ring-line';
const PREVIEW = 'pilz-ring-preview';
const CORNERS = 'pilz-ring-corners';
const MARK = 'pilz-ring-mark';

/** Sizes from the boards `ZoneDraw` and `MapDesktopZoneDraw`. The desktop lines and corners are thicker. */
interface RingStyle {
  readonly width: number;
  readonly dash: readonly number[];
  readonly corner: number;
}

const PHONE_STYLE: RingStyle = { width: 3, dash: [2, 1.33], corner: 7 };
const DESKTOP_STYLE: RingStyle = { width: 5, dash: [2.4, 1.6], corner: 12 };
const FILL_OPACITY = 0.18;
/** The first corner is larger while the pointer is on it: a click there closes the ring. */
const FIRST_GROWTH = 2;
/** The edge back to the first corner is less prominent than the edge to the pointer. */
const CLOSING_OPACITY = 0.5;
/** The set point of the board `MapDesktopFindLocation`. */
const MARK_RADIUS = 8;

/** What a step draws on the map. */
export interface StepView {
  /** The set corners of the zone. */
  ring?: readonly Location[];
  /** The point below the pointer, only on the desktop. */
  pointer?: Location | null;
  /** The pointer is on the first corner, so a click closes the ring. */
  closing?: boolean;
  /** The set point of a find or a marker. */
  mark?: Location | null;
  /** The desktop draws the thicker lines of its board. */
  wide?: boolean;
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
    properties: { colour, mark: false, first: index === 0 && view.closing === true },
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
  // On the desktop, the ring follows the pointer: the open chain, the preview edge and the edge back to the start.
  if (pointer !== null && ring.length > 0) {
    if (ring.length > 1) found.push(line(ring, colour));
    found.push(line([ring[ring.length - 1], pointer], colour));
    found.push(line([pointer, ring[0]], colour, true));
  }
  return { type: 'FeatureCollection', features: found };
}

/** Draws the step: the ring, the preview at the pointer and the set point. */
export function paintRing(
  map: MapLibreMap,
  ring: readonly Location[],
  colour: string,
  view: StepView = {},
): void {
  const data = features({ ...view, ring }, colour);
  const style = view.wide ? DESKTOP_STYLE : PHONE_STYLE;
  const source: GeoJSONSource | undefined = map.getSource(SOURCE);
  if (source === undefined) {
    // The style comes over the network. Before it, the map takes no layer.
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
      paint: { 'line-color': colour, 'line-width': style.width, 'line-dasharray': [...style.dash] },
    });
    map.addLayer({
      id: PREVIEW,
      type: 'line',
      source: SOURCE,
      filter: ['==', ['geometry-type'], 'LineString'],
      paint: {
        'line-color': colour,
        'line-width': style.width,
        'line-dasharray': [...style.dash],
        'line-opacity': ['case', ['get', 'closing'], CLOSING_OPACITY, 1],
      },
    });
    map.addLayer({
      id: CORNERS,
      type: 'circle',
      source: SOURCE,
      filter: ['all', ['==', ['geometry-type'], 'Point'], ['!=', ['get', 'mark'], true]],
      paint: {
        'circle-radius': ['case', ['get', 'first'], style.corner + FIRST_GROWTH, style.corner],
        'circle-color': ['case', ['get', 'first'], colour, '#ffffff'],
        'circle-stroke-color': ['case', ['get', 'first'], '#ffffff', colour],
        'circle-stroke-width': style.width,
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
        'circle-stroke-width': PHONE_STYLE.width,
      },
    });
    return;
  }
  void source.setData(data);
}

/** Removes the layers of the step from the map. */
export function clearRing(map: MapLibreMap): void {
  for (const layer of [FILL, LINE, PREVIEW, CORNERS, MARK]) {
    if (map.getLayer(layer) !== undefined) map.removeLayer(layer);
  }
  if (map.getSource(SOURCE) !== undefined) map.removeSource(SOURCE);
}
