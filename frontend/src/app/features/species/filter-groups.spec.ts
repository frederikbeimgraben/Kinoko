import type { I18nService } from '../../core/i18n/i18n.service';
import { EMPTY_SELECTION, type Selection } from './facets';
import { groupSummary } from './filter-groups';

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

  it('nennt den einen Monat der Zeit, unter dem Schlüssel Größe und Zeit', () => {
    const selection: Selection = { ...EMPTY_SELECTION, values: new Map([['period', new Set(['9'])]]) };

    expect(groupSummary('size', selection, I18N, NAMES)).toBe('enum.month.9');
  });

  it('nennt den Zeitraum vom ersten bis zum letzten gewählten Monat', () => {
    const selection: Selection = {
      ...EMPTY_SELECTION,
      values: new Map([['period', new Set(['9', '7', '8'])]]),
    };

    expect(groupSummary('period', selection, I18N, NAMES)).toBe('species.period.range');
  });
});
