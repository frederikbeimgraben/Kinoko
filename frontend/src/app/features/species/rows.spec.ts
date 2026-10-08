import type { Edibility } from '../../core/api/models';
import type { I18nService } from '../../core/i18n/i18n.service';
import { speciesEntry } from '../../testing/species-fixture';
import { factsOf } from './facets';
import { headOf, leadColour, sortEntries, speciesRow } from './rows';

/** Ein Katalog ohne Texte: jeder Schlüssel steht für sich selbst. */
const I18N = { translate: (key: string) => key } as unknown as I18nService;

const STONE = speciesEntry({
  slug: 'boletus-edulis',
  name: 'Steinpilz',
  scientificName: 'Boletus edulis',
});

describe('speciesRow', () => {
  it('führt zum Titelbild der Art', () => {
    const row = speciesRow(speciesEntry({ ...STONE, leadPhotoId: 'bild-eins' }), I18N);

    expect(row.image).toBe('/photos/bild-eins/list');
  });

  it('lässt die Bildspalte leer, wo keine Art ein Titelbild hat', () => {
    const row = speciesRow(speciesEntry({ ...STONE, leadPhotoId: null }), I18N);

    expect(row.image).toBeNull();
  });

  it('trägt genau eine Plakette, den Speisewert', () => {
    const row = speciesRow(STONE, I18N);

    expect(row.levelText).toBe('enum.edibility.edible');
    expect(row.name).toBe('Steinpilz');
    expect(row.latin).toBe('Boletus edulis');
  });

  it.each<[Edibility, string, string]>([
    ['edible', 'var(--color-primary)', 'var(--color-primary-subtle)'],
    ['conditionally_edible', 'var(--color-warning)', 'var(--color-warning-subtle)'],
    ['inedible', 'var(--color-text-muted)', 'var(--color-surface-sunken)'],
    ['poisonous', 'var(--color-danger)', 'var(--color-danger-subtle)'],
    ['deadly', 'var(--color-danger)', 'var(--color-danger-subtle)'],
  ])('setzt für %s die Plakette aus Thema-Tokens, kein festes Hex', (edibility, colour, background) => {
    const row = speciesRow(speciesEntry({ ...STONE, edibility }), I18N);

    expect(row.levelColour).toBe(colour);
    expect(row.levelBackground).toBe(background);
    expect(row.levelColour).not.toMatch(/^#/);
    expect(row.levelBackground).not.toMatch(/^#/);
  });
});

describe('species order', () => {
  const entryOf = (seed: Parameters<typeof speciesEntry>[0]) => {
    const species = speciesEntry(seed);
    return { species, facts: factsOf(species, []) };
  };
  const B = entryOf({ slug: 'b', name: 'Art 10', scientificName: 'Zeta', edibility: 'edible' });
  const A = entryOf({ slug: 'a', name: 'Art 2', scientificName: 'Alpha', edibility: 'edible' });
  const C = entryOf({
    slug: 'c',
    name: 'Art 1',
    scientificName: 'Mu',
    edibility: 'deadly',
    periodStartMonth: 7,
  });
  const D = entryOf({ slug: 'd', name: 'Art 3', scientificName: 'Nu', periodStartMonth: 7 });
  const slugs = (entries: readonly { species: { id: string } }[]): string[] =>
    entries.map((one) => one.species.id);

  it('sorts numbers in a name by value, and the Latin name by letters', () => {
    expect(slugs(sortEntries([B, A, C], 'name'))).toEqual(['c', 'a', 'b']);
    expect(slugs(sortEntries([B, C, A], 'latin'))).toEqual(['a', 'c', 'b']);
  });

  it('sorts by edibility and by season, and uses the name for equal values', () => {
    expect(slugs(sortEntries([C, B, A], 'edibility'))).toEqual(['a', 'b', 'c']);
    expect(slugs(sortEntries([B, D, C], 'season'))).toEqual(['c', 'd', 'b']);
  });

  it('gives the head of a group for each sort, and no head without a season', () => {
    expect(headOf(A.species, 'name', I18N)).toBe('A');
    expect(headOf(A.species, 'latin', I18N)).toBe('A');
    expect(headOf(C.species, 'edibility', I18N)).toBe('enum.edibility.deadly');
    expect(headOf(C.species, 'season', I18N)).not.toBe('');
    expect(headOf(A.species, 'season', I18N)).toBe('');
  });

  it('uses the first cap colour, else a brown default', () => {
    const capped = speciesEntry({
      ...STONE,
      colours: [{ part: 'cap', mode: 'single', colours: [{ name: 'red', hex: '#aa0000' }] }],
    });

    expect(leadColour(capped)).toBe('#aa0000');
    expect(leadColour(STONE)).toBe('#7a5230');
  });
});
