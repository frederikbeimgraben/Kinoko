import { speciesEntry } from '../../testing/species-fixture';
import { aliasOf, localSpecies, nameLines } from './species-names';

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
    expect(aliasOf(english)).toBe('Steinpilz');
    expect(aliasOf(localSpecies(STONE, 'de'))).toBe('');
  });
});

describe('nameLines', () => {
  it('gives the German name and then the Latin name in German', () => {
    expect(nameLines('Steinpilz', 'Boletus edulis', 'de')).toEqual({
      title: 'Steinpilz',
      latin: 'Boletus edulis',
      alias: '',
    });
  });

  it('gives the Latin name and then the German name in another language', () => {
    expect(nameLines('Steinpilz', 'Boletus edulis', 'en')).toEqual({
      title: 'Boletus edulis',
      latin: '',
      alias: 'Steinpilz',
    });
  });

  it('gives one line for a species without a German name', () => {
    expect(nameLines('Boletus edulis', 'Boletus edulis', 'en')).toEqual({
      title: 'Boletus edulis',
      latin: '',
      alias: '',
    });
  });
});
