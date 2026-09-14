import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SUPPORTED_LOCALES } from './translations';
import generatedDe from './texts.de.json';
import generatedEn from './texts.en.json';
import legacyDe from './legacy.de.json';
import legacyEn from './legacy.en.json';

const SOURCE = join(process.cwd(), '..', 'backend', 'daten', 'texte.json');

/** Die Vorgabe, wie das Backend sie ausliefert. */
function source(): Record<string, Record<string, string>> {
  return JSON.parse(readFileSync(SOURCE, 'utf8')) as Record<string, Record<string, string>>;
}

const GENERATED: Record<string, Record<string, string>> = { de: generatedDe, en: generatedEn };

describe('Der erzeugte Rückfallkatalog', () => {
  it('trägt eine Datei je Sprache der Vorgabe', () => {
    expect(Object.keys(GENERATED).sort()).toEqual(Object.keys(source()).sort());
    expect(Object.keys(GENERATED).sort()).toEqual([...SUPPORTED_LOCALES].sort());
  });

  it('trägt in jeder Sprache dieselben Schlüssel und Texte wie die Vorgabe', () => {
    for (const [locale, entries] of Object.entries(source())) {
      expect(Object.keys(GENERATED[locale]).sort()).toEqual(Object.keys(entries).sort());
      expect(GENERATED[locale]).toEqual(entries);
    }
  });
});

describe('Die Schlüssel der alten Seiten', () => {
  it('stehen in beiden Sprachen', () => {
    expect(Object.keys(legacyEn).sort()).toEqual(Object.keys(legacyDe).sort());
  });

  it('tragen in jeder Sprache einen Text', () => {
    const empty = Object.entries<string>(legacyEn).filter(([, value]) => value.trim() === '');
    expect(empty).toEqual([]);
  });
});
