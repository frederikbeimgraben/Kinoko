import type { Find, Marker, SharedFind, SpeciesEntry, Zone } from '../../core/api/models';
import { asDate, shortDate } from '../../core/i18n/dates';
import type { I18nService } from '../../core/i18n/i18n.service';
import { grouped, joined } from '../../core/i18n/numbers';
import type { SyncTask } from '../../core/offline/sync.types';
import type { EntryListRow } from '../../ui/entry-list/entry-list.component';
import type { IconName } from '../../ui/svg-icon/svg-icon.component';
import { visibilityText } from '../add-entry/visibility';
import type { ObjectKind } from '../map/map.store';
import { capColour } from './cap-colour';
import { colourToken } from './colors';
import type { EntryBody } from './entries.store';
import { hectaresText, isoDatum } from './formats';

/** The three lists of the entry tab, per the chips of `Entries.dc.html`. */
export type Segment = 'finds' | 'markers' | 'zones';

/** One row of the list, ready for the template. */
export interface EntryRow extends EntryListRow {
  /** The object that the row opens, `null` for a pending entry or a find of another person. */
  readonly object: { kind: ObjectKind; id: string } | null;
  /** The ISO day that sorts the row. */
  readonly sortKey: string;
  /** Sorts the rows of one day: the instant of the save, newest first. A pending row is on top. */
  readonly order?: string;
}

/** The order of a pending row: it is above each saved row of its day. */
const PENDING_ORDER = '\uffff';

/** What the rows need besides the entries. */
export interface RowContext {
  readonly i18n: I18nService;
  /** The day of the list as an ISO date. */
  readonly today: string;
  readonly species: (id: string | null | undefined) => SpeciesEntry | null;
  /** The first name of the signed-in person. */
  readonly reporter: string;
  /** The first name of another person, `null` while it is not known. */
  readonly person: (ownerId: string) => string | null;
  /** The path of the thumb of an own find, `undefined` for a find without a photo. */
  readonly photo?: (findId: string) => string | undefined;
}

/** The label of the day group: "Today", or the month, with the year when it is not this year. */
export function dayLabel(iso: string, today: string, i18n: I18nService): string {
  if (iso === today) return i18n.translate('common.today');
  const day = asDate(iso);
  const month = i18n.translate(`enum.month.${day.getMonth() + 1}` as 'enum.month.1');
  return day.getFullYear() === asDate(today).getFullYear() ? month : `${month} ${String(day.getFullYear())}`;
}

/** The local day of an instant from the service. */
function dayOf(instant: string | undefined): string | null {
  return instant ? isoDatum(new Date(instant)) : null;
}

/** The meta line of a find: the day (not for today), the count and the person. */
function findMeta(
  context: RowContext,
  foundOn: string,
  count: number | null | undefined,
  person: string | null,
): string {
  return joined([
    foundOn === context.today ? null : shortDate(foundOn, context.i18n),
    count === null || count === undefined
      ? null
      : context.i18n.translate('find.pieces', { count: grouped(count) }),
    person,
  ]);
}

function findRow(
  context: RowContext,
  key: string,
  find: Pick<SharedFind, 'speciesId' | 'foundOn' | 'count' | 'note'>,
  person: string | null,
  extra: { pending: boolean; object: EntryRow['object']; order?: string; photo?: string },
): EntryRow {
  const { photo, ...rest } = extra;
  const species = context.species(find.speciesId);
  return {
    key,
    day: dayLabel(find.foundOn, context.today, context.i18n),
    sortKey: find.foundOn,
    entry: {
      title: species?.name ?? context.i18n.translate('find.unknownSpecies'),
      meta: findMeta(context, find.foundOn, find.count, person),
      note: find.note ?? undefined,
      colour: capColour(species),
      photo,
      icon: 'mushroom',
    },
    ...rest,
  };
}

export function ownFindRow(context: RowContext, find: Find): EntryRow {
  return findRow(context, `find-${find.id}`, find, context.reporter, {
    pending: false,
    object: { kind: 'find', id: find.id },
    order: find.createdAt,
    photo: context.photo?.(find.id),
  });
}

export function sharedFindRow(context: RowContext, find: SharedFind): EntryRow {
  return findRow(context, `shared-${find.id}`, find, context.person(find.ownerId), {
    pending: false,
    object: null,
  });
}

function placeRow(
  context: RowContext,
  kind: 'marker' | 'zone',
  item: Marker | Zone,
  meta: string,
  icon: IconName,
): EntryRow {
  const day = dayOf(item.createdAt);
  return {
    key: `${kind}-${item.id}`,
    day: day === null ? undefined : dayLabel(day, context.today, context.i18n),
    sortKey: day ?? '',
    order: item.createdAt,
    entry: { title: item.name, meta, note: item.note ?? undefined, colour: colourToken(item.colour), icon },
    pending: false,
    object: { kind, id: item.id },
  };
}

export function markerRow(context: RowContext, marker: Marker): EntryRow {
  const day = dayOf(marker.createdAt);
  // Below "Today" the day is the group label already, as for a find.
  const meta = joined([
    day === null || day === context.today ? null : shortDate(day, context.i18n),
    visibilityText(context.i18n, marker.visibility),
  ]);
  return placeRow(context, 'marker', marker, meta, 'flag');
}

export function zoneRow(context: RowContext, zone: Zone): EntryRow {
  const meta = joined([
    context.i18n.translate('area.hectares', { area: hectaresText(zone.areaHa, context.i18n.locale()) }),
    visibilityText(context.i18n, zone.visibility),
  ]);
  return placeRow(context, 'zone', zone, meta, 'zone');
}

/** A new entry that waits for the transfer. It carries the upload mark. */
export function pendingRow(context: RowContext, task: SyncTask<EntryBody>): EntryRow {
  const body = task.body;
  const created = isoDatum(new Date(task.createdAt));
  if ('foundOn' in body) {
    return findRow(
      context,
      `waiting-${task.id}`,
      { ...body, note: body.note ?? null, speciesId: body.speciesId ?? null, count: body.count ?? null },
      context.reporter,
      { pending: true, object: null, order: PENDING_ORDER },
    );
  }
  return {
    key: `waiting-${task.id}`,
    day: dayLabel(created, context.today, context.i18n),
    sortKey: created,
    order: PENDING_ORDER,
    entry: {
      title: body.name,
      meta: visibilityText(context.i18n, body.visibility ?? 'private'),
      note: body.note ?? undefined,
      colour: body.colour === undefined ? undefined : colourToken(body.colour),
      icon: 'polygon' in body ? 'zone' : 'flag',
    },
    pending: true,
    object: null,
  };
}

/** Newest first, by day and then by the instant of the save. Pending rows are on top of their day. */
export function byDay(rows: readonly EntryRow[]): readonly EntryRow[] {
  const descending = (left: string, right: string): number => (left === right ? 0 : left < right ? 1 : -1);
  return [...rows].sort(
    (left, right) =>
      descending(left.sortKey, right.sortKey) || descending(left.order ?? '', right.order ?? ''),
  );
}
