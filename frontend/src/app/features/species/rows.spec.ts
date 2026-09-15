import type { I18nService } from '../../core/i18n/i18n.service';
import { speciesEntry } from '../../testing/species-fixture';
import { speciesRow } from './rows';

/** Ein Katalog ohne Texte: jeder Schlüssel steht für sich selbst. */
const I18N = { translate: (key: string) => key } as unknown as I18nService;

function withCap(hexes: readonly string[]) {
  return speciesEntry({
    slug: 'mucidula-mucida',
    name: 'Beringter Schleimrübling',
    scientificName: 'Mucidula mucida',
    colours: [{ part: 'cap', mode: 'single', colours: hexes.map((hex) => ({ name: hex, hex })) }],
  });
}

describe('speciesRow', () => {
  it('nimmt den ersten und den letzten Hutton als Verlauf', () => {
    const row = speciesRow(withCap(['#7a5230', '#c9a877']), I18N);

    expect(row.tint).toEqual(['#7a5230', '#c9a877']);
  });

  it('lässt eine Art ohne Hutfarbe den Vorgabeton nehmen', () => {
    const row = speciesRow(withCap([]), I18N);

    expect(row.tint).toBeUndefined();
  });

  it('verwirft einen Ton, den kein Browser lesen kann', () => {
    const row = speciesRow(withCap(['', 'weiss']), I18N);

    expect(row.tint).toBeUndefined();
  });

  it('setzt einer einzigen Hutfarbe ein dunkleres Ende entgegen', () => {
    const row = speciesRow(withCap(['#ffffff']), I18N);

    expect(row.tint).toEqual(['#ffffff', '#c7c7c7']);
  });

  it('nimmt den einen gültigen Ton und schattiert ihn', () => {
    const row = speciesRow(withCap(['', '#f3efe6']), I18N);

    expect(row.tint).toEqual(['#f3efe6', '#bebab3']);
  });
});
