import { COLOUR_MODES, fieldMode, trimmed, withColour } from './section-colour.rows';

const CAP = {
  part: 'cap' as const,
  mode: 'gradient' as const,
  colours: [
    { name: 'violett', hex: '#7a3b6a' },
    { name: 'grün', hex: '#4f7a3a' },
  ],
};

describe('section-colour.rows', () => {
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
