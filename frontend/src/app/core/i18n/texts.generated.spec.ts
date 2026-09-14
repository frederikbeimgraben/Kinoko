import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SUPPORTED_LOCALES } from './translations';
import generated from './texts.generated.json';

const SOURCE = join(process.cwd(), '..', 'backend', 'daten', 'texte.json');

/** Die Vorgabe, wie das Backend sie ausliefert. */
function source(): Record<string, Record<string, string>> {
  return JSON.parse(readFileSync(SOURCE, 'utf8')) as Record<string, Record<string, string>>;
}

describe('Der erzeugte Rückfallkatalog', () => {
  it('trägt die Sprachen der Vorgabe', () => {
    expect(Object.keys(generated).sort()).toEqual(Object.keys(source()).sort());
    expect(Object.keys(generated).sort()).toEqual([...SUPPORTED_LOCALES].sort());
  });

  it('trägt in jeder Sprache dieselben Schlüssel und Texte wie die Vorgabe', () => {
    const table = generated as Record<string, Record<string, string>>;
    for (const [locale, entries] of Object.entries(source())) {
      expect(Object.keys(table[locale]).sort()).toEqual(Object.keys(entries).sort());
      expect(table[locale]).toEqual(entries);
    }
  });
});
