import type { AccountExport } from '../../core/api/models';
import { exportFile, partsFor, selected, toCsv, toGpx } from './export-files';

const DATA = {
  me: { id: 'me', sub: 'sub', email: 'frederik@example.org', name: 'Frederik' },
  finds: [
    {
      id: 'find-1',
      speciesId: 'steinpilz',
      lat: 48.5,
      lon: 9.05,
      foundOn: '2026-09-06',
      count: 3,
      visibility: 'private',
      note: 'unter <Fichten> & Buchen',
      updatedAt: '2026-09-06T08:00:00Z',
      deleted: false,
    },
    {
      id: 'find-gone',
      lat: 1,
      lon: 1,
      foundOn: '2026-09-01',
      updatedAt: '2026-09-01T08:00:00Z',
      deleted: true,
    },
  ],
  markers: [
    {
      id: 'marker-1',
      name: 'Parkplatz, Nord',
      lat: 48.6,
      lon: 9.1,
      note: null,
      visibility: 'shared',
      updatedAt: '2026-09-02T08:00:00Z',
      deleted: false,
    },
  ],
  zones: [
    {
      id: 'zone-1',
      name: 'Schönbuch',
      areaHa: 42,
      polygon: {
        type: 'Polygon',
        coordinates: [
          [
            [9, 48],
            [9.1, 48],
            [9.1, 48.1],
            [9, 48],
          ],
        ],
      },
      updatedAt: '2026-09-02T08:00:00Z',
      deleted: false,
    },
  ],
  photos: [],
  combinations: [],
} as unknown as AccountExport;

const species = (id: string | null | undefined): string => (id === 'steinpilz' ? 'Steinpilz' : '');

describe('export files', () => {
  it('keeps only the selected parts', () => {
    const only = selected(DATA, new Set(['markers']));

    expect(only.finds).toEqual([]);
    expect(only.markers).toHaveLength(1);
    expect(only.me.name).toBe('Frederik');
  });

  it('offers no images and no combinations for GPX', () => {
    expect(partsFor('gpx')).toEqual(['finds', 'markers', 'zones']);
    expect(partsFor('json')).toHaveLength(5);
  });

  it('writes GPX 1.1 with waypoints before tracks', () => {
    const gpx = toGpx(DATA, species);

    expect(gpx).toContain('<gpx version="1.1" creator="Kinoko" xmlns="http://www.topografix.com/GPX/1/1">');
    expect(gpx).toContain(
      '<wpt lat="48.5" lon="9.05"><time>2026-09-06T00:00:00Z</time><name>Steinpilz</name>' +
        '<desc>unter &lt;Fichten&gt; &amp; Buchen</desc><type>find</type></wpt>',
    );
    expect(gpx).toContain('<trkpt lat="48.1" lon="9.1"/>');
    expect(gpx).not.toContain('find-gone');
    expect(gpx.indexOf('<wpt')).toBeLessThan(gpx.indexOf('<trk>'));
    expect(gpx.match(/<wpt/g)).toHaveLength(2);
  });

  it('writes one CSV with a kind column and quotes a field with a comma', () => {
    const lines = toCsv(DATA, species).trim().split('\r\n');

    expect(lines[0]).toBe('kind,id,name,date,lat,lon,count,visibility,note');
    expect(lines[1]).toBe('find,find-1,Steinpilz,2026-09-06,48.5,9.05,3,private,unter <Fichten> & Buchen');
    expect(lines[2]).toContain('"Parkplatz, Nord"');
    expect(lines).toHaveLength(4);
  });

  it('names the file after the day and the format', () => {
    expect(exportFile(DATA, 'gpx', species, '2026-09-12').name).toBe('kinoko-export-2026-09-12.gpx');
    expect(exportFile(DATA, 'json', species, '2026-09-12').type).toBe('application/json');
  });

  it('writes each part when each part is selected, also images and combinations', () => {
    const full = {
      ...DATA,
      photos: [
        {
          id: 'photo-1',
          speciesId: 'steinpilz',
          takenOn: '2026-09-05',
          lat: 48,
          lon: 9,
          state: 'ready',
          caption: 'cap',
        },
        { id: 'photo-2', speciesId: null, createdAt: '2026-09-04T10:00:00Z', state: 'ready' },
      ],
      combinations: [
        { id: 'combo-1', name: 'Autumn', updatedAt: '2026-09-03T10:00:00Z', deleted: false },
        { id: 'combo-gone', name: 'Old', updatedAt: '2026-09-03T10:00:00Z', deleted: true },
      ],
    } as unknown as AccountExport;

    const all = selected(full, new Set(partsFor('json')));
    expect(all.finds).toHaveLength(2);
    expect(all.zones).toHaveLength(1);
    expect(all.photos).toHaveLength(2);
    expect(all.combinations).toHaveLength(2);

    const lines = toCsv(full, species).trim().split('\r\n');
    expect(lines).toContain('photo,photo-1,Steinpilz,2026-09-05,48,9,,ready,cap');
    expect(lines).toContain('photo,photo-2,,2026-09-04T10:00:00Z,,,,ready,');
    expect(lines).toContain('combination,combo-1,Autumn,2026-09-03T10:00:00Z,,,,,');
    expect(lines.join('\n')).not.toContain('combo-gone');
  });

  it('skips points without a place or a polygon in GPX, and keeps a full instant', () => {
    const odd = {
      ...DATA,
      finds: [{ id: 'f', lat: 48, lon: 9, foundOn: '2026-09-06T10:00:00Z', deleted: false }],
      markers: [
        { id: 'm-1', lat: 48, lon: 9, deleted: false },
        { id: 'm-2', name: 'Lost', deleted: false },
      ],
      zones: [
        { id: 'z-1', name: 'No shape', deleted: false },
        { ...DATA.zones[0], deleted: true },
      ],
    } as unknown as AccountExport;

    const gpx = toGpx(odd, species);

    expect(gpx).toContain('<time>2026-09-06T10:00:00Z</time>');
    expect(gpx).toContain('<wpt lat="48" lon="9"><type>marker</type></wpt>');
    expect(gpx).not.toContain('Lost');
    expect(gpx).not.toContain('<trk>');
  });

  it('writes a CSV file and quotes a field with a quote', () => {
    const quoted = {
      ...DATA,
      finds: [],
      zones: [],
      markers: [{ ...DATA.markers[0], name: 'The "big" one' }],
    };

    const file = exportFile(quoted, 'csv', species, '2026-09-12');

    expect(file.name).toBe('kinoko-export-2026-09-12.csv');
    expect(file.type).toBe('text/csv');
    expect(file.content).toContain('"The ""big"" one"');
  });
});
