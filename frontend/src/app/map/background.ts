import type { Bounds } from './map-adapter';
import type { EffectiveTheme } from '../core/theme/theme.service';

/**
 * Die Hintergrundkarte kommt von OpenFreeMap: frei, ohne Schlüssel, in hell und
 * dunkel.
 */
export const BACKGROUND: Record<EffectiveTheme, string> = {
  hell: 'https://tiles.openfreemap.org/styles/liberty',
  dunkel: 'https://tiles.openfreemap.org/styles/dark',
};

/** Was der Ebenen-Knopf zur Wahl stellt. Für Topo und Satellit fehlt die Quelle. */
export type Background = 'map' | 'light' | 'topo' | 'satellite';

export const BACKGROUNDS: readonly Background[] = ['map', 'light', 'topo', 'satellite'];

/** Topo und Satellit sind noch nicht wählbar. */
export function backgroundAvailable(choice: Background): boolean {
  return choice === 'map' || choice === 'light';
}

/** Der Stil zur Wahl. „Karte“ folgt dem Theme der App. */
export function styleFor(choice: Background, theme: EffectiveTheme): string {
  return choice === 'light' ? BACKGROUND.hell : BACKGROUND[theme];
}

/** Deutschland als [Länge, Breite]. Darauf wird die Karte beim Öffnen gepasst. */
export const GERMANY: Bounds = [
  [5.7, 47.2],
  [15.1, 55.1],
];

/**
 * Wie weit die Karte geschoben werden darf.
 *
 * Der Rand ist mit gut sechs Grad bewusst breit. Die Karte rechnet ihre Mitte
 * auf den freien Streifen über dem Blatt, schiebt Deutschland also nach oben;
 * unter dem Blatt liegt dann Luft, die innerhalb der Grenze liegen muss. Läge
 * die Grenze an Deutschland selbst, bliebe das Land halb unter dem Blatt.
 */
export const MAX_BOUNDS: Bounds = [
  [-1.0, 40.5],
  [22.0, 59.5],
];

/**
 * MapLibre zählt Zoomstufen für 512er-Kacheln und liegt damit eine Stufe unter
 * der Zählung der Wertkacheln, die 256 Punkte breit sind. Die 4 hier ist also
 * die 5 des Renderings: Deutschland ganz im Bild. Die 14 ist die letzte Stufe,
 * für die der Vektorstil Daten hat.
 */
export const ZOOM_MIN = 4;
export const ZOOM_MAX = 14;
