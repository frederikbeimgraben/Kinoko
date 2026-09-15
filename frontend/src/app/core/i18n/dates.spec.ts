import { describe, expect, it } from 'vitest';
import { asDate, longDate, shortDate } from './dates';

/** Der Katalog der Tests: nur das Muster des kurzen Tages steht darin. */
const PATTERN = { 'common.dateShort': '{tag}. {monat}' };

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

describe('shortDate', () => {
  it('schreibt den Tag mit kurzem Monat und ohne Jahr', () => {
    // Die Schreibweise des Monats kommt aus der Zeitzone der Laufzeit; der
    // Test prüft das Muster, nicht den Katalog des Browsers.
    const month = new Intl.DateTimeFormat('de', { month: 'short' }).format(new Date(2026, 8, 6));

    expect(shortDate('2026-09-06', 'de', translate)).toBe(`6. ${month}`);
    expect(month).not.toContain('2026');
  });

  it('nimmt das Muster aus dem Katalog', () => {
    const english = (_key: string, values: Record<string, string | number> = {}): string =>
      `${String(values['monat'])} ${String(values['tag'])}`;
    expect(shortDate('2026-09-06', 'en', english)).toBe('Sep 6');
  });
});
