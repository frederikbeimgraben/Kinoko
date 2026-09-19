import type { Measurement, SpeciesEntry } from '../../core/api/models';
import { DIMENSION_TEXT } from '../species/labels';
import { changeRows, colourRows, sizeRows } from './section-part.rows';

const SPECIES = {
  measurements: [
    {
      part: 'cap',
      measurements: [{ dimension: 'width', unit: 'cm', low: 4, high: 20 }],
    },
  ],
  colours: [
    { part: 'cap', mode: 'gradient', colours: [{ name: 'hellbraun', hex: '#e2c79a' }] },
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

function span(one: Measurement): string {
  return `${one.low} bis ${one.high} ${one.unit}`;
}

describe('section-part.rows', () => {
  it('führt je Maß eine Zeile mit Strecke und Spanne', () => {
    expect(sizeRows(SPECIES, 'cap', DIMENSION_TEXT, span)).toEqual([
      { dimension: 'width', title: 'enum.dimension.width', value: '4 bis 20 cm' },
    ]);
    expect(sizeRows(SPECIES, 'gills', DIMENSION_TEXT, span)).toEqual([]);
    expect(sizeRows(null, 'cap', DIMENSION_TEXT, span)).toEqual([]);
  });

  it('führt je Farbgruppe des Teils eine Zeile', () => {
    const rows = colourRows(SPECIES, 'cap', 'Farbe');

    expect(rows).toHaveLength(1);
    expect(rows[0].gradient).toBe(true);
    expect(rows[0].colours).toEqual([{ name: 'hellbraun', hex: '#e2c79a' }]);
  });

  it('führt je Verfärbung des Teils eine Zeile mit ihrer Stelle in der Art', () => {
    const rows = changeRows(SPECIES, 'cap');

    expect(rows).toHaveLength(1);
    expect(rows[0].at).toBe(1);
    expect(rows[0].title).toBe('Schnitt');
    expect(rows[0].colours).toHaveLength(2);
  });

  it('lässt eine Verfärbung ohne Anfangsfarbe die Endfarbe allein tragen', () => {
    const rows = changeRows(SPECIES, 'stem');

    expect(rows[0].colours).toEqual([{ name: 'blau', hex: '#5b7fb0' }]);
    expect(rows[0].title).toBe('');
  });
});
