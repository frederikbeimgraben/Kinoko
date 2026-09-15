import type { I18nService } from '../../core/i18n/i18n.service';
import { speciesEntry } from '../../testing/species-fixture';
import { speciesRow } from './rows';

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
});
