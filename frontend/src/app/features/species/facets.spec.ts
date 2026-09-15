import type { SpeciesEntry } from '../../core/api/models';
import { speciesEntry } from '../../testing/species-fixture';
import {
  EMPTY_SELECTION,
  FORECAST_VALUE,
  countColours,
  countUnknown,
  countValues,
  factsOf,
  isActive,
  judge,
  sizeKey,
  type Facts,
  type GroupKey,
  type Selection,
} from './facets';

const SMELL_ID = 'term-anis';
const TREE_ID = 'term-fichte';

const KINDS = new Map([
  [SMELL_ID, 'smell'],
  [TREE_ID, 'tree'],
]);

function term(id: string, slug: string) {
  return { term: { id, slug, name: slug }, fromExperience: false };
}

const STEINPILZ: SpeciesEntry = speciesEntry({
  slug: 'steinpilz',
  name: 'Steinpilz',
  scientificName: 'Boletus edulis',
  hymeniumType: 'tubes',
  capShapeYoung: 'hemispherical',
  capShapeOld: 'convex',
  periodStartMonth: 6,
  periodEndMonth: 10,
  colours: [
    { part: 'cap', mode: 'single', colours: [{ name: 'braun', hex: '#6b4423' }] },
    { part: 'stem', mode: 'single', colours: [{ name: 'creme', hex: '#e8d9b5' }] },
  ],
  measurements: [{ part: 'cap', measurements: [{ dimension: 'width', unit: 'cm', low: 8, high: 20 }] }],
  terms: [term(SMELL_ID, 'nussig'), term(TREE_ID, 'fichte')],
});

const WINTER: SpeciesEntry = speciesEntry({
  slug: 'austernseitling',
  name: 'Austernseitling',
  scientificName: 'Pleurotus ostreatus',
  periodStartMonth: 11,
  periodEndMonth: 2,
});

const BARE: SpeciesEntry = speciesEntry({
  slug: 'unbekannt',
  name: 'Unbekannt',
  scientificName: 'Ignotus ignotus',
  edibility: 'inedible',
  forecastEnabled: false,
});

function factsFor(entry: SpeciesEntry): Facts {
  return factsOf(entry, KINDS);
}

function selection(patch: Partial<Selection>): Selection {
  return { ...EMPTY_SELECTION, ...patch };
}

function wanting(key: GroupKey, ...values: string[]): Selection {
  return selection({ values: new Map([[key, new Set(values)]]) });
}

describe('factsOf', () => {
  it('legt die Monate einer Art als Werte ab', () => {
    expect(factsFor(STEINPILZ).values.get('period')).toEqual(['6', '7', '8', '9', '10']);
  });

  it('zählt über den Jahreswechsel hinweg', () => {
    expect(factsFor(WINTER).values.get('period')).toEqual(['1', '2', '11', '12']);
  });

  it('lässt die Monate leer, solange keine Zeit dasteht', () => {
    expect(factsFor(BARE).values.get('period')).toEqual([]);
  });

  it('führt beide Hutformen, jede nur einmal', () => {
    expect(factsFor(STEINPILZ).values.get('capShape')).toEqual(['hemispherical', 'convex']);
    const single = speciesEntry({ ...STEINPILZ, capShapeOld: 'hemispherical' });
    expect(factsFor(single).values.get('capShape')).toEqual(['hemispherical']);
  });

  it('ordnet die Farbe je Teil über den Farbabstand ein', () => {
    const facts = factsFor(STEINPILZ);

    expect(facts.colours.get('cap')).toEqual(['brown']);
    expect(facts.colours.get('stem')).toEqual(['cream']);
    expect(facts.colours.get('gills')).toBeUndefined();
  });

  it('trennt Sinne und Baumpartner über die Art des Begriffs', () => {
    const facts = factsFor(STEINPILZ);

    expect(facts.values.get('senses')).toEqual(['nussig']);
    expect(facts.values.get('treePartner')).toEqual(['fichte']);
  });

  it('nimmt Gattung, Speisewert, Schutz und Vorhersage aus den Feldern', () => {
    const facts = factsFor(STEINPILZ);

    expect(facts.values.get('genusFamily')).toEqual(['Boletus']);
    expect(facts.values.get('edibility')).toEqual(['edible']);
    expect(facts.values.get('protection')).toEqual(['none']);
    expect(facts.values.get('forecast')).toEqual([FORECAST_VALUE]);
    expect(factsFor(BARE).values.get('forecast')).toEqual([]);
  });

  it('legt jedes Maß unter Teil und Strecke ab', () => {
    expect(factsFor(STEINPILZ).sizes.get(sizeKey('cap', 'width'))).toEqual([8, 20]);
  });
});

describe('judge', () => {
  it('nimmt jede Art, solange nichts gewählt ist', () => {
    expect(judge(factsFor(BARE), EMPTY_SELECTION)).toBe('hit');
  });

  it('meldet einen Treffer, wenn ein Wert der Gruppe passt', () => {
    expect(judge(factsFor(STEINPILZ), wanting('hymenium', 'tubes', 'gills'))).toBe('hit');
  });

  it('meldet miss, wenn kein Wert der Gruppe passt', () => {
    expect(judge(factsFor(STEINPILZ), wanting('hymenium', 'gills'))).toBe('miss');
  });

  it('meldet unknown, solange die Art zur Gruppe nichts sagt', () => {
    expect(judge(factsFor(BARE), wanting('hymenium', 'tubes'))).toBe('unknown');
  });

  it('macht mit keepUnknown aus unknown einen Treffer', () => {
    const held = selection({
      values: new Map([['hymenium', new Set(['tubes'])]]),
      keepUnknown: new Set(['hymenium']),
    });

    expect(judge(factsFor(BARE), held)).toBe('hit');
  });

  it('lässt miss vor unknown gehen', () => {
    const held = selection({
      values: new Map<GroupKey, ReadonlySet<string>>([
        ['edibility', new Set(['edible'])],
        ['hymenium', new Set(['tubes'])],
      ]),
    });

    expect(judge(factsFor(BARE), held)).toBe('miss');
  });

  it('prüft eine Farbe über die nächste Standardfarbe des Teils', () => {
    const hit = selection({ colours: new Map([['cap', '#6d4626']]) });
    const miss = selection({ colours: new Map([['cap', '#b8322a']]) });

    expect(judge(factsFor(STEINPILZ), hit)).toBe('hit');
    expect(judge(factsFor(STEINPILZ), miss)).toBe('miss');
  });

  it('meldet unknown, solange das Teil keine Farbe trägt', () => {
    const held = selection({ colours: new Map([['gills', '#6b4423']]) });
    const kept = selection({ ...held, keepUnknown: new Set<GroupKey>(['colour']) });

    expect(judge(factsFor(STEINPILZ), held)).toBe('unknown');
    expect(judge(factsFor(STEINPILZ), kept)).toBe('hit');
  });

  it('nimmt ein Maß, sobald sich die Spannen überschneiden', () => {
    const key = sizeKey('cap', 'width');
    const hit = selection({ sizes: new Map([[key, [18, 30] as const]]) });
    const miss = selection({ sizes: new Map([[key, [0, 5] as const]]) });

    expect(judge(factsFor(STEINPILZ), hit)).toBe('hit');
    expect(judge(factsFor(STEINPILZ), miss)).toBe('miss');
  });

  it('meldet unknown, solange die Art das Maß nicht führt', () => {
    const key = sizeKey('cap', 'width');
    const held = selection({ sizes: new Map([[key, [0, 5] as const]]) });
    const kept = selection({ ...held, keepUnknown: new Set<GroupKey>(['size']) });

    expect(judge(factsFor(BARE), held)).toBe('unknown');
    expect(judge(factsFor(BARE), kept)).toBe('hit');
  });
});

describe('isActive', () => {
  it('bleibt aus, solange keine Wahl steht', () => {
    expect(isActive(EMPTY_SELECTION)).toBe(false);
    expect(isActive(selection({ values: new Map([['hymenium', new Set()]]) }))).toBe(false);
  });

  it('meldet jede Art von Wahl', () => {
    expect(isActive(wanting('hymenium', 'tubes'))).toBe(true);
    expect(isActive(selection({ colours: new Map([['cap', '#6b4423']]) }))).toBe(true);
    expect(isActive(selection({ sizes: new Map([['cap.width', [0, 5] as const]]) }))).toBe(true);
  });
});

describe('die Zählungen über den Katalog', () => {
  const facts = [STEINPILZ, WINTER, BARE].map(factsFor);

  it('zählt, wie viele Arten einen Wert tragen', () => {
    expect(countValues(facts, 'edibility')).toEqual(
      new Map([
        ['edible', 2],
        ['inedible', 1],
      ]),
    );
  });

  it('zählt die Standardfarben eines Körperteils', () => {
    expect(countColours(facts, 'cap')).toEqual(new Map([['brown', 1]]));
    expect(countColours(facts, 'gills')).toEqual(new Map());
  });

  it('zählt die Arten ohne Angabe zu einer Gruppe', () => {
    expect(countUnknown(facts, 'hymenium')).toBe(2);
    expect(countUnknown(facts, 'edibility')).toBe(0);
  });
});
