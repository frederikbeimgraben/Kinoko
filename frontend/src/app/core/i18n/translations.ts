/** Der Rückfall: die Vorgabe des Backends und die Schlüssel der alten Seiten. */
import type { WorkshopKey } from './workshop-texts';
import generatedDe from './texts.de.json';
import legacyDe from './legacy.de.json';

export const SUPPORTED_LOCALES = ['de', 'en'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'de';

type LegacyKey = keyof typeof legacyDe;

export type TranslationKey = LegacyKey | WorkshopKey | keyof typeof generatedDe;

/** Deutsch liegt im ersten Bündel: es ist Vorgabe und Rückfall zugleich. */
export const CATALOG_DE: Record<string, string> = { ...legacyDe, ...generatedDe };

/** Englisch kommt erst beim Wechsel, in einem eigenen Brocken. */
export async function loadCatalog(locale: Locale): Promise<Record<string, string>> {
  if (locale === DEFAULT_LOCALE) return CATALOG_DE;
  const [legacy, generated] = await Promise.all([import('./legacy.en.json'), import('./texts.en.json')]);
  return { ...legacy.default, ...generated.default };
}
