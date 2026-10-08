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
    { id: 'find-gone', lat: 1, lon: 1, foundOn: '2026-09-01', updatedAt: '2026-09-01T08:00:00Z', deleted: true },
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
});
