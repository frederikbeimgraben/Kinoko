import type { I18nService } from '../../core/i18n/i18n.service';
import { catalogueOf } from '../../testing/i18n';
import { PALETTE } from '../../testing/species-fixture';
import { catalogueNames, type NamedTerm } from './catalogue-text';

const ENGLISH_TEXTS: Record<string, string> = {
  'term.smell.pilzig': 'Mushroomy',
  'term.smell.angenehm': 'Pleasant',
  'term.smell.maggiartig': 'Lovage (Maggi)',
};
const ENGLISH = catalogueOf(ENGLISH_TEXTS);
const EN = {
  locale: () => 'en',
  translate: ENGLISH.translate.bind(ENGLISH),
  translateOptional: (key: string) => ENGLISH_TEXTS[key] ?? key,
} as unknown as I18nService;
const DE = catalogueOf({});

const TERMS: readonly NamedTerm[] = [
  { kind: 'smell', slug: 'pilzig', name: 'Pilzig' },
  { kind: 'smell', slug: 'angenehm', name: 'Angenehm' },
  { kind: 'smell', slug: 'maggiartig', name: 'Maggiartig' },
];

describe('catalogueNames', () => {
  it('writes a list of terms as a sentence', () => {
    expect(catalogueNames(EN, () => PALETTE).termList(TERMS)).toBe('Mushroomy, pleasant, lovage (Maggi)');
  });

  it('writes a German list of terms as a sentence too', () => {
    expect(catalogueNames(DE, () => PALETTE).termList(TERMS)).toBe('Pilzig, angenehm, maggiartig');
  });

  it('shows a free German text in German only', () => {
    expect(catalogueNames(DE, () => PALETTE).free('Mild, pilzig.', '')).toBe('Mild, pilzig.');
    expect(catalogueNames(EN, () => PALETTE).free('Mild, pilzig.', 'mild')).toBe('mild');
    expect(catalogueNames(EN, () => PALETTE).free('Mild, pilzig.', '')).toBe('');
  });
});
