import { asPolygon, loadAreaCalculator } from './area';
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

  it('rechnet die Fläche in Hektar', async () => {
    const compute = await loadAreaCalculator();
    const polygon = asPolygon(RING);
    if (polygon === null) throw new Error('Der Ring spannt keine Fläche auf.');

    // At the latitude of Tübingen, 0.01 degrees by 0.01 degrees is approximately 82 ha.
    expect(compute(polygon)).toBeGreaterThan(70);
    expect(compute(polygon)).toBeLessThan(95);
  });

  it('holt Turf nur einmal', async () => {
    expect(await loadAreaCalculator()).toBe(await loadAreaCalculator());
  });
});
