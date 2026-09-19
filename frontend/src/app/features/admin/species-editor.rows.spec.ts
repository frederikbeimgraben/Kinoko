import type { SpeciesEntry } from '../../core/api/models';
import { featureRows, lookalikeRows, sourceRows } from './species-editor.rows';

const TEXT = (key: string): string => (key === 'species.field.cap' ? 'Hut' : 'Röhren');

function entry(part: Partial<SpeciesEntry>): SpeciesEntry {
  return {
    measurements: [],
    colours: [],
    lookalikes: [],
    sources: [],
    traits: [],
    ...part,
  } as unknown as SpeciesEntry;
}

describe('featureRows', () => {
  it('setzt Maß und Farben eines Teils zusammen', () => {
    const rows = featureRows(
      entry({
        measurements: [
          {
            part: 'cap',
            measurements: [
              { dimension: 'width', unit: 'cm', low: 4, high: 20, rareLow: null, rareHigh: null },
            ],
          },
        ],
        colours: [
          {
            part: 'cap',
            mode: 'gradient',
            colours: [
              { name: 'hellbraun', hex: '#b08a5a' },
              { name: 'dunkelbraun', hex: '#5a3d22' },
            ],
          },
        ],
      }),
      [],
      TEXT,
      'bis',
    );

    expect(rows).toEqual([{ key: 'cap', title: 'Hut', value: '4 bis 20 cm, hellbraun bis dunkelbraun' }]);
  });

  it('nennt ein Teil auch ohne Maß, wenn es Farben trägt', () => {
    const rows = featureRows(
      entry({
        colours: [
          { part: 'tubes', mode: 'single', colours: [{ name: 'jung weiß', hex: '#f4efe2' }] },
          {
            part: 'tubes',
            mode: 'gradient',
            colours: [
              { name: 'später gelb', hex: '#d9c04a' },
              { name: 'oliv', hex: '#6f7a3a' },
            ],
          },
        ],
      }),
      [],
      TEXT,
      'bis',
    );

    expect(rows).toEqual([{ key: 'tubes', title: 'Röhren', value: 'jung weiß, später gelb bis oliv' }]);
  });

  it('lässt ein Teil ohne Farben und ohne Maß weg', () => {
    expect(featureRows(entry({}), [], TEXT, 'bis')).toEqual([]);
  });

  it('nennt ein gewähltes Teil ohne Wert', () => {
    expect(featureRows(entry({}), ['stem'], () => 'Stiel', 'bis')).toEqual([
      { key: 'stem', title: 'Stiel', value: '' },
    ]);
  });

  it('hängt den Text eines Teils hinter Maß und Farbe', () => {
    const rows = featureRows(
      entry({ traits: [{ key: 'tubes', text: 'Poren fein und rund' }] }),
      ['tubes'],
      TEXT,
      'bis',
    );

    expect(rows).toEqual([{ key: 'tubes', title: 'Röhren', value: 'Poren fein und rund' }]);
  });
});

describe('sourceRows', () => {
  it('nennt den Titel und die Adresse', () => {
    const rows = sourceRows(
      entry({
        sources: [
          {
            scope: 'profile',
            title: '123pilzsuche.de',
            url: '123pilzsuche.de/daten/details/Steinpilz.htm',
            checkedOn: '2026-09-10',
          },
        ],
      }),
    );

    expect(rows).toEqual([
      {
        key: 'quelle-0',
        title: '123pilzsuche.de',
        value: '123pilzsuche.de/daten/details/Steinpilz.htm',
      },
    ]);
  });
});

describe('lookalikeRows', () => {
  it('nennt den Unterschied, sonst nichts', () => {
    const rows = lookalikeRows(
      entry({
        lookalikes: [
          {
            slug: 'a',
            name: 'Gallenröhrling',
            scientificName: 'T. felleus',
            edibility: 'inedible',
            capColours: [],
            difference: 'bitter',
          },
          {
            slug: 'b',
            name: 'Maronenröhrling',
            scientificName: 'I. badia',
            edibility: 'edible',
            capColours: [],
            difference: null,
          },
        ],
      }),
    );

    expect(rows).toEqual([
      { key: 'a', title: 'Gallenröhrling', value: 'bitter' },
      { key: 'b', title: 'Maronenröhrling', value: '' },
    ]);
  });
});
