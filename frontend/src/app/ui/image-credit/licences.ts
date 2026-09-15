import type { TranslationKey } from '../../core/i18n/translations';
import type { Licence } from '../../core/api/models';

/** Eigenes Foto trägt eine Übersetzung, der Katalog kennt den Schlüssel. */
export const OWN_PHOTO_KEY: TranslationKey = 'image.field.ownPhoto';

/** CC0, CC BY 4.0, CC BY-SA 4.0 und Public Domain sind Kennungen, keine Prosa. */
export const LICENCE_CODE: Readonly<Record<Exclude<Licence, 'own'>, string>> = {
  cc0: 'CC0',
  cc_by_4: 'CC BY 4.0',
  cc_by_sa_4: 'CC BY-SA 4.0',
  public_domain: 'Public Domain',
};
