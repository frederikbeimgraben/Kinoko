import { COLOUR_MODES, stopText, trimmed, withColour } from './section-colour.rows';

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

  it('führt die Modi des Vertrags', () => {
    expect(COLOUR_MODES).toEqual(['single', 'gradient', 'distinct']);
  });

  it('nennt Anfang und Ende eines Verlaufs, sonst den Farbcode', () => {
    const text = (key: string): string => key;
    expect(stopText('gradient', 0, 3, '#aabbcc', text)).toBe('admin.colour.start');
    expect(stopText('gradient', 1, 3, '#aabbcc', text)).toBe('admin.colour.middle');
    expect(stopText('gradient', 2, 3, '#aabbcc', text)).toBe('admin.colour.end');
    expect(stopText('distinct', 0, 3, '#aabbcc', text)).toBe('#AABBCC');
  });
});
