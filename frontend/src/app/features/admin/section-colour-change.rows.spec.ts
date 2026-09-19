import type { ColourChange, SpeciesEntry } from '../../core/api/models';
import { SPEEDS, TRIGGER_GROUPS, changeAt } from './section-colour-change.rows';

const CHANGE = {
  part: 'cap',
  kind: 'mechanical',
  from: { name: 'weiß', hex: '#f4efe2' },
  to: { name: 'blau', hex: '#5b7fb0' },
  speed: '1min',
  triggers: [],
} as unknown as ColourChange;

const SPECIES = { colourChanges: [CHANGE] } as unknown as SpeciesEntry;

describe('section-colour-change.rows', () => {
  it('findet die Verfärbung an ihrer Stelle', () => {
    expect(changeAt(SPECIES, 0)).toEqual(CHANGE);
    expect(changeAt(SPECIES, 4)).toBeNull();
    expect(changeAt(null, 0)).toBeNull();
  });

  it('nennt die Gruppen und die Dauern in der Reihenfolge der Bretter', () => {
    expect(TRIGGER_GROUPS).toEqual(['mechanical', 'reagent', 'environment']);
    expect(SPEEDS).toEqual(['permanent', 'immediate', '30s', '1min', '3min', 'longer']);
  });
});
