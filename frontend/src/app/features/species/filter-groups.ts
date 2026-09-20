import type { I18nService } from '../../core/i18n/i18n.service';
import type { TranslationKey } from '../../core/i18n/translations';
import {
  CAP_SHAPES,
  EDIBILITIES,
  HYMENIUM_TYPES,
  PROTECTIONS,
  type BodyPart,
  type SpeciesEntry,
} from '../../core/api/models';
import {
  FORECAST_VALUE,
  colourParts,
  countValues,
  type Counts,
  type GroupKey,
  type Selection,
} from './facets';
import {
  CAP_SHAPE_TEXT,
  EDIBILITY_TEXT,
  GROUP_TEXT,
  HYMENIUM_TEXT,
  MONTH_TEXT,
  PROTECTION_TEXT,
} from './labels';

/** Ein wählbarer Wert einer Gruppe. */
export interface Choice {
  readonly value: string;
  readonly label: string;
  readonly count: number;
}

/** Die Gruppen, deren Werte fest im Vertrag stehen. */
const FIXED: Partial<Record<GroupKey, readonly { value: string; text: TranslationKey }[]>> = {
  edibility: EDIBILITIES.map((value) => ({ value, text: EDIBILITY_TEXT[value] })),
  hymenium: HYMENIUM_TYPES.map((value) => ({ value, text: HYMENIUM_TEXT[value] })),
  capShape: CAP_SHAPES.map((value) => ({ value, text: CAP_SHAPE_TEXT[value] })),
  protection: PROTECTIONS.map((value) => ({ value, text: PROTECTION_TEXT[value] })),
  forecast: [{ value: FORECAST_VALUE, text: GROUP_TEXT.forecast }],
  period: MONTH_TEXT.map((text, at) => ({ value: String(at + 1), text })),
};

/** Der Name eines Wertes, auch wenn keine Art ihn trägt. */
export function valueLabel(
  key: GroupKey,
  value: string,
  i18n: I18nService,
  names: ReadonlyMap<string, string>,
): string {
  const fixed = FIXED[key]?.find((one) => one.value === value);
  if (fixed !== undefined) return i18n.translate(fixed.text);
  return names.get(value) ?? value;
}

/** Die Werte einer Gruppe mit ihrer Zahl, ohne die unbelegten. */
export function choicesOf(
  counts: Counts,
  key: GroupKey,
  i18n: I18nService,
  names: ReadonlyMap<string, string>,
): Choice[] {
  const held = countValues(counts, key);
  const fixed = FIXED[key];
  if (fixed !== undefined) {
    return fixed
      .filter((one) => one.value in held)
      .map((one) => ({
        value: one.value,
        label: i18n.translate(one.text),
        count: held[one.value],
      }));
  }
  return Object.entries(held)
    .map(([value, count]) => ({ value, label: names.get(value) ?? value, count }))
    .sort((one, other) => one.label.localeCompare(other.label, 'de'));
}

/** Der Name jedes Begriffs im Katalog, über seinen Slug. */
export function termNamesOf(entries: readonly { species: SpeciesEntry }[]): ReadonlyMap<string, string> {
  const names = new Map<string, string>();
  for (const one of entries) {
    for (const held of one.species.terms) names.set(held.term.slug, held.term.name);
  }
  return names;
}

/** Die Körperteile, für die der Katalog Farben führt. */
export function partsWithColour(counts: Counts, wanted: readonly BodyPart[]): BodyPart[] {
  const held = new Set(colourParts(counts));
  return wanted.filter((part) => held.has(part));
}

/** Alle Katalogtöne eines Körperteils. */
export function tonesOf(entries: readonly { species: SpeciesEntry }[], part: BodyPart): string[] {
  const tones: string[] = [];
  for (const one of entries) {
    for (const group of one.species.colours) {
      if (group.part === part) tones.push(...group.colours.map((colour) => colour.hex));
    }
  }
  return tones;
}

/** Der Monatsbereich der gewählten Zeit, ein einzelner Monat oder leer. */
function periodSummary(selection: Selection, i18n: I18nService): string {
  const months = [...(selection.values.get('period') ?? [])].map(Number).sort((one, other) => one - other);
  if (months.length === 0) return '';
  if (months.length === 1) return i18n.translate(MONTH_TEXT[months[0] - 1]);
  return i18n.translate('species.period.range', {
    von: i18n.translate(MONTH_TEXT[months[0] - 1]),
    bis: i18n.translate(MONTH_TEXT[months[months.length - 1] - 1]),
  });
}

/** Der Wert, den eine Gruppe in ihrer Zeile oder ihrem Chip zeigt. */
export function groupSummary(
  key: GroupKey,
  selection: Selection,
  i18n: I18nService,
  names: ReadonlyMap<string, string>,
): string {
  if (key === 'colour') {
    const count = selection.colours.size;
    if (count === 0) return '';
    const textKey = count === 1 ? 'filter.colour.onePart' : 'filter.colour.parts';
    return i18n.translate(textKey, { anzahl: String(count) });
  }
  if (key === 'period') return periodSummary(selection, i18n);
  const chosen = selection.values.get(key) ?? new Set<string>();
  if (chosen.size === 0) return '';
  if (chosen.size > 1) return i18n.translate('filter.valueCount', { anzahl: String(chosen.size) });
  return valueLabel(key, [...chosen][0], i18n, names);
}
