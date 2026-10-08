import type { TranslationKey } from '../../core/i18n/translations';
import type { Licence } from '../../core/api/models';

/** An own photo has a translated label. The catalogue holds the key. */
export const OWN_PHOTO_KEY: TranslationKey = 'image.field.ownPhoto';

/** The licence codes are identifiers, not text to translate. */
export const LICENCE_CODE: Readonly<Record<Exclude<Licence, 'own'>, string>> = {
  cc0: 'CC0',
  cc_by_4: 'CC BY 4.0',
  cc_by_sa_4: 'CC BY-SA 4.0',
  public_domain: 'Public Domain',
};
