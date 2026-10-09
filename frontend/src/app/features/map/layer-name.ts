import type { I18nService } from '../../core/i18n/i18n.service';
import { DEFAULT_LOCALE, type TranslationKey } from '../../core/i18n/translations';
import type { Layer } from '../../core/tiles/layers';

/** The full name of a layer: the text key, or else the manifest name. */
export function layerTitle(layer: Layer, i18n: I18nService): string {
  const key = `layer.${layer.id}` as TranslationKey;
  const text = i18n.translate(key);
  return text === key ? layer.title : text;
}

/** The short name of a layer. The manifest gives it in German only, so other languages take the text key. */
export function layerName(layer: Layer, i18n: I18nService): string {
  return i18n.locale() === DEFAULT_LOCALE ? layer.label : layerTitle(layer, i18n);
}

/** The time span of a layer. The manifest note of a fixed layer is the credit of its source, not a span.
 * The note of a weekly layer is German text, so other languages take the general span. */
export function layerPeriod(layer: Layer, i18n: I18nService): string {
  if (layer.fixed) return i18n.translate('map.layer.fixed');
  const german = i18n.locale() === DEFAULT_LOCALE;
  return german && layer.note !== '' ? layer.note : i18n.translate('map.layer.perWeek');
}
