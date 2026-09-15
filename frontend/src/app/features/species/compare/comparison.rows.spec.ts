import { TestBed } from '@angular/core/testing';
import { I18nService } from '../../../core/i18n/i18n.service';
import { speciesEntry } from '../../../testing/species-fixture';
import {
  capWidthOf,
  hymeniumPartOf,
  levelOf,
  monthMarks,
  periodOf,
  pressureOf,
  stemNetOf,
  swatchOf,
  flavoursOf,
} from './comparison.rows';

const WHITE = { name: 'weiß', hex: '#f0ece0' };
const PINK = { name: 'rosa', hex: '#e8c8cf' };
const DARK_PINK = { name: 'dunkelrosa', hex: '#d9a0ac' };

const STONE = speciesEntry({
  slug: 'steinpilz',
  name: 'Steinpilz',
  scientificName: 'Boletus edulis',
  periodStartMonth: 5,
  periodEndMonth: 11,
  measurements: [{ part: 'cap', measurements: [{ dimension: 'width', unit: 'cm', low: 4, high: 20 }] }],
  colours: [{ part: 'tubes', mode: 'distinct', colours: [WHITE, { name: 'oliv', hex: '#cfd08a' }] }],
  traits: [{ key: 'stem', text: 'weiß, fein' }],
  terms: [
    { term: { id: 'a', slug: 'mild', name: 'mild', kind: 'taste' }, fromExperience: false },
    { term: { id: 'b', slug: 'earthy', name: 'erdig', kind: 'smell' }, fromExperience: false },
  ],
});

const GALL = speciesEntry({
  slug: 'gallenroehrling',
  name: 'Gallenröhrling',
  scientificName: 'Tylopilus felleus',
  edibility: 'inedible',
  colours: [{ part: 'tubes', mode: 'single', colours: [PINK] }],
  colourChanges: [
    { part: 'tubes', kind: 'mechanical', from: PINK, to: DARK_PINK, speed: '1min', triggers: [] },
  ],
});

function i18n(): I18nService {
  return TestBed.inject(I18nService);
}

describe('comparison rows', () => {
  it('nennt den Speisewert mit seiner Farbe', () => {
    expect(levelOf(GALL, i18n()).text).toBe('ungenießbar');
  });

  it('liest die Hutbreite mit ihrer Einheit', () => {
    expect(capWidthOf(STONE, i18n())).toEqual({ value: '4 – 20', unit: 'cm' });
  });

  it('lässt die Hutbreite aus, wo kein Maß steht', () => {
    expect(capWidthOf(GALL, i18n())).toBeNull();
  });

  it('nimmt die Farben eines Teils samt Namen', () => {
    expect(swatchOf(STONE, 'tubes')).toEqual({
      colours: STONE.colours[0].colours,
      mode: 'multiple',
      label: 'weiß, oliv',
    });
  });

  it('lässt eine Farbe aus, wo der Teil fehlt', () => {
    expect(swatchOf(STONE, 'gills')).toBeNull();
    expect(swatchOf(STONE, null)).toBeNull();
  });

  it('sucht den Teil der Fruchtschicht über alle Arten', () => {
    expect(hymeniumPartOf([STONE, GALL])).toBe('tubes');
    expect(hymeniumPartOf([])).toBeNull();
  });

  it('zeigt ohne Verfärbung die Farbe der Fruchtschicht allein', () => {
    const test = pressureOf(STONE, 'tubes', i18n());

    expect(test?.from?.mode).toBe('single');
    expect(test?.to).toBeNull();
    expect(test?.speed).toBe('bleibt');
  });

  it('zeigt die Verfärbung mit Von, Nach und Dauer', () => {
    const test = pressureOf(GALL, 'tubes', i18n());

    expect(test?.from?.colours).toEqual([PINK]);
    expect(test?.to?.colours).toEqual([DARK_PINK]);
    expect(test?.speed).toBe('nach 1 min');
  });

  it('nennt eine sofortige Verfärbung ohne ein Nachher', () => {
    const quick = speciesEntry({
      slug: 'maronenroehrling',
      name: 'Maronenröhrling',
      scientificName: 'Imleria badia',
      colourChanges: [{ part: 'tubes', kind: 'mechanical', to: PINK, speed: 'immediate', triggers: [] }],
    });

    expect(pressureOf(quick, null, i18n())?.speed).toBe('sofort');
  });

  it('nennt eine dauerhafte Verfärbung ohne ein Nachher', () => {
    const lasting = speciesEntry({
      slug: 'rotfuss',
      name: 'Rotfußröhrling',
      scientificName: 'Xerocomellus chrysenteron',
      colourChanges: [{ part: 'flesh', kind: 'mechanical', to: PINK, speed: 'permanent', triggers: [] }],
    });

    expect(pressureOf(lasting, null, i18n())?.speed).toBe('bleibt');
  });

  it('lässt die Druckprobe aus, wo weder Farbe noch Verfärbung steht', () => {
    expect(pressureOf(GALL, 'gills', i18n())).not.toBeNull();
    expect(pressureOf(STONE, 'gills', i18n())).toBeNull();
  });

  it('liest das Stielnetz aus dem Merkmal des Stiels', () => {
    expect(stemNetOf(STONE)).toBe('weiß, fein');
    expect(stemNetOf(GALL)).toBeNull();
  });

  it('nimmt nur die Begriffe des Geschmacks', () => {
    expect(flavoursOf(STONE)).toEqual(['mild']);
    expect(flavoursOf(GALL)).toBeNull();
  });

  it('liest die Wachstumszeit als Spanne', () => {
    expect(periodOf(STONE)).toEqual({ from: 5, to: 11 });
    expect(periodOf(GALL)).toBeNull();
  });

  it('kürzt die vier Marken des Jahres', () => {
    expect(monthMarks(i18n())).toEqual(['Jan', 'Apr', 'Jul', 'Okt']);
  });
});
