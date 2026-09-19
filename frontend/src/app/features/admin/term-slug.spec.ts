import { slugOf } from './term-slug';

describe('slugOf', () => {
  it('schreibt klein und verbindet mit Bindestrich', () => {
    expect(slugOf('Frisches Mehl')).toBe('frisches-mehl');
  });

  it('löst Umlaute in zwei Buchstaben auf', () => {
    expect(slugOf('Grüne Eiche')).toBe('gruene-eiche');
    expect(slugOf('Weißtanne')).toBe('weisstanne');
  });

  it('lässt weder Zeichen noch Ränder stehen', () => {
    expect(slugOf('  Anis (süß)!  ')).toBe('anis-suess');
  });
});
