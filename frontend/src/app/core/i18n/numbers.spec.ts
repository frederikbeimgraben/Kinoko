import { describe, expect, it } from 'vitest';
import { decimal } from './numbers';

describe('decimal', () => {
  it('schreibt eine Zahl in der Sprache der Oberfläche', () => {
    expect(decimal(4.663, 'de')).toBe('4,7');
    expect(decimal(4.663, 'en')).toBe('4.7');
  });

  it('rundet auf die angegebene Stellenzahl', () => {
    expect(decimal(151.9, 'de', { maximumFractionDigits: 0 })).toBe('152');
  });
});
