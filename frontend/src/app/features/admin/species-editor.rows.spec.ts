import type { SpeciesEntry } from '../../core/api/models';
import {
  basicsRow,
  changeRows,
  featureRows,
  lookalikeRows,
  moreRows,
  reactionRows,
  sourceRows,
  spanText,
  type RowText,
} from './species-editor.rows';

const WORDS: Record<string, string> = {
  'species.field.cap': 'Hut',
  'species.field.tubes': 'Röhren',
  'species.field.stem': 'Stiel',
  'species.field.flesh': 'Fleisch',
  'species.field.ring': 'Ring',
  'enum.ring_shape.pendant': 'hängend',
  'species.section.period': 'Zeitraum',
  'species.section.hymenium': 'Fruchtschicht',
  'species.section.senses': 'Geruch und Geschmack',
  'enum.hymenium.gills': 'Lamellen',
  'enum.month.6': 'Juni',
  'enum.month.10': 'Oktober',
  'enum.unit.cm': 'cm',
  'enum.unit.um': 'µm',
  'common.to': 'bis',
  'admin.species.section.basics': 'Name und Einordnung',
  'admin.species.section.trees': 'Bäume',
  'admin.species.section.texts': 'Weitere Texte',
  'species.field.habitat': 'Vorkommen',
  'species.field.milk': 'Milch',
  'enum.edibility.edible': 'essbar',
  'enum.protection.personal_use': 'für den Eigenbedarf',
};

function text(locale = 'de'): RowText {
  return { text: (key) => WORDS[key] ?? key, locale, term: (one) => one.name, colour: (one) => one.name };
}

function entry(part: Partial<SpeciesEntry>): SpeciesEntry {
  return {
    measurements: [],
    colours: [],
    colourChanges: [],
    lookalikes: [],
    sources: [],
    traits: [],
    partNotes: [],
    terms: [],
    ...part,
  } as unknown as SpeciesEntry;
}

describe('spanText', () => {
  it('schreibt Zahl und Einheit in der Sprache der Oberfläche', () => {
    const one = { dimension: 'length', unit: 'um', low: 0.7, high: 1.5 } as const;
    expect(spanText(one, text('de'))).toBe('0,7 bis 1,5 µm');
    expect(spanText(one, text('en'))).toBe('0.7 bis 1.5 µm');
  });
});

describe('featureRows', () => {
  it('nennt beim Ring zuerst die Form', () => {
    const rows = featureRows(
      entry({
        ringShape: 'pendant',
        colours: [{ part: 'ring', mode: 'single', colours: [{ name: 'weiß', hex: '#f4efe2' }] }],
      }),
      [],
      text(),
    );

    expect(rows).toEqual([{ key: 'ring', title: 'Ring', value: 'hängend, weiß' }]);
  });

  it('setzt Maß und Farben eines Teils zusammen', () => {
    const rows = featureRows(
      entry({
        measurements: [{ part: 'cap', measurements: [{ dimension: 'width', unit: 'cm', low: 4, high: 20 }] }],
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
      text(),
    );

    expect(rows).toEqual([{ key: 'cap', title: 'Hut', value: '4 bis 20 cm, hellbraun bis dunkelbraun' }]);
  });

  it('nennt ein Teil mit nur einem Text und zeigt dann den Text', () => {
    const rows = featureRows(entry({ traits: [{ key: 'flesh', text: 'Weiß, fest.' }] }), [], text());

    expect(rows).toEqual([{ key: 'flesh', title: 'Fleisch', value: 'Weiß, fest.' }]);
  });

  it('zeigt Maß und Farbe vor dem Text, nicht beide', () => {
    const rows = featureRows(
      entry({
        measurements: [{ part: 'cap', measurements: [{ dimension: 'width', unit: 'cm', low: 4, high: 20 }] }],
        traits: [{ key: 'cap', text: 'Ein langer Text.' }],
      }),
      [],
      text(),
    );

    expect(rows[0].value).toBe('4 bis 20 cm');
  });

  it('lässt Merkmale ohne Teil weg, zum Beispiel das Vorkommen', () => {
    expect(featureRows(entry({ traits: [{ key: 'habitat', text: 'Wiesen' }] }), [], text())).toEqual([]);
  });

  it('nennt ein gewähltes Teil ohne Wert', () => {
    expect(featureRows(entry({}), ['stem'], text())).toEqual([{ key: 'stem', title: 'Stiel', value: '' }]);
  });
});

describe('changeRows', () => {
  it('nennt die Auslöser und die Farbe danach', () => {
    const rows = changeRows(
      entry({
        colourChanges: [
          {
            part: 'flesh',
            kind: 'mechanical',
            from: null,
            to: { name: 'braun', hex: '#7a5230' },
            speed: 'longer',
            triggers: [{ id: 't', slug: 'cut', name: 'Schnitt', kind: 'trigger' }],
          },
        ],
      }),
      text(),
    );

    expect(rows).toEqual([{ key: 'verfaerbung-0', title: 'Schnitt', value: 'braun' }]);
  });

  it('nennt die Farbe in der Sprache der Oberfläche', () => {
    const english = {
      ...text('en'),
      colour: (one: { name: string }) => (one.name === 'braun' ? 'brown' : one.name),
    };
    const rows = changeRows(
      entry({
        colourChanges: [
          {
            part: 'flesh',
            kind: 'mechanical',
            from: null,
            to: { name: 'braun', hex: '#7a5230' },
            speed: 'longer',
            triggers: [],
          },
        ],
      }),
      english,
    );

    expect(rows[0].value).toBe('brown');
  });
});

describe('moreRows', () => {
  it('nennt Zeitraum, Fruchtschicht und die Sinne', () => {
    const rows = moreRows(
      entry({
        periodStartMonth: 6,
        periodEndMonth: 10,
        hymeniumType: 'gills',
        smellText: 'Pilzig.',
        tasteText: 'Mild.',
      }),
      text(),
    );

    expect(rows.map((one) => one.value)).toEqual(['Juni bis Oktober', 'Lamellen', 'Pilzig. · Mild.', '', '']);
    expect(rows.map((one) => one.key)).toEqual(['zeitraum', 'fruchtschicht', 'sinne', 'baeume', 'texte']);
  });

  it('nennt die Bäume und die Titel der weiteren Texte', () => {
    const rows = moreRows(
      entry({
        terms: [
          { term: { id: 't-1', slug: 'beech', name: 'Buche', kind: 'tree' }, fromExperience: false },
          { term: { id: 't-2', slug: 'fruity', name: 'fruchtig', kind: 'smell' }, fromExperience: false },
          { term: { id: 't-3', slug: 'oak', name: 'Eiche', kind: 'tree' }, fromExperience: true },
        ],
        traits: [
          { key: 'milk', text: 'Weiß.' },
          { key: 'cap', text: 'Braun.' },
          { key: 'habitat', text: 'Laubwald.' },
        ],
      }),
      text(),
    );

    expect(rows[3].value).toBe('Buche, Eiche');
    expect(rows[4].value).toBe('Vorkommen, Milch');
  });

  it('lässt fehlende Werte leer', () => {
    expect(moreRows(entry({}), text()).map((one) => one.value)).toEqual(['', '', '', '', '']);
  });
});

describe('basicsRow', () => {
  it('nennt lateinischen Namen, Speisewert und Schutz', () => {
    const row = basicsRow(
      entry({ scientificName: 'Boletus edulis', edibility: 'edible', protection: 'personal_use' }),
      text(),
    );

    expect(row).toEqual({
      key: 'stammdaten',
      title: 'Name und Einordnung',
      value: 'Boletus edulis · essbar · für den Eigenbedarf',
    });
  });
});

describe('reactionRows', () => {
  it('nennt Reagenz und Wortlaut, ohne Namen den Schlüssel', () => {
    const reaction = {
      reading: 'KOH gelb',
      part: null,
      location: null,
      result: 'positive' as const,
      colour: null,
      contested: false,
      partlyConfirmed: false,
      sources: [],
    };
    const rows = reactionRows(
      entry({
        reactions: [
          { ...reaction, reagent: { slug: 'koh', name: 'Kalilauge' } },
          { ...reaction, reagent: { slug: 'feso4', name: '' }, reading: 'FeSO4 grün' },
        ],
      }),
      text(),
    );

    expect(rows).toEqual([
      { key: 'reaktion-0', title: 'Kalilauge', value: 'KOH gelb' },
      { key: 'reaktion-1', title: 'feso4', value: 'FeSO4 grün' },
    ]);
  });

  it('gibt ohne Reaktionen keine Zeile', () => {
    expect(reactionRows(entry({}), text())).toEqual([]);
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

  it('nennt auf Englisch den lateinischen Namen, wie die ganze App', () => {
    const rows = lookalikeRows(
      entry({
        lookalikes: [
          {
            slug: 'a',
            name: 'Gallenröhrling',
            scientificName: 'Tylopilus felleus',
            edibility: 'inedible',
            capColours: [],
            difference: null,
          },
        ],
      }),
      'en',
    );

    expect(rows[0]?.title).toBe('Tylopilus felleus');
  });
});
