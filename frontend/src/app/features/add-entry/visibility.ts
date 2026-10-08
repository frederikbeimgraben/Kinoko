import { VISIBILITIES, type Visibility } from '../../core/api/models';
import type { I18nService } from '../../core/i18n/i18n.service';
import { type SegmentOption } from '../../ui/segmented/segmented.component';

/** Gives „Privat“ and „Geteilt“ as segment options, as in the mockups. */
export function visibilitySegments(i18n: I18nService): SegmentOption[] {
  return VISIBILITIES.map((value) => ({ value, label: i18n.translate(`sichtbarkeit.${value}`) }));
}

/** The visibility name in lowercase, for the subline of an object. */
export function visibilityText(i18n: I18nService, visibility: Visibility): string {
  return i18n.translate(`sichtbarkeit.${visibility}`).toLocaleLowerCase(i18n.locale());
}
