import { taxonSlug } from './taxonomy';

describe('taxonSlug', () => {
  it('macht aus dem lateinischen Namen einen Slug', () => {
    expect(taxonSlug('Boletus')).toBe('boletus');
    expect(taxonSlug('Boletaceae')).toBe('boletaceae');
  });

  it('schreibt Umlaute um und ersetzt jedes andere Zeichen', () => {
    expect(taxonSlug('Käppchen  Morchel')).toBe('kaeppchen-morchel');
    expect(taxonSlug('  Amanita/Gruppe ')).toBe('amanita-gruppe');
  });
});
