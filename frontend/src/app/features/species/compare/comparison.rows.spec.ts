import { TestBed } from '@angular/core/testing';
import { I18nService } from '../../../core/i18n/i18n.service';
import { PALETTE, speciesEntry } from '../../../testing/species-fixture';
import { catalogueNames } from '../catalogue-text';
import {
  capShapeOf,
  measurementOf,
  partNoteOf,
  ringShapeOf,
  seasonOf,
  senseSmellOf,
  stemFeatureOf,
  swatchOf,
} from './comparison.rows';

const WHITE = { name: 'weiß', hex: '#f2efe6' };
const BROWN = { name: 'braun', hex: '#7a5230' };

const STONE = speciesEntry({
  slug: 'steinpilz',
  name: 'Steinpilz',
  scientificName: 'Boletus edulis',
  periodStartMonth: 7,
  periodEndMonth: 10,
  capShapeYoung: 'hemispherical',
  capShapeOld: 'flat',
  measurements: [{ part: 'cap', measurements: [{ dimension: 'width', unit: 'cm', low: 4, high: 20 }] }],
  colours: [{ part: 'cap', mode: 'distinct', colours: [WHITE, BROWN] }],
  partNotes: [{ part: 'stem', description: 'fein, weiß', comment: '' }],
  terms: [{ term: { id: 'a', slug: 'earthy', name: 'erdig', kind: 'smell' }, fromExperience: false }],
});

const KNIGHT = speciesEntry({
  slug: 'gift',
  name: 'Grüner Knollenblätterpilz',
  scientificName: 'Amanita phalloides',
});

function i18n(): I18nService {
  return TestBed.inject(I18nService);
}

describe('comparison.rows', () => {
  it('liest ein Maß eines Teils mit seiner Einheit', () => {
    expect(measurementOf(STONE, 'cap', 'width', i18n())).toEqual({ value: '4 – 20', unit: 'cm' });
    expect(measurementOf(KNIGHT, 'cap', 'width', i18n())).toBeNull();
  });

  it('nimmt die Farben eines Teils samt Namen', () => {
    expect(
      swatchOf(
        STONE,
        'cap',
        catalogueNames(i18n(), () => PALETTE),
      ),
    ).toEqual({
      colours: [WHITE, BROWN],
      mode: 'multiple',
      label: 'weiß, braun',
    });
    expect(
      swatchOf(
        STONE,
        'ring',
        catalogueNames(i18n(), () => PALETTE),
      ),
    ).toBeNull();
  });

  it('nennt die Hutform von Jugendform und Altersform, wo sie sich unterscheiden', () => {
    expect(capShapeOf(STONE, i18n())).toBe('halbkugelig bis flach');
    expect(capShapeOf(KNIGHT, i18n())).toBeNull();
  });

  it('nennt die Ringform und nimmt ohne Form die Notiz des Rings', () => {
    expect(ringShapeOf({ ...STONE, ringShape: 'flaring' }, i18n())).toBe('abstehend');
    const noted = { ...STONE, partNotes: [{ part: 'ring' as const, description: 'häutig', comment: '' }] };
    expect(ringShapeOf(noted, i18n())).toBe('häutig');
    expect(ringShapeOf(STONE, i18n())).toBeNull();
  });

  it('liest die Notiz eines Teils', () => {
    expect(partNoteOf(STONE, 'stem')).toBe('fein, weiß');
    expect(partNoteOf(STONE, 'ring')).toBeNull();
  });

  it('nimmt für den Geruch die Marken, sonst nichts', () => {
    expect(
      senseSmellOf(
        STONE,
        catalogueNames(i18n(), () => PALETTE),
      ),
    ).toBe('erdig');
    expect(
      senseSmellOf(
        KNIGHT,
        catalogueNames(i18n(), () => PALETTE),
      ),
    ).toBeNull();
  });

  it('zeigt den deutschen Geruchssatz nur auf Deutsch', async () => {
    const worded = speciesEntry({ ...KNIGHT, smellText: 'Nussig, der typische Steinpilzgeruch.' });
    expect(
      senseSmellOf(
        worded,
        catalogueNames(i18n(), () => PALETTE),
      ),
    ).toBe('Nussig, der typische Steinpilzgeruch.');

    i18n().setLocale('en');
    await vi.waitFor(() => {
      expect(i18n().locale()).toBe('en');
    });
    expect(
      senseSmellOf(
        worded,
        catalogueNames(i18n(), () => PALETTE),
      ),
    ).toBeNull();
    i18n().setLocale('de');
  });

  it('sagt ja oder nein zu einem Stielmerkmal, ohne Stieldaten nichts', () => {
    const ringed = speciesEntry({ ...KNIGHT, stemFeatures: [{ feature: 'ring', phase: 'old' }] });

    expect(stemFeatureOf(ringed, ['ring'], i18n())).toBe('ja');
    expect(stemFeatureOf(ringed, ['volva'], i18n())).toBe('nein');
    expect(stemFeatureOf(KNIGHT, ['ring'], i18n())).toBeNull();
  });

  it('schreibt die Saison mit kurzen Monaten', () => {
    expect(seasonOf(STONE, i18n())).toBe('Juli – Okt.');
    expect(seasonOf(KNIGHT, i18n())).toBeNull();
  });
});
