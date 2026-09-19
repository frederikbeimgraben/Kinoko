import { describe, expect, it } from 'vitest';
import { catalogueOf } from '../../testing/i18n';
import { asDate, longDate, numericDate, shortDate, shortDay } from './dates';

/** Der Katalog der Tests: die Muster der beiden kurzen Formen. */
const PATTERN = {
  'common.dateShort': '{tag}. {monat}',
  'common.dateNumeric': '{tag}. {monat}. {jahr}',
  'enum.monthShort.9': 'Sept.',
};

const CATALOGUE = catalogueOf(PATTERN);

function translate(key: string, values: Record<string, string | number> = {}): string {
  const text = PATTERN[key as keyof typeof PATTERN];
  return Object.entries(values).reduce((out, [name, value]) => out.replace(`{${name}}`, String(value)), text);
}

describe('asDate', () => {
  it('liest ein ISO-Datum als lokalen Tag', () => {
    expect(asDate('2026-09-06').getDate()).toBe(6);
    expect(asDate('2026-09-06').getMonth()).toBe(8);
  });
});

describe('longDate', () => {
  it('schreibt den Tag mit vollem Monat und Jahr', () => {
    expect(longDate('2026-09-06', 'de')).toBe('6. September 2026');
  });
});

describe('numericDate', () => {
  it('schreibt Tag, Monat und Jahr in Ziffern', () => {
    expect(numericDate('2026-09-06', translate)).toBe('6. 9. 2026');
  });
});

describe('shortDate', () => {
  it('nimmt Tag und kurzen Monat aus dem Katalog', () => {
    expect(shortDate('2026-09-06', CATALOGUE)).toBe('6. Sept.');
  });

  it('schreibt denselben Tag aus einem Zeitpunkt', () => {
    expect(shortDay(new Date(2026, 8, 6), CATALOGUE)).toBe('6. Sept.');
  });
});
