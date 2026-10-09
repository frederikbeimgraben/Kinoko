import { speciesEntry } from '../../testing/species-fixture';
import { localSpecies } from './species-names';

const STONE = speciesEntry({
  slug: 'boletus-edulis',
  name: 'Steinpilz',
  scientificName: 'Boletus edulis',
  names: [
    { kind: 'common', name: 'Steinpilz' },
    { kind: 'common', name: 'Herrenpilz' },
  ],
  lookalikes: [
    {
      slug: 'tylopilus-felleus',
      name: 'Gallenröhrling',
      scientificName: 'Tylopilus felleus',
      edibility: 'inedible',
      capColours: [],
      difference: null,
    },
  ],
});

describe('localSpecies', () => {
  it('keeps the German names in German', () => {
    expect(localSpecies(STONE, 'de')).toBe(STONE);
  });

  it('shows the scientific name in another language and keeps the German name for the search', () => {
    const english = localSpecies(STONE, 'en');

    expect(english.name).toBe('Boletus edulis');
    expect(english.names.map((one) => one.name)).toEqual(['Steinpilz', 'Herrenpilz']);
    expect(english.lookalikes.map((one) => one.name)).toEqual(['Tylopilus felleus']);
  });
});
