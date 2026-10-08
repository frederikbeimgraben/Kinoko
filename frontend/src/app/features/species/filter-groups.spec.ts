import type { I18nService } from '../../core/i18n/i18n.service';
import { EMPTY_SELECTION, type Selection } from './facets';
import { choicesOf, groupSummary, valueLabel } from './filter-groups';

const I18N = {
  translate: (key: string, values: Record<string, string> = {}) =>
    Object.entries(values).reduce((out, [name, value]) => out.replace(`{${name}}`, value), key),
} as unknown as I18nService;

const NAMES = new Map<string, string>();

describe('groupSummary', () => {
  it('bleibt leer ohne Wahl', () => {
    expect(groupSummary('edibility', EMPTY_SELECTION, I18N, NAMES)).toBe('');
  });

  it('nennt den einen gewählten Wert einer Auswahlgruppe', () => {
    const selection: Selection = {
      ...EMPTY_SELECTION,
      values: new Map([['edibility', new Set(['edible'])]]),
    };

    expect(groupSummary('edibility', selection, I18N, NAMES)).toBe('enum.edibility.edible');
  });

  it('zählt die Werte, sobald mehr als einer gewählt ist', () => {
    const selection: Selection = {
      ...EMPTY_SELECTION,
      values: new Map([['edibility', new Set(['edible', 'poisonous'])]]),
    };

    expect(groupSummary('edibility', selection, I18N, NAMES)).toBe('filter.valueCount');
  });

  it('zählt die Körperteile mit Farbe', () => {
    const selection: Selection = { ...EMPTY_SELECTION, colours: new Map([['cap', '#7a5230']]) };

    expect(groupSummary('colour', selection, I18N, NAMES)).toBe('filter.colour.onePart');
  });

  it('nennt den einen Monat der Zeit', () => {
    const selection: Selection = { ...EMPTY_SELECTION, values: new Map([['period', new Set(['9'])]]) };

    expect(groupSummary('period', selection, I18N, NAMES)).toBe('enum.month.9');
  });

  it('nennt den Zeitraum vom ersten bis zum letzten gewählten Monat', () => {
    const selection: Selection = {
      ...EMPTY_SELECTION,
      values: new Map([['period', new Set(['9', '7', '8'])]]),
    };

    expect(groupSummary('period', selection, I18N, NAMES)).toBe('species.period.range');
  });

  it('counts several body parts with a colour, and stays empty without a month', () => {
    const selection: Selection = {
      ...EMPTY_SELECTION,
      colours: new Map([
        ['cap', '#7a5230'],
        ['stem', '#ffffff'],
      ]),
    };

    expect(groupSummary('colour', selection, I18N, NAMES)).toBe('filter.colour.parts');
    expect(groupSummary('colour', EMPTY_SELECTION, I18N, NAMES)).toBe('');
    expect(groupSummary('period', EMPTY_SELECTION, I18N, NAMES)).toBe('');
  });

  it('names a free value from the catalogue, else shows the value', () => {
    const names = new Map([['fagus', 'Beech']]);
    const selection: Selection = {
      ...EMPTY_SELECTION,
      values: new Map([['treePartner', new Set(['fagus'])]]),
    };

    expect(groupSummary('treePartner', selection, I18N, names)).toBe('Beech');
    expect(valueLabel('treePartner', 'picea', I18N, names)).toBe('picea');
    expect(valueLabel('edibility', 'deadly', I18N, names)).toBe('enum.edibility.deadly');
  });
});

describe('choicesOf', () => {
  const counts = {
    edibility: { poisonous: 2, edible: 5 },
    treePartner: { picea: 1, fagus: 3 },
  };

  it('keeps the contract order of a fixed group and drops the values without species', () => {
    const choices = choicesOf(counts, 'edibility', I18N, NAMES);

    expect(choices.map((one) => one.value)).toEqual(['edible', 'poisonous']);
    expect(choices[0]).toEqual({ value: 'edible', label: 'enum.edibility.edible', count: 5 });
  });

  it('sorts a free group by name and shows the value of an unnamed entry', () => {
    const choices = choicesOf(counts, 'treePartner', I18N, new Map([['fagus', 'Zeder']]));

    expect(choices).toEqual([
      { value: 'picea', label: 'picea', count: 1 },
      { value: 'fagus', label: 'Zeder', count: 3 },
    ]);
    expect(choicesOf(counts, 'genusFamily', I18N, NAMES)).toEqual([]);
  });
});
