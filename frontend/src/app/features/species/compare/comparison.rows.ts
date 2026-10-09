import type { BodyPart, Dimension, HymeniumType, SpeciesEntry } from '../../../core/api/models';
import type { I18nService } from '../../../core/i18n/i18n.service';
import type { TranslationKey } from '../../../core/i18n/translations';
import type { CatalogueNames } from '../catalogue-text';
import { distinctChanges } from '../sections/reactions';
import type { SpeciesReaction } from '../species.store';
import { shortMonth } from '../../../core/i18n/dates';
import { spanText } from '../../../ui/measurement/measurement.component';
import { CAP_SHAPE_TEXT, HYMENIUM_TEXT } from '../labels';
import {
  buildRow,
  colourSwatch,
  plainCell,
  swatchCell,
  type Cell,
  type Measure,
  type Row,
  type Swatch,
} from './comparison.cells';

/** The catalogue calls a colour set `distinct` where the areas have hard edges. */
const MODE: Record<SpeciesEntry['colours'][number]['mode'], Swatch['mode']> = {
  single: 'single',
  gradient: 'gradient',
  distinct: 'multiple',
};

const SEPARATOR = ', ';
const SEASON_DASH = ' – ';

/** The hymenium kinds whose colour has the same part name. */
const HYMENIUM_COLOUR_PARTS: readonly HymeniumType[] = ['gills', 'tubes', 'pores'];

/** The colours of a body part, with their names as the label. */
export function swatchOf(entry: SpeciesEntry, part: BodyPart | null, names: CatalogueNames): Swatch | null {
  const group = part === null ? undefined : entry.colours.find((one) => one.part === part);
  if (!group || group.colours.length === 0) return null;
  return {
    colours: group.colours,
    mode: MODE[group.mode],
    label: [...new Set(group.colours.map((one) => names.colour(one)))].join(SEPARATOR),
  };
}

/** A measure of a body part, with its unit in the word of the language. */
export function measurementOf(
  entry: SpeciesEntry,
  part: BodyPart,
  dimension: Dimension,
  i18n: I18nService,
): Measure | null {
  const group = entry.measurements.find((one) => one.part === part);
  const found = group?.measurements.find((one) => one.dimension === dimension);
  if (!found) return null;
  return {
    value: spanText({ from: found.low, to: found.high }, i18n.locale()),
    unit: i18n.translate(`enum.unit.${found.unit}` as 'enum.unit.cm'),
  };
}

/** The cap shape: one value, or the young and the old shape where they are different. */
export function capShapeOf(entry: SpeciesEntry, i18n: I18nService): string | null {
  const young = entry.capShapeYoung ?? null;
  const old = entry.capShapeOld ?? null;
  if (young && old && young !== old) {
    return `${i18n.translate(CAP_SHAPE_TEXT[young])} ${i18n.translate('common.to')} ${i18n.translate(CAP_SHAPE_TEXT[old])}`;
  }
  const shape = young ?? old;
  return shape ? i18n.translate(CAP_SHAPE_TEXT[shape]) : null;
}

/** The note of a body part, where one is present. */
export function partNoteOf(entry: SpeciesEntry, part: BodyPart): string | null {
  const note = (entry.partNotes ?? []).find((one) => one.part === part);
  return note && note.description !== '' ? note.description : null;
}

/** The kind of hymenium as a word. */
export function hymeniumTypeOf(entry: SpeciesEntry, i18n: I18nService): string | null {
  return entry.hymeniumType ? i18n.translate(HYMENIUM_TEXT[entry.hymeniumType]) : null;
}

/** The colour of the hymenium is on the body part with the same name. */
export function hymeniumColourOf(entry: SpeciesEntry, names: CatalogueNames): Swatch | null {
  const kind = entry.hymeniumType;
  if (!kind || !HYMENIUM_COLOUR_PARTS.includes(kind)) return null;
  return swatchOf(entry, kind as BodyPart, names);
}

/** The smell: the terms of the catalogue, or else the free text. */
export function senseSmellOf(entry: SpeciesEntry, names: CatalogueNames): string | null {
  const tags = entry.terms.filter((one) => one.term.kind === 'smell').map((one) => names.term(one.term));
  if (tags.length > 0) return tags.join(SEPARATOR);
  return entry.smellText && entry.smellText !== '' ? entry.smellText : null;
}

/** The season as a span of short month names. */
export function seasonOf(entry: SpeciesEntry, i18n: I18nService): string | null {
  const from = entry.periodStartMonth ?? null;
  const to = entry.periodEndMonth ?? null;
  if (from === null || to === null) return null;
  return `${shortMonth(from, i18n)}${SEASON_DASH}${shortMonth(to, i18n)}`;
}

/** The text of a reaction without a colour swatch. */
const RESULT_TEXT = {
  positive: 'species.reaction.positive',
  negative: 'species.reaction.negative',
  variable: 'species.reaction.variable',
  unknown: 'species.reaction.unknown',
} as const satisfies Record<SpeciesReaction['result'], TranslationKey>;

/** A trigger of a colour change or a reagent of a reaction, by its slug. */
interface Trigger {
  readonly slug: string;
  readonly name: string;
}

/** The reactions of a species by its slug. Only a loaded profile has them. */
export type ReactionsOf = (slug: string) => readonly SpeciesReaction[];

/** The colour changes and the reactions: one row for each trigger or reagent of a species.
 * A reaction tells more than a colour change of the same reagent, so the reaction fills the cell. */
export function reagentRows(
  entries: readonly SpeciesEntry[],
  reactionsOf: ReactionsOf,
  i18n: I18nService,
  names: CatalogueNames,
): Row[] {
  const triggers: Trigger[] = entries.flatMap((entry) => [
    ...distinctChanges(entry.colourChanges, reactionsOf(entry.slug)).flatMap((change) => change.triggers),
    ...reactionsOf(entry.slug).map((reaction) => reaction.reagent),
  ]);
  const unique = [...new Map(triggers.map((one) => [one.slug, one])).values()];
  return unique.map((trigger) =>
    buildRow(names.term({ kind: 'trigger', ...trigger }), entries, (entry) => {
      const reaction = reactionsOf(entry.slug).find((one) => one.reagent.slug === trigger.slug);
      if (reaction !== undefined) return reactionCell(reaction, i18n, names);
      const change = entry.colourChanges.find((one) =>
        one.triggers.some((term) => term.slug === trigger.slug),
      );
      if (change === undefined) return plainCell(i18n.translate('species.reaction.unknown'));
      return swatchCell({ ...colourSwatch(change.to), label: names.colour(change.to) });
    }),
  );
}

function reactionCell(reaction: SpeciesReaction, i18n: I18nService, names: CatalogueNames): Cell {
  const result = i18n.translate(RESULT_TEXT[reaction.result]);
  if (reaction.colour !== null && reaction.result !== 'negative') {
    const colour = names.colour(reaction.colour);
    return swatchCell({
      ...colourSwatch(reaction.colour),
      label: names.free(reaction.reading || colour, colour),
    });
  }
  return plainCell(names.free(reaction.reading || result, result));
}
