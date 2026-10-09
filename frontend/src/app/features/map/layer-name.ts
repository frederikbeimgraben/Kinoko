import type { I18nService } from '../../core/i18n/i18n.service';
import { DEFAULT_LOCALE, type TranslationKey } from '../../core/i18n/translations';
import { layerGroup } from '../../core/tiles/layer-groups';
import type { Layer } from '../../core/tiles/layers';
import { isoWeek } from '../../core/tiles/manifest';

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

/** The key of a layer that sums or averages weeks ends with the number of weeks, for example `regen_4w`. */
const WINDOW = /_(\d+)w$/;

/** The legend caption of a layer, per `MapLayer.dc.html`: "Niederschlag, Summe KW 35 bis 38".
 * `week` is the layer week that the map shows, in the form `YYYYWww`. */
export function layerCaption(layer: Layer, week: string | null, i18n: I18nService): string {
  const shown = week === null || layer.fixed ? null : /^(\d{4})W(\d{2})$/.exec(week);
  if (shown === null) return `${layerName(layer, i18n)}, ${layerPeriod(layer, i18n)}`;
  const to = Number(shown[2]);
  const weeks = Number(WINDOW.exec(layer.id)?.[1] ?? 1);
  if (weeks <= 1) return `${layerName(layer, i18n)}, ${i18n.translate('map.layer.week', { week: to })}`;
  const group = layerGroup(layer.id);
  const name = group === null ? layerName(layer, i18n) : i18n.translate(`layer.group.${group}`);
  const from = weekBefore(Number(shown[1]), to, weeks - 1);
  const span = layer.unit === 'mm' ? 'map.layer.spanSum' : 'map.layer.spanMean';
  return `${name}, ${i18n.translate(span, { from, to })}`;
}

/** The ISO week number `back` weeks before the week `week` of `year`. */
function weekBefore(year: number, week: number, back: number): number {
  const fourth = new Date(year, 0, 4);
  const monday = new Date(year, 0, 4 - ((fourth.getDay() + 6) % 7) + (week - 1 - back) * 7);
  return isoWeek(monday).week;
}
