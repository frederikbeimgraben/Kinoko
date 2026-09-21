import { TestBed } from '@angular/core/testing';
import { I18nService } from '../../../core/i18n/i18n.service';
import { speciesEntry } from '../../../testing/species-fixture';
import { capShapeOf, measurementOf, partNoteOf, seasonOf, senseSmellOf, swatchOf } from './comparison.rows';

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
    expect(swatchOf(STONE, 'cap')).toEqual({
      colours: [WHITE, BROWN],
      mode: 'multiple',
      label: 'weiß, braun',
    });
    expect(swatchOf(STONE, 'ring')).toBeNull();
  });

  it('nennt die Hutform von Jugendform und Altersform, wo sie sich unterscheiden', () => {
    expect(capShapeOf(STONE, i18n())).toBe('halbkugelig bis flach');
    expect(capShapeOf(KNIGHT, i18n())).toBeNull();
  });

  it('liest die Notiz eines Teils', () => {
    expect(partNoteOf(STONE, 'stem')).toBe('fein, weiß');
    expect(partNoteOf(STONE, 'ring')).toBeNull();
  });

  it('nimmt für den Geruch die Marken, sonst nichts', () => {
    expect(senseSmellOf(STONE)).toBe('erdig');
    expect(senseSmellOf(KNIGHT)).toBeNull();
  });

  it('schreibt die Saison mit kurzen Monaten', () => {
    expect(seasonOf(STONE, i18n())).toBe('Juli – Okt.');
    expect(seasonOf(KNIGHT, i18n())).toBeNull();
  });
});
