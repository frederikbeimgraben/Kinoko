import type { I18nService } from '../../core/i18n/i18n.service';
import type { TranslationKey } from '../../core/i18n/translations';
import type { Layer } from '../../core/tiles/layers';

/** The full name of a layer: the text key, or else the manifest name. */
export function layerTitle(layer: Layer, i18n: I18nService): string {
  const key = `layer.${layer.id}` as TranslationKey;
  const text = i18n.translate(key);
  return text === key ? layer.title : text;
}
