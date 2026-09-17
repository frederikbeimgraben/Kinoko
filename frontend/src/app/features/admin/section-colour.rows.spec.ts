import type { SpeciesEntry } from '../../core/api/models';
import { COLOUR_MODES, fieldMode, groupOf, trimmed, withColour, withGroup } from './section-colour.rows';

const CAP = {
  part: 'cap' as const,
  mode: 'gradient' as const,
  colours: [
    { name: 'violett', hex: '#7a3b6a' },
    { name: 'grün', hex: '#4f7a3a' },
  ],
};

const SPECIES = { colours: [CAP] } as unknown as SpeciesEntry;

describe('section-colour.rows', () => {
  it('findet die Gruppe eines Teils, sonst nichts', () => {
    expect(groupOf(SPECIES, 'cap')).toEqual(CAP);
    expect(groupOf(SPECIES, 'stem')).toBeNull();
    expect(groupOf(null, 'cap')).toBeNull();
  });

  it('ersetzt eine bekannte Gruppe und hängt eine neue an', () => {
    const changed = { ...CAP, mode: 'single' as const };
    expect(withGroup(SPECIES, changed)).toEqual([changed]);
    const stem = { ...CAP, part: 'stem' as const };
    expect(withGroup(SPECIES, stem)).toEqual([CAP, stem]);
  });

  it('setzt eine Farbe an ihre Stelle', () => {
    const next = { name: 'oliv', hex: '#7f8a3a' };
    expect(withColour(CAP.colours, 1, next)).toEqual([CAP.colours[0], next]);
    expect(withColour(CAP.colours, 5, next)).toEqual(CAP.colours);
  });

  it('kürzt auf eine Farbe, sobald der Wert nur eine trägt', () => {
    expect(trimmed(CAP.colours, 'single')).toEqual([CAP.colours[0]]);
    expect(trimmed(CAP.colours, 'gradient')).toEqual(CAP.colours);
  });

  it('bildet den Modus des Vertrags auf den des Bausteins ab', () => {
    expect(COLOUR_MODES).toEqual(['single', 'gradient', 'distinct']);
    expect(fieldMode('distinct')).toBe('multiple');
    expect(fieldMode('gradient')).toBe('gradient');
    expect(fieldMode('single')).toBe('single');
  });
});
