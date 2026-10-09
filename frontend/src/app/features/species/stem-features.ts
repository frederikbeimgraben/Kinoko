import type { SpeciesEntry, StemFeature } from '../../core/api/models';
import type { I18nService } from '../../core/i18n/i18n.service';
import { PHASE_TEXT, STEM_FEATURE_TEXT } from './labels';

const SEPARATOR = ', ';
const ORDER = Object.keys(STEM_FEATURE_TEXT) as StemFeature[];

/** True when the species has one of the features, false when its stem data has none of them.
 * Without stem data the answer is null: the catalogue does not know. */
export function hasStemFeature(entry: SpeciesEntry, features: readonly StemFeature[]): boolean | null {
  const held = entry.stemFeatures;
  if (held.length === 0) return null;
  return held.some((one) => features.includes(one.feature));
}

/** The stem features as one sentence part, each feature once. A feature of one phase only names it. */
export function stemFeatureList(entry: SpeciesEntry, i18n: I18nService): string {
  const held = entry.stemFeatures;
  const words = ORDER.flatMap((feature) => {
    const phases = held.filter((one) => one.feature === feature).map((one) => one.phase);
    if (phases.length === 0) return [];
    const word = i18n.translate(STEM_FEATURE_TEXT[feature]);
    const only = new Set(phases).size === 1 ? phases[0] : undefined;
    return [only === undefined ? word : `${word} (${i18n.translate(PHASE_TEXT[only])})`];
  });
  const text = words.join(SEPARATOR);
  return text.charAt(0).toLocaleUpperCase(i18n.locale()) + text.slice(1);
}
