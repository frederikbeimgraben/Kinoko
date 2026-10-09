import { plurals } from './plural';

const FINDS = '{count, plural, one {# Fund} other {# Funde}}';

describe('plurals', () => {
  it('chooses the form of the language for a count', () => {
    expect(plurals(FINDS, { count: 1 }, 'de')).toBe('1 Fund');
    expect(plurals(FINDS, { count: 0 }, 'de')).toBe('0 Funde');
    expect(plurals(FINDS, { count: 3 }, 'en')).toBe('3 Funde');
  });

  it('groups a large count as the boards do', () => {
    expect(plurals(FINDS, { count: 1284 }, 'de')).toBe('1 284 Funde');
  });

  it('reads a count that is already formatted', () => {
    expect(plurals(FINDS, { count: '1' }, 'de')).toBe('1 Fund');
    expect(plurals(FINDS, { count: '1 284' }, 'de')).toBe('1 284 Funde');
  });

  it('prefers an exact form', () => {
    const text = '{count, plural, =0 {Keine Funde} one {# Fund} other {# Funde}}';

    expect(plurals(text, { count: 0 }, 'de')).toBe('Keine Funde');
  });

  it('resolves each plural of a text and keeps the other text', () => {
    const text =
      '{finds, plural, one {# find} other {# finds}} · {zones, plural, one {# zone} other {# zones}} · {rest}';

    expect(plurals(text, { finds: 1, zones: 2 }, 'en')).toBe('1 find · 2 zones · {rest}');
  });

  it('keeps a form with placeholders and nested braces', () => {
    const text = '{count, plural, one {{name}: # Mitglied} other {{name}: # Mitglieder}}';

    expect(plurals(text, { count: 1, name: 'Wald' }, 'de')).toBe('{name}: 1 Mitglied');
  });

  it('uses the other form without the parameter', () => {
    expect(plurals(FINDS, {}, 'de')).toBe('# Funde');
  });

  it('keeps a text without a plural', () => {
    expect(plurals('{count} Stück', { count: 1 }, 'de')).toBe('{count} Stück');
  });
});
