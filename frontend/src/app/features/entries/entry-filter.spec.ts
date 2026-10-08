import type { GeoPolygon } from '../../core/api/models';
import { NO_FILTER, inPolygon, inSpan, isFiltered, passes, type FilterableFind } from './entry-filter';

const SQUARE: GeoPolygon = {
  type: 'Polygon',
  coordinates: [
    [
      [9, 48],
      [9.2, 48],
      [9.2, 48.2],
      [9, 48.2],
      [9, 48],
    ],
  ],
};

const FIND: FilterableFind = {
  id: 'find',
  lat: 48.1,
  lon: 9.1,
  foundOn: '2026-09-08',
  visibility: 'private',
  groupId: null,
};

const CONTEXT = { today: '2026-09-09', zone: null, photoFinds: new Set<string>() };

describe('entry filter', () => {
  it('lets each find pass without a filter', () => {
    expect(isFiltered(NO_FILTER)).toBe(false);
    expect(passes(FIND, NO_FILTER, CONTEXT)).toBe(true);
  });

  it('knows the days of each span', () => {
    expect(inSpan('2026-09-09', 'today', '2026-09-09')).toBe(true);
    expect(inSpan('2026-09-07', 'week', '2026-09-09')).toBe(true);
    expect(inSpan('2026-09-06', 'week', '2026-09-09')).toBe(false);
    expect(inSpan('2026-09-01', 'month', '2026-09-09')).toBe(true);
    expect(inSpan('2025-09-09', 'year', '2026-09-09')).toBe(false);
  });

  it('finds a point in a polygon', () => {
    expect(inPolygon(9.1, 48.1, SQUARE)).toBe(true);
    expect(inPolygon(9.3, 48.1, SQUARE)).toBe(false);
  });

  it('limits by visibility, zone, time and photo', () => {
    expect(passes(FIND, { ...NO_FILTER, visibility: 'shared' }, CONTEXT)).toBe(false);
    expect(passes(FIND, { ...NO_FILTER, zoneId: 'zone' }, { ...CONTEXT, zone: SQUARE })).toBe(true);
    expect(passes({ ...FIND, lon: 10 }, { ...NO_FILTER, zoneId: 'zone' }, { ...CONTEXT, zone: SQUARE })).toBe(
      false,
    );
    expect(passes(FIND, { ...NO_FILTER, time: 'today' }, CONTEXT)).toBe(false);
    expect(passes(FIND, { ...NO_FILTER, withPhoto: true }, CONTEXT)).toBe(false);
    expect(passes(FIND, { ...NO_FILTER, withPhoto: true }, { ...CONTEXT, photoFinds: new Set(['find']) })).toBe(
      true,
    );
  });
});
