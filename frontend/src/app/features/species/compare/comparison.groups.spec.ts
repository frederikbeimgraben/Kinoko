import { TestBed } from '@angular/core/testing';
import { I18nService } from '../../../core/i18n/i18n.service';
import { speciesEntry } from '../../../testing/species-fixture';
import { compareGroups } from './comparison.groups';

const WHITE = { name: 'weiß', hex: '#f2efe6' };
const BROWN = { name: 'braun', hex: '#7a5230' };
const DARK_PINK = { name: 'dunkelrosa', hex: '#d9a0ac' };

const STONE = speciesEntry({
  slug: 'steinpilz',
  name: 'Steinpilz',
  scientificName: 'Boletus edulis',
  edibility: 'edible',
  protection: 'personal_use',
  hymeniumType: 'tubes',
  measurements: [{ part: 'cap', measurements: [{ dimension: 'width', unit: 'cm', low: 4, high: 20 }] }],
  colours: [{ part: 'cap', mode: 'distinct', colours: [WHITE, BROWN] }],
  partNotes: [{ part: 'stem', description: 'fein, weiß', comment: '' }],
});

const KNIGHT = speciesEntry({
  slug: 'gift',
  name: 'Grüner Knollenblätterpilz',
  scientificName: 'Amanita phalloides',
  edibility: 'deadly',
  protection: 'none',
  hymeniumType: 'gills',
  colours: [{ part: 'gills', mode: 'single', colours: [WHITE] }],
});

function i18n(): I18nService {
  return TestBed.inject(I18nService);
}

describe('compareGroups', () => {
  it('trägt eine Auszeichnung für den Speisewert', () => {
    const groups = compareGroups([STONE, KNIGHT], i18n(), false);
    const row = groups[0]?.rows.find((one) => one.key === 'Speisewert');

    expect(row?.cells[0]).toEqual({
      kind: 'badge',
      text: 'essbar',
      colour: 'var(--color-primary)',
      background: 'var(--color-primary-subtle)',
    });
    expect(row?.cells[1]?.kind).toBe('badge');
  });

  it('trägt einen Wert mit Einheit für ein Maß', () => {
    const groups = compareGroups([STONE, KNIGHT], i18n(), false);
    const cap = groups.find((one) => one.label === 'Hut');
    const width = cap?.rows.find((one) => one.key === 'Breite');

    expect(width?.cells[0]).toEqual({ kind: 'value', text: '4 – 20', unit: 'cm' });
    expect(width?.cells[1]).toEqual({ kind: 'none' });
  });

  it('trägt eine Fläche für eine Farbe', () => {
    const groups = compareGroups([STONE, KNIGHT], i18n(), false);
    const cap = groups.find((one) => one.label === 'Hut');
    const colour = cap?.rows.find((one) => one.key === 'Farbe');

    expect(colour?.cells[0]).toEqual({
      kind: 'swatch',
      colours: [WHITE, BROWN],
      mode: 'multiple',
      text: 'weiß, braun',
    });
  });

  it('trägt einen Fließtext für eine Notiz', () => {
    const groups = compareGroups([STONE, KNIGHT], i18n(), false);
    const stem = groups.find((one) => one.label === 'Stiel');
    const net = stem?.rows.find((one) => one.key === 'Netz');

    expect(net?.cells[0]).toEqual({ kind: 'plain', text: 'fein, weiß' });
    expect(net?.cells[1]).toEqual({ kind: 'none' });
  });

  it('lässt eine Zeile aus, für die keine Art einen Wert trägt', () => {
    const groups = compareGroups([STONE, KNIGHT], i18n(), false);
    const ring = groups.find((one) => one.label === 'Ring');

    expect(ring).toBeUndefined();
  });

  it('lässt eine Gruppe ohne Zeile ganz aus', () => {
    const bare = speciesEntry({ slug: 'bare', name: 'Bare', scientificName: 'Bare' });
    const groups = compareGroups([bare, bare], i18n(), false);

    expect(groups.find((one) => one.label === 'Hut')).toBeUndefined();
    expect(groups.find((one) => one.label === 'Ring')).toBeUndefined();
  });

  it('zeigt bei „nur Unterschiede“ nur die Zeilen, die sich unterscheiden', () => {
    const all = compareGroups([STONE, KNIGHT], i18n(), false);
    const onlyDiff = compareGroups([STONE, KNIGHT], i18n(), true);
    const hymeniumAll = all.find((one) => one.label === 'Fruchtschicht');
    const hymeniumDiff = onlyDiff.find((one) => one.label === 'Fruchtschicht');

    expect(hymeniumAll?.rows.length).toBeGreaterThan(0);
    expect(hymeniumDiff?.rows.every((row) => row.diff)).toBe(true);
  });

  it('nimmt gleiche Werte aus „nur Unterschiede“ heraus', () => {
    const twin = speciesEntry({
      slug: 'zwilling',
      name: 'Zwilling',
      scientificName: 'Zwilling',
      edibility: 'edible',
      protection: 'personal_use',
    });
    const groups = compareGroups([STONE, twin], i18n(), true);
    const classification = groups.find((one) => one.label === 'Einstufung');

    expect(classification?.rows.find((one) => one.key === 'Speisewert')).toBeUndefined();
  });

  it('trägt eine Zeile je Auslöser der Verfärbung, sonst gar keine Gruppe', () => {
    const groups = compareGroups([STONE, KNIGHT], i18n(), false);
    const reaction = groups.find((one) => one.label === 'Verfärbung');

    expect(reaction).toBeUndefined();
  });

  it('zeigt einen Auslöser, den nur eine Art trägt, mit „keine Angabe“ für die andere', () => {
    const tested = speciesEntry({
      slug: 'getestet',
      name: 'Getestet',
      scientificName: 'Getestet',
      colourChanges: [
        {
          part: 'flesh',
          kind: 'mechanical',
          from: WHITE,
          to: DARK_PINK,
          speed: '1min',
          triggers: [{ id: 't1', slug: 'cut', name: 'Anschnitt', kind: 'trigger' }],
        },
      ],
    });
    const untested = speciesEntry({ slug: 'untested', name: 'Untested', scientificName: 'Untested' });
    const groups = compareGroups([tested, untested], i18n(), false);
    const reaction = groups.find((one) => one.label === 'Verfärbung');
    const row = reaction?.rows.find((one) => one.key === 'Anschnitt');

    expect(row?.cells[0]).toEqual({
      kind: 'swatch',
      colours: [DARK_PINK],
      mode: 'single',
      text: 'dunkelrosa',
    });
    expect(row?.cells[1]).toEqual({ kind: 'plain', text: 'keine Angabe' });
  });
});
