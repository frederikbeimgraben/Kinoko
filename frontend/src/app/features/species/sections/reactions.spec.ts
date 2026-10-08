import type { ColourChange } from '../../../core/api/models';
import { catalogueOf } from '../../../testing/i18n';
import type { SpeciesReaction } from '../species.store';
import {
  DAGGER,
  colourChangeRow,
  hostOf,
  reactionRow,
  reactionSources,
  reactionSwatch,
  swatchBackground,
} from './reactions';

const I18N = catalogueOf({
  'species.reaction.positive': 'positiv',
  'species.reaction.negative': 'negativ',
  'species.reaction.variable': 'wechselnd',
  'species.reaction.unknown': 'keine Angabe',
  'species.field.cap': 'Hut',
  'species.field.flesh': 'Fleisch',
  'species.field.tubes': 'Röhren',
  'species.colourChange.change': '{part} {from} nach {to}',
  'species.colourChange.changeTo': '{part} nach {to}',
});

/** A reaction with all fields of the contract. The seed sets the fields of one case. */
function reaction(seed: Partial<SpeciesReaction> = {}): SpeciesReaction {
  return {
    reagent: { slug: 'koh', name: 'Kalilauge' },
    reading: 'Huthaut weinrot',
    part: 'cap',
    location: null,
    result: 'positive',
    colour: { name: 'Weinrot', hex: '#7a1f3d' },
    contested: false,
    partlyConfirmed: false,
    sources: [],
    ...seed,
  };
}

describe('reactionSwatch', () => {
  it('fills the swatch with the colour of a positive reaction', () => {
    expect(reactionSwatch(reaction(), I18N)).toEqual({
      kind: 'fill',
      colours: ['#7a1f3d'],
      label: 'positiv, Weinrot',
    });
  });

  it('hatches the colour of a variable reaction', () => {
    const swatch = reactionSwatch(reaction({ result: 'variable' }), I18N);

    expect(swatch.kind).toBe('hatch');
    expect(swatchBackground(swatch)).toContain('repeating-linear-gradient');
    expect(swatchBackground(swatch)).toContain('#7a1f3d');
  });

  it('shows a ring without fill for a negative reaction', () => {
    const swatch = reactionSwatch(reaction({ result: 'negative', colour: null }), I18N);

    expect(swatch).toEqual({ kind: 'ring', colours: [], label: 'negativ' });
    expect(swatchBackground(swatch)).toBeNull();
  });

  it('shows no swatch for an unknown result or a result without colour', () => {
    expect(reactionSwatch(reaction({ result: 'unknown', colour: null }), I18N).kind).toBe('none');
    expect(reactionSwatch(reaction({ colour: null }), I18N).kind).toBe('none');
  });
});

describe('reactionRow', () => {
  it('puts the reagent as label, the reading below and the part and location at the end', () => {
    const row = reactionRow(reaction({ location: 'Rand' }), 0, I18N);

    expect(row.label).toBe('Kalilauge');
    expect(row.sub).toBe('Huthaut weinrot');
    expect(row.plain).toBe('Hut, Rand');
  });

  it('marks a partly confirmed reaction with a dagger and keeps the contested flag', () => {
    const row = reactionRow(reaction({ partlyConfirmed: true, contested: true }), 0, I18N);

    expect(row.label).toBe(`Kalilauge ${DAGGER}`);
    expect(row.contested).toBe(true);
    expect(row.partlyConfirmed).toBe(true);
  });

  it('says "keine Angabe" for an unknown result without part or location', () => {
    const row = reactionRow(reaction({ result: 'unknown', colour: null, part: null }), 0, I18N);

    expect(row.plain).toBe('keine Angabe');
  });

  it('gives each row its own key', () => {
    expect(reactionRow(reaction(), 0, I18N).key).not.toBe(reactionRow(reaction(), 1, I18N).key);
  });
});

describe('colourChangeRow', () => {
  const change: ColourChange = {
    part: 'tubes',
    kind: 'mechanical',
    from: { name: 'blassgelb', hex: '#e6dc9a' },
    to: { name: 'blau', hex: '#3f5f8a' },
    triggers: [{ id: 'druck', slug: 'druck', name: 'Druck', kind: 'trigger' }] as ColourChange['triggers'],
  };

  it('puts the triggers as label and the change as a range', () => {
    const row = colourChangeRow(change, 0, I18N);

    expect(row.label).toBe('Druck');
    expect(row.sub).toBe('Röhren blassgelb nach blau');
    expect(row.swatch).toEqual({
      kind: 'range',
      colours: ['#e6dc9a', '#3f5f8a'],
      label: 'Röhren blassgelb nach blau',
    });
  });

  it('fills a change without a start colour', () => {
    const row = colourChangeRow({ ...change, from: null }, 0, I18N);

    expect(row.sub).toBe('Röhren nach blau');
    expect(row.swatch.kind).toBe('fill');
  });
});

describe('reactionSources', () => {
  it('lists each source one time with its host and year', () => {
    const source = { label: 'Pilzkunde', url: 'https://www.pilzkunde.de/koh', year: '2019' };
    const rows = reactionSources([
      reaction({ sources: [source] }),
      reaction({ sources: [source, { label: 'Notiz', url: null, year: null }] }),
    ]);

    expect(rows).toEqual([
      { label: 'Pilzkunde', sub: 'pilzkunde.de · 2019', url: 'https://www.pilzkunde.de/koh' },
      { label: 'Notiz', sub: '', url: null },
    ]);
  });

  it('gives no host for an address that does not parse', () => {
    expect(hostOf('kein Weg')).toBe('');
    expect(hostOf(null)).toBe('');
  });
});
