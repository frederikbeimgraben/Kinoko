import type { Bounds } from './map-adapter';
import type { EffectiveTheme } from '../core/theme/theme.store';

/** The background map comes from OpenFreeMap: free, without a key, light and dark. */
export const BACKGROUND: Record<EffectiveTheme, string> = {
  hell: 'https://tiles.openfreemap.org/styles/liberty',
  dunkel: 'https://tiles.openfreemap.org/styles/dark',
};

/**
 * The choices of the layers sheet. "map" follows the theme of the app, "light" and "dark" are fixed.
 * Topo and satellite have no source yet.
 */
export type Background = 'map' | 'light' | 'dark' | 'topo' | 'satellite';

export const BACKGROUNDS: readonly Background[] = ['map', 'light', 'dark', 'topo', 'satellite'];

/** Topo and satellite are not available yet. */
export function backgroundAvailable(choice: Background): boolean {
  return choice === 'map' || choice === 'light' || choice === 'dark';
}

/** The style of a choice. */
export function styleFor(choice: Background, theme: EffectiveTheme): string {
  if (choice === 'light') return BACKGROUND.hell;
  if (choice === 'dark') return BACKGROUND.dunkel;
  return BACKGROUND[theme];
}

/** Germany as [longitude, latitude]. The map fits it when it opens. */
export const GERMANY: Bounds = [
  [5.7, 47.2],
  [15.1, 55.1],
];

/**
 * The limit of a pan. The margin of six degrees is wide on purpose: the map centres
 * Germany above the sheet, so the space below the sheet must also be inside the limit.
 */
export const MAX_BOUNDS: Bounds = [
  [-1.0, 40.5],
  [22.0, 59.5],
];

/**
 * MapLibre counts zoom levels for 512 px tiles, one level below the 256 px value tiles.
 * Thus 4 is level 5 of the value tiles, with all of Germany. 14 is the last level of the vector style.
 */
export const ZOOM_MIN = 4;
export const ZOOM_MAX = 14;
