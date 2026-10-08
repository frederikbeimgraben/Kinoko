/** The fallback: the backend default texts and the keys of the legacy pages. */
import type { WorkshopKey } from './workshop-texts';
import generatedDe from './texts.de.json';
import legacyDe from './legacy.de.json';

export const SUPPORTED_LOCALES = ['de', 'en'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'de';

type LegacyKey = keyof typeof legacyDe;

export type TranslationKey = LegacyKey | WorkshopKey | keyof typeof generatedDe;

/** German is in the main bundle, because it is the default and the fallback. */
export const CATALOG_DE: Record<string, string> = { ...legacyDe, ...generatedDe };

/** English loads on a language change, in a separate chunk. */
export async function loadCatalog(locale: Locale): Promise<Record<string, string>> {
  if (locale === DEFAULT_LOCALE) return CATALOG_DE;
  const [legacy, generated] = await Promise.all([import('./legacy.en.json'), import('./texts.en.json')]);
  return { ...legacy.default, ...generated.default };
}
