// The Web Mercator (XYZ) tile grid. The forecast uses it to find the visible tiles.
// It preloads only these tiles for the next weeks, not a full week.

/** A map extent in degrees. */
export interface Viewbox {
  west: number;
  south: number;
  ost: number;
  nord: number;
}

/** The tile that contains a point at this zoom level. */
export function tileIndex(length: number, breite: number, zoom: number): [number, number] {
  const n = 2 ** zoom;
  const sinus = Math.sin((Math.min(Math.max(breite, -85.05), 85.05) * Math.PI) / 180);
  const x = Math.floor(((length + 180) / 360) * n);
  const y = Math.floor((0.5 - Math.log((1 + sinus) / (1 - sinus)) / (4 * Math.PI)) * n);
  const last = n - 1;
  return [Math.min(Math.max(x, 0), last), Math.min(Math.max(y, 0), last)];
}

/** The tiles under the extent. Clamps the zoom to the rendered levels, because MapLibre upscales above them. */
export function visibleTiles(
  extent: Viewbox,
  zoom: number,
  zoomFrom: number,
  zoomTo: number,
): [number, number, number][] {
  const stufe = Math.round(Math.min(Math.max(zoom, zoomFrom), zoomTo));
  const [x0, y0] = tileIndex(extent.west, extent.nord, stufe);
  const [x1, y1] = tileIndex(extent.ost, extent.south, stufe);
  const tiles: [number, number, number][] = [];
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) tiles.push([stufe, x, y]);
  return tiles;
}
