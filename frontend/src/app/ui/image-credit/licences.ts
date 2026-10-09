import type { TranslationKey } from '../../core/i18n/translations';
import type { Licence } from '../../core/api/models';

/** An own photo has a translated label. The catalogue holds the key. */
export const OWN_PHOTO_KEY: TranslationKey = 'image.field.ownPhoto';

/** The licence codes are identifiers, not text to translate. */
export const LICENCE_CODE: Readonly<Record<Exclude<Licence, 'own'>, string>> = {
  cc0: 'CC0',
  cc_by_4: 'CC BY 4.0',
  cc_by_sa_4: 'CC BY-SA 4.0',
  cc_by_3: 'CC BY 3.0',
  cc_by_sa_3: 'CC BY-SA 3.0',
  cc_by_2_5: 'CC BY 2.5',
  cc_by_sa_2_5: 'CC BY-SA 2.5',
  cc_by_2: 'CC BY 2.0',
  cc_by_sa_2: 'CC BY-SA 2.0',
  public_domain: 'Public Domain',
};

/** The page of each licence text. An own photo and a public domain photo have no licence text. */
export const LICENCE_URL: Readonly<Partial<Record<Licence, string>>> = {
  cc0: 'https://creativecommons.org/publicdomain/zero/1.0/',
  cc_by_4: 'https://creativecommons.org/licenses/by/4.0/',
  cc_by_sa_4: 'https://creativecommons.org/licenses/by-sa/4.0/',
  cc_by_3: 'https://creativecommons.org/licenses/by/3.0/',
  cc_by_sa_3: 'https://creativecommons.org/licenses/by-sa/3.0/',
  cc_by_2_5: 'https://creativecommons.org/licenses/by/2.5/',
  cc_by_sa_2_5: 'https://creativecommons.org/licenses/by-sa/2.5/',
  cc_by_2: 'https://creativecommons.org/licenses/by/2.0/',
  cc_by_sa_2: 'https://creativecommons.org/licenses/by-sa/2.0/',
};

/** The source of a photo as a link target: only a web address with https. */
export function sourceLink(source: string | null | undefined): string | null {
  const value = source?.trim() ?? '';
  return /^https:\/\/\S+$/.test(value) ? value : null;
}
