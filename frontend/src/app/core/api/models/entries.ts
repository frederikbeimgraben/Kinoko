/** The own entries of the contract: finds, markers and zones. */

import type { components } from '../contract';
import type { SharedFind } from './finds';

export type Visibility = components['schemas']['Visibility'];
export type MarkerColour = components['schemas']['MarkerColour'];
export type GeoPolygon = components['schemas']['GeoPolygon'];

export type FindWrite = components['schemas']['FindWrite'];
export type MarkerWrite = components['schemas']['MarkerWrite'];
export type ZoneWrite = components['schemas']['ZoneWrite'];
export type ZoneValue = components['schemas']['ZoneValue'];

/** Who can see an object. */
export const VISIBILITIES: readonly Visibility[] = ['private', 'shared'];

/** The six colours of the mockups. There is no free choice of a colour. */
export const MARKER_COLOURS: readonly MarkerColour[] = ['green', 'yellow', 'orange', 'red', 'violet', 'grey'];

/** An own find, with its exact place. */
export interface Find extends SharedFind {
  visibility: Visibility;
  groupId: string | null;
  forTraining: boolean;
}

/** An own marker: a point with a name, a colour and a note. */
export interface Marker {
  id: string;
  name: string;
  lat: number;
  lon: number;
  colour: MarkerColour;
  note: string | null;
  visibility: Visibility;
  groupId: string | null;
  /** The instant of the first save. The entry list groups by it. */
  createdAt?: string;
}

/** An own zone. The service calculates the area, never the device. */
export interface Zone {
  id: string;
  name: string;
  polygon: GeoPolygon;
  areaHa: number;
  colour: MarkerColour;
  note: string | null;
  visibility: Visibility;
  groupId: string | null;
  /** The instant of the first save. The entry list groups by it. */
  createdAt?: string;
}
