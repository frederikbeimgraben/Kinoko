import type { SpeciesEntry } from '../../core/api/models';
import type { SyncTask } from '../../core/offline/sync.types';
import { FIND, MARKER, SHARED_FIND, ZONE } from '../../testing/entries-fixture';
import { catalogueOf } from '../../testing/i18n';
import { PENNY_BUN } from '../../testing/species-fixture';
import type { EntryBody } from './entries.store';
import {
  byDay,
  dayLabel,
  markerRow,
  ownFindRow,
  pendingRow,
  sharedFindRow,
  zoneRow,
  type RowContext,
} from './entry-rows';

const i18n = catalogueOf({
  'common.today': 'Today',
  'enum.month.9': 'September',
  'enum.month.12': 'December',
  'find.pieces': '{count} pieces',
  'find.unknownSpecies': 'Unidentified species',
  'sichtbarkeit.private': 'Private',
  'sichtbarkeit.shared': 'Shared',
  'area.hectares': '{area} ha',
});

const CAPPED: SpeciesEntry = {
  ...PENNY_BUN,
  colours: [{ part: 'cap', mode: 'single', colours: [{ name: 'brown', hex: '#5a3d22' }] }],
};

function contextOf(change: Partial<RowContext> = {}): RowContext {
  return {
    i18n,
    today: '2026-09-06',
    species: (id) => (id === CAPPED.id ? CAPPED : null),
    reporter: 'Frida',
    person: (ownerId) => (ownerId === 'konto-zwei' ? 'Max' : null),
    ...change,
  };
}

function task(body: EntryBody, id = 'task-1'): SyncTask<EntryBody> {
  return {
    id,
    kind: 'find',
    operation: 'create',
    target: '',
    body,
    photos: [],
    createdAt: '2026-09-05T10:00:00',
    conflict: false,
  };
}

describe('entry rows', () => {
  it('labels a day as today, as a month, or as a month with a past year', () => {
    expect(dayLabel('2026-09-06', '2026-09-06', i18n)).toBe('Today');
    expect(dayLabel('2026-09-01', '2026-09-06', i18n)).toBe('September');
    expect(dayLabel('2025-12-24', '2026-09-06', i18n)).toBe('December 2025');
  });

  it('shows an own find of today with the cap colour, the count and the reporter', () => {
    const row = ownFindRow(contextOf(), FIND);

    expect(row.object).toEqual({ kind: 'find', id: FIND.id });
    expect(row.entry.title).toBe(CAPPED.name);
    expect(row.entry.colour).toBe('#5a3d22');
    expect(row.entry.meta).toBe('3 pieces · Frida');
    expect(row.day).toBe('Today');
  });

  it('names a shared find of an unknown species and shows no count, note or person', () => {
    const row = sharedFindRow(contextOf({ person: () => null }), {
      ...SHARED_FIND,
      count: null,
      note: null,
    });

    expect(row.object).toBeNull();
    expect(row.entry.title).toBe('Unidentified species');
    expect(row.entry.colour).toBe('#7a5230');
    expect(row.entry.note).toBeUndefined();
    expect(row.entry.meta).not.toContain('pieces');
    expect(row.sortKey).toBe(SHARED_FIND.foundOn);
  });

  it('shows the day and the visibility of a marker, and no day without a creation time', () => {
    const row = markerRow(contextOf(), MARKER);
    expect(row.entry.meta).toContain('private');
    expect(row.entry.colour).toBe('var(--colour-object-blue)');
    expect(row.day).toBe('September');

    const timeless = markerRow(contextOf(), { ...MARKER, createdAt: undefined, note: null });
    expect(timeless.day).toBeUndefined();
    expect(timeless.sortKey).toBe('');
    expect(timeless.entry.meta).toBe('private');
    expect(timeless.entry.note).toBeUndefined();
  });

  it('shows the area of a zone', () => {
    const row = zoneRow(contextOf(), ZONE);

    expect(row.entry.meta).toContain('42');
    expect(row.entry.icon).toBe('zone');
    expect(row.object).toEqual({ kind: 'zone', id: ZONE.id });
  });

  it('shows a waiting find with the reporter and without optional fields', () => {
    const row = pendingRow(contextOf(), task({ lat: 1, lon: 2, foundOn: '2026-09-06', forTraining: false }));

    expect(row.pending).toBe(true);
    expect(row.key).toBe('waiting-task-1');
    expect(row.entry.meta).toBe('Frida');
    expect(row.entry.note).toBeUndefined();
  });

  it('shows a waiting marker and a waiting zone with their icons', () => {
    const marker = pendingRow(contextOf(), task({ name: 'Slope', lat: 1, lon: 2, colour: 'red', note: 'n' }));
    expect(marker.entry.icon).toBe('flag');
    expect(marker.entry.colour).toBe('var(--colour-object-red)');
    expect(marker.entry.meta).toBe('private');
    expect(marker.entry.note).toBe('n');
    expect(marker.sortKey).toBe('2026-09-05');

    const zone = pendingRow(
      contextOf(),
      task({ name: 'Wood', polygon: ZONE.polygon, visibility: 'shared' }, 'task-2'),
    );
    expect(zone.entry.icon).toBe('zone');
    expect(zone.entry.colour).toBeUndefined();
    expect(zone.entry.meta).toBe('shared');
  });

  it('sorts the newest day first and keeps the order within a day', () => {
    const rows = [
      { ...markerRow(contextOf(), MARKER), key: 'old' },
      { ...ownFindRow(contextOf(), FIND), key: 'first' },
      { ...ownFindRow(contextOf(), FIND), key: 'second' },
    ];

    expect(byDay(rows).map((row) => row.key)).toEqual(['first', 'second', 'old']);
  });
});
