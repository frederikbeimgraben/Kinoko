import type { ColourChange } from '../../../core/api/models';
import type { I18nService } from '../../../core/i18n/i18n.service';
import type { TranslationKey } from '../../../core/i18n/translations';
import { catalogueOf } from '../../../testing/i18n';
import { PALETTE } from '../../../testing/species-fixture';
import { catalogueNames } from '../catalogue-text';
import type { SpeciesReaction } from '../species.store';
import {
  DAGGER,
  colourChangeRow,
  distinctChanges,
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

const NAMES = catalogueNames(I18N, () => PALETTE);

/** English texts: the stub knows the locale and the optional lookup. */
const ENGLISH_TEXTS: Record<string, string> = {
  'species.reaction.positive': 'positive',
  'species.field.cap': 'Cap',
  'species.field.tubes': 'Tubes',
  'species.colourChange.change': '{part} {from} to {to}',
  'term.trigger.koh': 'Potassium hydroxide (KOH)',
  'term.trigger.pressure': 'Pressure',
  'enum.colour.red': 'Red',
  'enum.colour.yellow': 'Yellow',
  'colour.name.weinrot': 'wine red',
};
const ENGLISH = catalogueOf(ENGLISH_TEXTS);
const EN = {
  locale: () => 'en',
  translate: (key: TranslationKey, values?: Record<string, string | number>) =>
    ENGLISH.translate(key, values),
  translateOptional: (key: string) => ENGLISH_TEXTS[key] ?? key,
} as unknown as I18nService;
const EN_NAMES = catalogueNames(EN, () => PALETTE);

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
    expect(reactionSwatch(reaction(), I18N, NAMES)).toEqual({
      kind: 'fill',
      colours: ['#7a1f3d'],
      label: 'positiv, Weinrot',
    });
  });

  it('hatches the colour of a variable reaction', () => {
    const swatch = reactionSwatch(reaction({ result: 'variable' }), I18N, NAMES);

    expect(swatch.kind).toBe('hatch');
    expect(swatchBackground(swatch)).toContain('repeating-linear-gradient');
    expect(swatchBackground(swatch)).toContain('#7a1f3d');
  });

  it('shows a ring without fill for a negative reaction', () => {
    const swatch = reactionSwatch(reaction({ result: 'negative', colour: null }), I18N, NAMES);

    expect(swatch).toEqual({ kind: 'ring', colours: [], label: 'negativ' });
    expect(swatchBackground(swatch)).toBeNull();
  });

  it('shows no swatch for an unknown result or a result without colour', () => {
    expect(reactionSwatch(reaction({ result: 'unknown', colour: null }), I18N, NAMES).kind).toBe('none');
    expect(reactionSwatch(reaction({ colour: null }), I18N, NAMES).kind).toBe('none');
  });
});

describe('reactionRow', () => {
  it('puts the reagent as label and the part and the reading below, without the free location', () => {
    const row = reactionRow(reaction({ location: 'Hut' }), 0, I18N, NAMES);

    expect(row.label).toBe('Kalilauge');
    expect(row.sub).toBe('Hut · Huthaut weinrot');
    expect(row.plain).toBe('');
  });

  it('shows the free location only where the part is not known', () => {
    const row = reactionRow(reaction({ part: null, location: 'Fleisch, Stielrinde' }), 0, I18N, NAMES);

    expect(row.sub).toBe('Fleisch, Stielrinde · Huthaut weinrot');
  });

  it('translates the reagent and gives the result and the standard colour in English', () => {
    const red = { name: 'weinrot', hex: '#7a1f3d', nearest: '#b8322a' };
    const row = reactionRow(reaction({ colour: red, location: 'Huthaut' }), 0, EN, EN_NAMES);

    expect(row.label).toBe('Potassium hydroxide (KOH)');
    expect(row.sub).toBe('Cap · positive, wine red');
  });

  it('marks a partly confirmed reaction with a dagger and keeps the contested flag', () => {
    const row = reactionRow(reaction({ partlyConfirmed: true, contested: true }), 0, I18N, NAMES);

    expect(row.label).toBe(`Kalilauge ${DAGGER}`);
    expect(row.contested).toBe(true);
    expect(row.partlyConfirmed).toBe(true);
  });

  it('says "keine Angabe" for an unknown result without part or location', () => {
    const row = reactionRow(reaction({ result: 'unknown', colour: null, part: null }), 0, I18N, NAMES);

    expect(row.plain).toBe('keine Angabe');
  });

  it('gives each row its own key', () => {
    expect(reactionRow(reaction(), 0, I18N, NAMES).key).not.toBe(reactionRow(reaction(), 1, I18N, NAMES).key);
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
    const row = colourChangeRow(change, 0, I18N, NAMES);

    expect(row.label).toBe('Druck');
    expect(row.sub).toBe('Röhren blassgelb nach blau');
    expect(row.swatch).toEqual({
      kind: 'range',
      colours: ['#e6dc9a', '#3f5f8a'],
      label: 'Röhren blassgelb nach blau',
    });
  });

  it('translates the trigger and the colours in English', () => {
    const english: ColourChange = {
      ...change,
      from: { name: 'blassgelb', hex: '#e6dc9a', nearest: '#e0b446' },
      to: { name: 'rot', hex: '#c0392b', nearest: '#b8322a' },
      triggers: [{ id: 'p', slug: 'pressure', name: 'Druck', kind: 'trigger' }] as ColourChange['triggers'],
    };
    const row = colourChangeRow(english, 0, EN, EN_NAMES);

    expect(row.label).toBe('Pressure');
    expect(row.sub).toBe('Tubes yellow to red');
  });

  it('fills a change without a start colour', () => {
    const row = colourChangeRow({ ...change, from: null }, 0, I18N, NAMES);

    expect(row.sub).toBe('Röhren nach blau');
    expect(row.swatch.kind).toBe('fill');
  });
});

describe('distinctChanges', () => {
  const trigger = (slug: string) =>
    ({ id: slug, slug, name: slug, kind: 'trigger' }) as ColourChange['triggers'][number];
  const changeBy = (slug: string): ColourChange => ({
    part: 'flesh',
    kind: 'reagent',
    from: null,
    to: { name: 'braun', hex: '#6b4423' },
    triggers: [trigger(slug)],
  });

  it('drops a change of a reagent that has a reaction and keeps the other changes', () => {
    const kept = distinctChanges([changeBy('koh'), changeBy('cut')], [reaction()]);

    expect(kept.map((one) => one.triggers[0].slug)).toEqual(['cut']);
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
