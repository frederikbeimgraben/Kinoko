import type { SpeciesEntry } from '../../core/api/models';
import { toWrite } from './species-write';

const SPECIES = {
  id: 'art-eins',
  slug: 'boletus-edulis',
  name: 'Steinpilz',
  scientificName: 'Boletus edulis',
  genusName: 'Boletus',
  group: 'bolete',
  edibility: 'edible',
  protection: 'none',
  forecastEnabled: true,
  updatedAt: '2026-09-10T10:00:00+02:00',
  updatedByName: 'Frederik',
  names: [],
  measurements: [],
  colours: [],
  colourChanges: [],
  capFeatures: [],
  capMargins: [],
  stemFeatures: [],
  traits: [],
  sources: [],
  seasons: [],
  terms: [],
  lookalikes: [
    { slug: 'tylopilus-felleus', name: 'Gallenröhrling', difference: 'bitter' },
    { slug: 'imleria-badia', name: 'Maronenröhrling' },
  ],
} as unknown as SpeciesEntry;

describe('species-write', () => {
  it('lässt die Felder weg, die nur die Antwort trägt', () => {
    const write = toWrite(SPECIES) as Record<string, unknown>;

    expect(write['id']).toBeUndefined();
    expect(write['slug']).toBeUndefined();
    expect(write['updatedAt']).toBeUndefined();
    expect(write['updatedByName']).toBeUndefined();
    expect(write['forecastEnabled']).toBeUndefined();
  });

  it('formt die Verwechslungen auf Slug und Unterschied', () => {
    expect(toWrite(SPECIES).lookalikes).toEqual([
      { slug: 'tylopilus-felleus', difference: 'bitter' },
      { slug: 'imleria-badia', difference: '' },
    ]);
  });

  it('setzt fehlende Felder auf null statt sie wegzulassen', () => {
    const write = toWrite(SPECIES);

    expect(write.description).toBeNull();
    expect(write.periodStartMonth).toBeNull();
    expect(write.hymeniumType).toBeNull();
    expect(write.name).toBe('Steinpilz');
  });
});
