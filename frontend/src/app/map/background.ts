import type { StyleSpecification } from 'maplibre-gl';
import type { Bounds } from './map-adapter';
import type { EffectiveTheme } from '../core/theme/theme.store';

/** The background map comes from OpenFreeMap: free, without a key, light and dark. */
export const BACKGROUND: Record<EffectiveTheme, string> = {
  hell: 'https://tiles.openfreemap.org/styles/liberty',
  dunkel: 'https://tiles.openfreemap.org/styles/dark',
};

/** The choices of the layers sheet. "map" follows the app theme, "light" and "dark" are fixed. */
export type Background = 'map' | 'light' | 'dark' | 'topo' | 'satellite';

export const BACKGROUNDS: readonly Background[] = ['map', 'light', 'dark', 'topo', 'satellite'];

/** TopPlusOpen of the BKG: a free topographic raster map with relief, licence dl-de/by-2-0. */
export const TOPO_TILES =
  'https://sgx.geodatenzentrum.de/wmts_topplus_open/tile/1.0.0/web/default/WEBMERCATOR/{z}/{y}/{x}.png';

/** Sen2Europe of the BKG: a free Sentinel-2 mosaic of 10 m. The BKG gives no free aerial photo for all of Germany. */
export const AERIAL_TILES =
  'https://sgx.geodatenzentrum.de/wms_sen2europe?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=rgb&STYLES=' +
  '&CRS=EPSG:3857&BBOX={bbox-epsg-3857}&WIDTH=256&HEIGHT=256&FORMAT=image/jpeg';

/** A style with one raster source. The object layers need no glyphs, so the style has none. */
function tiledStyle(tiles: string, maxzoom: number): StyleSpecification {
  return {
    version: 8,
    sources: { ground: { type: 'raster', tiles: [tiles], tileSize: 256, maxzoom } },
    layers: [{ id: 'ground', type: 'raster', source: 'ground' }],
  };
}

export const TOPO_STYLE = tiledStyle(TOPO_TILES, 18);
export const AERIAL_STYLE = tiledStyle(AERIAL_TILES, 14);

/** The style of a choice. */
export function styleFor(choice: Background, theme: EffectiveTheme): string | StyleSpecification {
  if (choice === 'topo') return TOPO_STYLE;
  if (choice === 'satellite') return AERIAL_STYLE;
  if (choice === 'light') return BACKGROUND.hell;
  if (choice === 'dark') return BACKGROUND.dunkel;
  return BACKGROUND[theme];
}

/** Germany as [longitude, latitude]. The map fits it when it opens. */
export const GERMANY: Bounds = [
  [5.7, 47.2],
  [15.1, 55.1],
];

/** The limit of a pan. Six degrees of margin keep the space below the sheet inside the limit. */
export const MAX_BOUNDS: Bounds = [
  [-1.0, 40.5],
  [22.0, 59.5],
];

/** Zoom levels of the 512 px style: 4 shows all of Germany, 14 is the last level of the vector style. */
export const ZOOM_MIN = 4;
export const ZOOM_MAX = 14;
