import { areaHa, asPolygon } from './area';
import type { Location } from './add-entry.store';

const RING: Location[] = [
  [9.0, 48.5],
  [9.01, 48.5],
  [9.01, 48.51],
  [9.0, 48.51],
];

describe('Fläche', () => {
  it('schließt den Ring, wie es der Vertrag verlangt', () => {
    const polygon = asPolygon(RING);

    expect(polygon?.coordinates[0]).toHaveLength(5);
    expect(polygon?.coordinates[0][4]).toEqual([9.0, 48.5]);
  });

  it('lässt einen schon geschlossenen Ring, wie er ist', () => {
    const polygon = asPolygon([...RING, [9.0, 48.5]]);

    expect(polygon?.coordinates[0]).toHaveLength(5);
  });

  it('gibt unter drei Eckpunkten keine Fläche her', () => {
    expect(asPolygon(RING.slice(0, 2))).toBeNull();
  });

  it('rechnet die Fläche wie der Dienst', () => {
    // The values of `TestAreaAndCentroidAgreeWithPython` in `backend/internal/core/geo/geo_test.go`.
    const square = asPolygon([
      [10.0, 50.0],
      [10.01, 50.0],
      [10.01, 50.01],
      [10.0, 50.01],
    ]);
    const triangle = asPolygon([
      [-3.7, 40.4],
      [-3.6, 40.45],
      [-3.65, 40.5],
    ]);
    if (square === null || triangle === null) throw new Error('Der Ring spannt keine Fläche auf.');

    expect(areaHa(square)).toBeCloseTo(79.46965107421875, 6);
    expect(areaHa(triangle)).toBeCloseTo(3528.993801696777, 4);
  });

  it('gibt einem Ring ohne Fläche null Hektar', () => {
    expect(areaHa({ type: 'Polygon', coordinates: [[[9, 48]]] })).toBe(0);
  });
});
