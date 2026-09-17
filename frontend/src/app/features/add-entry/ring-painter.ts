import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl';
import type { Location } from './add-entry.state';

/** Die Kennungen der Ebenen, die den Ring beim Zeichnen tragen. */
const SOURCE = 'pilz-ring';
const FILL = 'pilz-ring-fill';
const LINE = 'pilz-ring-line';
const CORNERS = 'pilz-ring-corners';

/** Maße und Farben aus dem Brett `ZoneDraw`. */
const OUTLINE_WIDTH = 2;
const DASH = [3, 2];
const FILL_OPACITY = 0.18;
const CORNER_RADIUS = 6;

function features(ring: readonly Location[], colour: string): GeoJSON.FeatureCollection {
  const points: GeoJSON.Feature[] = ring.map((point) => ({
    type: 'Feature',
    properties: { colour },
    geometry: { type: 'Point', coordinates: [point[0], point[1]] },
  }));
  if (ring.length < 3) return { type: 'FeatureCollection', features: points };
  const closed = [...ring, ring[0]].map((point) => [point[0], point[1]]);
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { colour },
        geometry: { type: 'Polygon', coordinates: [closed] },
      },
      ...points,
    ],
  };
}

/** Malt den Ring beim Zeichnen: Strichlinie, Fläche und ein Punkt je Ecke. */
export function paintRing(map: MapLibreMap, ring: readonly Location[], colour: string): void {
  const data = features(ring, colour);
  const source: GeoJSONSource | undefined = map.getSource(SOURCE);
  if (source === undefined) {
    // Der Stil kommt über das Netz. Vor ihm nimmt die Karte keine Ebene an.
    try {
      map.addSource(SOURCE, { type: 'geojson', data });
    } catch {
      map.once('styledata', () => {
        paintRing(map, ring, colour);
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
      id: CORNERS,
      type: 'circle',
      source: SOURCE,
      filter: ['==', ['geometry-type'], 'Point'],
      paint: {
        'circle-radius': CORNER_RADIUS,
        'circle-color': '#ffffff',
        'circle-stroke-color': colour,
        'circle-stroke-width': OUTLINE_WIDTH,
      },
    });
    return;
  }
  void source.setData(data);
}

/** Nimmt die Ebenen des Rings wieder von der Karte. */
export function clearRing(map: MapLibreMap): void {
  for (const layer of [FILL, LINE, CORNERS]) {
    if (map.getLayer(layer) !== undefined) map.removeLayer(layer);
  }
  if (map.getSource(SOURCE) !== undefined) map.removeSource(SOURCE);
}
