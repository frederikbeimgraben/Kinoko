import { areaTilePaths, polygonBounds, tileX, tileY, tilesIn } from './offline-tiles';
import { restoreAreas } from './offline-areas.store';

describe('offline tiles', () => {
  it('finds the box around a polygon', () => {
    const bounds = polygonBounds({
      type: 'Polygon',
      coordinates: [
        [
          [9, 48],
          [9.2, 48.1],
          [9.1, 48.3],
          [9, 48],
        ],
      ],
    });

    expect(bounds).toEqual({ west: 9, south: 48, east: 9.2, north: 48.3 });
  });

  it('gives the Web Mercator tile of a point', () => {
    expect(tileX(0, 1)).toBe(1);
    expect(tileY(10, 1)).toBe(0);
    expect(tileX(9.05, 10)).toBe(537);
    expect(tileY(48.52, 10)).toBe(353);
  });

  it('lists each tile of a box at one zoom level', () => {
    const tiles = tilesIn({ west: -1, south: -1, east: 1, north: 1 }, 1);

    expect(tiles).toEqual([
      [1, 0, 0],
      [1, 0, 1],
      [1, 1, 0],
      [1, 1, 1],
    ]);
  });

  it('keeps only tiles with data and each path one time', () => {
    const source = { folder: 'rain/2026W36', zoomFrom: 0, zoomTo: 1, existing: new Set(['0/0/0']), haveZoom: 0 };

    const paths = areaTilePaths({ west: -1, south: -1, east: 1, north: 1 }, [source, source]);

    expect(paths).toEqual([
      '/rain/2026W36/0/0/0.png',
      '/rain/2026W36/1/0/0.png',
      '/rain/2026W36/1/0/1.png',
      '/rain/2026W36/1/1/0.png',
      '/rain/2026W36/1/1/1.png',
    ]);
  });

  it('keeps the good saved areas and drops a bad entry', () => {
    const good = { id: 'zone', name: 'Schönbuch', areaHa: 42, bytes: 10, paths: [] };

    expect(restoreAreas([good, { id: 3 }])).toEqual({ areas: [good] });
    expect(restoreAreas('broken')).toBeNull();
  });
});
