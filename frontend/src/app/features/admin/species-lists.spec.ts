import type { ColourChange, ColourGroup, SpeciesEntry } from '../../core/api/models';
import {
  colourGroupAt,
  colourGroups,
  lookalikeWrites,
  withChange,
  withColourGroup,
  withLookalike,
  withoutChange,
  withoutColourGroup,
  withoutLookalike,
  withoutMeasurement,
  withoutPart,
} from './species-lists';

const CAP_COLOUR = {
  part: 'cap',
  mode: 'gradient',
  colours: [{ name: 'hellbraun', hex: '#b08a5a' }],
} as unknown as ColourGroup;

const TUBE_COLOUR = {
  part: 'tubes',
  mode: 'single',
  colours: [{ name: 'weiß', hex: '#f4efe2' }],
} as unknown as ColourGroup;

const TUBE_LATER = {
  part: 'tubes',
  mode: 'gradient',
  colours: [{ name: 'gelb', hex: '#d9c04a' }],
} as unknown as ColourGroup;

const CAP_CHANGE = { part: 'cap', triggers: [] } as unknown as ColourChange;
const TUBE_CHANGE = { part: 'tubes', triggers: [] } as unknown as ColourChange;

const SPECIES = {
  measurements: [
    {
      part: 'cap',
      measurements: [
        { dimension: 'width', unit: 'cm', low: 4, high: 20, rareLow: null, rareHigh: null },
        { dimension: 'height', unit: 'cm', low: 3, high: 8, rareLow: null, rareHigh: null },
      ],
    },
    {
      part: 'stem',
      measurements: [{ dimension: 'width', unit: 'cm', low: 2, high: 6, rareLow: null, rareHigh: null }],
    },
  ],
  colours: [CAP_COLOUR, TUBE_COLOUR, TUBE_LATER],
  colourChanges: [CAP_CHANGE, TUBE_CHANGE],
  lookalikes: [
    { slug: 'tylopilus-felleus', difference: 'bitter' },
    { slug: 'imleria-badia', difference: null },
  ],
} as unknown as SpeciesEntry;

describe('species-lists', () => {
  it('führt die Farbgruppen eines Teils in ihrer Reihenfolge', () => {
    expect(colourGroups(SPECIES, 'tubes')).toEqual([TUBE_COLOUR, TUBE_LATER]);
    expect(colourGroupAt(SPECIES, 'tubes', 1)).toEqual(TUBE_LATER);
    expect(colourGroupAt(SPECIES, 'tubes', 2)).toBeNull();
    expect(colourGroupAt(null, 'cap', 0)).toBeNull();
  });

  it('ersetzt eine Farbgruppe an ihrer Stelle und hängt eine neue an', () => {
    const next = { ...TUBE_LATER, mode: 'distinct' } as unknown as ColourGroup;

    expect(withColourGroup(SPECIES, 'tubes', 1, next)).toEqual([CAP_COLOUR, TUBE_COLOUR, next]);
    expect(withColourGroup(SPECIES, 'tubes', 2, next)).toEqual([CAP_COLOUR, TUBE_COLOUR, TUBE_LATER, next]);
  });

  it('nimmt eine Farbgruppe heraus und lässt die anderen Teile stehen', () => {
    expect(withoutColourGroup(SPECIES, 'tubes', 0)).toEqual([CAP_COLOUR, TUBE_LATER]);
    expect(withoutColourGroup(SPECIES, 'cap', 0)).toEqual([TUBE_COLOUR, TUBE_LATER]);
  });

  it('nimmt ein Maß heraus und lässt ein Teil ohne Maß weg', () => {
    expect(withoutMeasurement(SPECIES, 'cap', 'height')[0].measurements).toHaveLength(1);
    expect(withoutMeasurement(SPECIES, 'stem', 'width')).toHaveLength(1);
  });

  it('legt eine Verfärbung an ihre Stelle und hängt eine neue an', () => {
    const next = { ...CAP_CHANGE, part: 'stem' } as unknown as ColourChange;

    expect(withChange(SPECIES, 0, next)).toEqual([next, TUBE_CHANGE]);
    expect(withChange(SPECIES, 2, next)).toEqual([CAP_CHANGE, TUBE_CHANGE, next]);
  });

  it('nimmt eine Verfärbung an ihrer Stelle heraus', () => {
    expect(withoutChange(SPECIES, 0)).toEqual([TUBE_CHANGE]);
  });

  it('nimmt ein Teil mit Maßen, Farben und Verfärbungen heraus', () => {
    const rest = withoutPart(SPECIES, 'cap');

    expect(rest.measurements.map((one) => one.part)).toEqual(['stem']);
    expect(rest.colours).toEqual([TUBE_COLOUR, TUBE_LATER]);
    expect(rest.colourChanges).toEqual([TUBE_CHANGE]);
  });

  it('schreibt Verwechslungen ohne Unterscheidung als leeren Text', () => {
    expect(lookalikeWrites(SPECIES)).toEqual([
      { slug: 'tylopilus-felleus', difference: 'bitter' },
      { slug: 'imleria-badia', difference: '' },
    ]);
    expect(lookalikeWrites(null)).toEqual([]);
  });

  it('legt eine Verwechslung an ihre Stelle und hängt eine neue an', () => {
    const one = { slug: 'boletus-radicans', difference: 'bitter' };

    expect(withLookalike(SPECIES, 0, one)[0]).toEqual(one);
    expect(withLookalike(SPECIES, 2, one)).toHaveLength(3);
  });

  it('nimmt eine Verwechslung an ihrer Stelle heraus', () => {
    expect(withoutLookalike(SPECIES, 0).map((one) => one.slug)).toEqual(['imleria-badia']);
  });
});
