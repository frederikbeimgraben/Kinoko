import type {
  Find,
  FindWrite,
  Marker,
  MarkerWrite,
  SharedFind,
  Zone,
  ZoneWrite,
} from '../../core/api/models';
import type { EntriesFilter } from './entry-filter';

/** The result of a save. `abgelehnt`: the service refused the body, so the form stays open. */
export type SaveResult = 'gespeichert' | 'wartet' | 'verworfen' | 'abgelehnt';

/** The body that an object carries on the wire. */
export type EntryBody = FindWrite | MarkerWrite | ZoneWrite;

export interface EntriesState {
  finds: readonly Find[];
  markers: readonly Marker[];
  zones: readonly Zone[];
  /** Shared finds in the last asked view, also of other people. */
  shared: readonly SharedFind[];
  /** The filter of the entry list. */
  filter: EntriesFilter;
}

/** The three own lists, by the name of their state field. */
export type OwnList = 'finds' | 'markers' | 'zones';

/** One item of an own list. */
export type ItemOf<K extends OwnList> = EntriesState[K][number];
