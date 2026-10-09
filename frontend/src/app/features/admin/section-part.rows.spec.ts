import type { Measurement, SpeciesEntry, TermRef } from '../../core/api/models';
import { DIMENSION_TEXT } from '../species/labels';
import { changeRows, colourRows, sizeRows, swatchOf } from './section-part.rows';

const SPECIES = {
  measurements: [
    {
      part: 'cap',
      measurements: [{ dimension: 'width', unit: 'cm', low: 4, high: 20 }],
    },
  ],
  colours: [
    {
      part: 'cap',
      mode: 'gradient',
      colours: [
        { name: 'hellbraun', hex: '#e2c79a' },
        { name: 'dunkelbraun', hex: '#5a3d22' },
      ],
    },
    { part: 'stem', mode: 'single', colours: [{ name: 'weiß', hex: '#ffffff' }] },
  ],
  colourChanges: [
    {
      part: 'stem',
      kind: 'mechanical',
      from: null,
      to: { name: 'blau', hex: '#5b7fb0' },
      speed: null,
      triggers: [],
    },
    {
      part: 'cap',
      kind: 'mechanical',
      from: { name: 'weiß', hex: '#f4efe2' },
      to: { name: 'blau', hex: '#5b7fb0' },
      speed: '1min',
      triggers: [{ id: 'a-4', slug: 'cut', name: 'Schnitt', kind: 'trigger' }],
    },
  ],
} as unknown as SpeciesEntry;

function span(one: Measurement): { value: string; unit: string } {
  return { value: `${String(one.low)} – ${String(one.high)}`, unit: one.unit };
}

const NAME = (one: TermRef): string => one.name;

describe('section-part.rows', () => {
  it('führt je Maß eine Zeile mit Strecke, Spanne und Einheit', () => {
    expect(sizeRows(SPECIES, 'cap', DIMENSION_TEXT, span)).toEqual([
      { dimension: 'width', title: 'enum.dimension.width', value: '4 – 20', unit: 'cm' },
    ]);
    expect(sizeRows(SPECIES, 'gills', DIMENSION_TEXT, span)).toEqual([]);
    expect(sizeRows(null, 'cap', DIMENSION_TEXT, span)).toEqual([]);
  });

  it('führt je Farbgruppe des Teils eine Zeile mit Namen und Farbfeld', () => {
    const rows = colourRows(SPECIES, 'cap', 'Hutfarbe', 'bis');

    expect(rows).toEqual([
      {
        key: 'farbe-0',
        title: 'Hutfarbe',
        subline: 'hellbraun bis dunkelbraun',
        swatch: 'linear-gradient(90deg, #e2c79a, #5a3d22)',
        at: 0,
      },
    ]);
  });

  it('malt mehrere Farben als harte Streifen und eine Farbe als Fläche', () => {
    const two = [
      { name: 'a', hex: '#111111' },
      { name: 'b', hex: '#222222' },
    ];
    expect(swatchOf({ part: 'cap', mode: 'distinct', colours: two })).toBe(
      'linear-gradient(90deg, #111111 0% 50%, #222222 50% 100%)',
    );
    expect(swatchOf({ part: 'cap', mode: 'single', colours: [two[0]] })).toBe('#111111');
  });

  it('führt je Verfärbung des Teils eine Zeile mit ihrer Stelle in der Art', () => {
    const rows = changeRows(SPECIES, 'cap', NAME);

    expect(rows).toHaveLength(1);
    expect(rows[0].at).toBe(1);
    expect(rows[0].title).toBe('Schnitt');
    expect(rows[0].subline).toBe('blau');
  });

  it('nennt die Auslöser in der Sprache der Oberfläche', () => {
    const rows = changeRows(SPECIES, 'cap', () => 'Cut');

    expect(rows[0].title).toBe('Cut');
  });
});
