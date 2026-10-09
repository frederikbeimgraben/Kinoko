import { inject } from '@angular/core';
import type { StandardColour } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import type { TranslationKey } from '../../core/i18n/translations';
import { catalogueNames, type NamedColour } from '../species/catalogue-text';
import { CatalogueStore } from './catalogue.store';

/** The name of a catalogue colour in the UI language, as the species page shows it.
 * German keeps the free name of the editor. Other languages use its text, else its nearest standard colour. */
export function injectColourLabel(): (value: NamedColour) => string {
  const catalogue = inject(CatalogueStore);
  catalogue.load();
  const names = catalogueNames(inject(I18nService), catalogue.standardColours);
  return (value) => names.colour(value);
}

/** The German name of the standard tone with this hex, for the catalogue, or null for another hex. */
export function toneName(
  hex: string,
  palette: readonly StandardColour[],
  i18n: Pick<I18nService, 'translateDefault'>,
): string | null {
  const tone = palette.find((one) => one.hex === hex);
  return tone === undefined ? null : i18n.translateDefault(`enum.colour.${tone.key}` as TranslationKey);
}
