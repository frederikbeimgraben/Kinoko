/** Die eigenen Einträge des Vertrags: Funde, Marker und Zonen. */

import type { components } from '../contract';
import type { SharedFind } from './finds';

export type Visibility = components['schemas']['Visibility'];
export type MarkerColour = components['schemas']['MarkerColour'];
export type GeoPolygon = components['schemas']['GeoPolygon'];

export type FindWrite = components['schemas']['FindWrite'];
export type MarkerWrite = components['schemas']['MarkerWrite'];
export type ZoneWrite = components['schemas']['ZoneWrite'];
export type ZoneValue = components['schemas']['ZoneValue'];

/** Wer ein Objekt sehen darf. */
export const VISIBILITIES: readonly Visibility[] = ['private', 'shared'];

/** Die sechs Farben aus den Mockups. Eine freie Farbwahl gibt es nicht. */
export const MARKER_COLOURS: readonly MarkerColour[] = ['green', 'brown', 'blue', 'red', 'gold', 'grey'];

/** Ein eigener Fund, mit genauem Ort. */
export interface Find extends SharedFind {
  visibility: Visibility;
  forTraining: boolean;
}

/** Ein eigener Marker: ein Punkt mit Name, Farbe und Notiz. */
export interface Marker {
  id: string;
  name: string;
  lat: number;
  lon: number;
  colour: MarkerColour;
  note: string | null;
  visibility: Visibility;
}

/** Eine eigene Zone. Die Fläche rechnet der Dienst, nie das Gerät. */
export interface Zone {
  id: string;
  name: string;
  polygon: GeoPolygon;
  areaHa: number;
  colour: MarkerColour;
  note: string | null;
  visibility: Visibility;
}
