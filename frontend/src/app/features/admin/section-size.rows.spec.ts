import type { SpeciesEntry } from '../../core/api/models';
import { measurementOf, withMeasurement } from './section-size.rows';

const CAP = {
  dimension: 'width' as const,
  unit: 'cm' as const,
  low: 4,
  high: 20,
};

const SPECIES = {
  measurements: [{ part: 'cap' as const, measurements: [CAP] }],
} as unknown as SpeciesEntry;

describe('section-size.rows', () => {
  it('findet das Maß eines Teils, sonst nichts', () => {
    expect(measurementOf(SPECIES, 'cap', 'width')).toEqual(CAP);
    expect(measurementOf(SPECIES, 'cap', 'height')).toBeNull();
    expect(measurementOf(SPECIES, 'stem', 'width')).toBeNull();
    expect(measurementOf(null, 'cap', 'width')).toBeNull();
  });

  it('ersetzt eine bekannte Strecke an ihrer Stelle', () => {
    const groups = withMeasurement(SPECIES, 'cap', { ...CAP, high: 25 });

    expect(groups).toEqual([{ part: 'cap', measurements: [{ ...CAP, high: 25 }] }]);
  });

  it('hängt eine neue Strecke an die Gruppe ihres Teils', () => {
    const height = { ...CAP, dimension: 'height' as const, low: 5, high: 15 };
    const groups = withMeasurement(SPECIES, 'cap', height);

    expect(groups[0].measurements).toEqual([CAP, height]);
  });

  it('legt eine Gruppe an, wenn das Teil noch keine trägt', () => {
    const groups = withMeasurement(SPECIES, 'stem', CAP);

    expect(groups).toHaveLength(2);
    expect(groups[1]).toEqual({ part: 'stem', measurements: [CAP] });
  });
});
