import type { BodyPart, Dimension, HymeniumType, SpeciesEntry } from '../../../core/api/models';
import type { I18nService } from '../../../core/i18n/i18n.service';
import { shortMonth } from '../../../core/i18n/dates';
import { spanText } from '../../../ui/measurement/measurement.component';
import { CAP_SHAPE_TEXT, HYMENIUM_TEXT } from '../labels';
import {
  buildRow,
  colourSwatch,
  plainCell,
  swatchCell,
  type Measure,
  type Row,
  type Swatch,
} from './comparison.cells';

/** Ein Verlauf des Katalogs heißt `distinct`, wo die Fläche hart trennt. */
const MODE: Record<SpeciesEntry['colours'][number]['mode'], Swatch['mode']> = {
  single: 'single',
  gradient: 'gradient',
  distinct: 'multiple',
};

const SEPARATOR = ', ';
const SEASON_DASH = ' – ';

/** Die Teile mit einer Fruchtschicht, deren Farbe an derselben Stelle steht. */
const HYMENIUM_COLOUR_PARTS: readonly HymeniumType[] = ['gills', 'tubes', 'pores'];

/** Die Farben eines Körperteils, mit ihren Namen als Beschriftung. */
export function swatchOf(entry: SpeciesEntry, part: BodyPart | null): Swatch | null {
  const group = part === null ? undefined : entry.colours.find((one) => one.part === part);
  if (!group || group.colours.length === 0) return null;
  return {
    colours: group.colours,
    mode: MODE[group.mode],
    label: group.colours.map((one) => one.name).join(SEPARATOR),
  };
}

/** Ein Maß eines Körperteils, mit seiner Einheit im Wort der Sprache. */
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

/** Die Hutform: eine Angabe allein, oder Jugendform und Altersform, wo sie sich unterscheiden. */
export function capShapeOf(entry: SpeciesEntry, i18n: I18nService): string | null {
  const young = entry.capShapeYoung ?? null;
  const old = entry.capShapeOld ?? null;
  if (young && old && young !== old) {
    return `${i18n.translate(CAP_SHAPE_TEXT[young])} ${i18n.translate('common.to')} ${i18n.translate(CAP_SHAPE_TEXT[old])}`;
  }
  const shape = young ?? old;
  return shape ? i18n.translate(CAP_SHAPE_TEXT[shape]) : null;
}

/** Die Notiz eines Körperteils, wo eine steht. */
export function partNoteOf(entry: SpeciesEntry, part: BodyPart): string | null {
  const note = (entry.partNotes ?? []).find((one) => one.part === part);
  return note && note.description !== '' ? note.description : null;
}

/** Die Art der Fruchtschicht als Wort. */
export function hymeniumTypeOf(entry: SpeciesEntry, i18n: I18nService): string | null {
  return entry.hymeniumType ? i18n.translate(HYMENIUM_TEXT[entry.hymeniumType]) : null;
}

/** Die Farbe der Fruchtschicht steht an demselben Körperteil. */
export function hymeniumColourOf(entry: SpeciesEntry): Swatch | null {
  const kind = entry.hymeniumType;
  if (!kind || !HYMENIUM_COLOUR_PARTS.includes(kind)) return null;
  return swatchOf(entry, kind as BodyPart);
}

/** Der Geruch: die Marken des Katalogs, sonst der Fließtext. */
export function senseSmellOf(entry: SpeciesEntry): string | null {
  const tags = entry.terms.filter((one) => one.term.kind === 'smell').map((one) => one.term.name);
  if (tags.length > 0) return tags.join(SEPARATOR);
  return entry.smellText && entry.smellText !== '' ? entry.smellText : null;
}

/** Die Saison als Spanne aus kurzen Monatsnamen. */
export function seasonOf(entry: SpeciesEntry, i18n: I18nService): string | null {
  const from = entry.periodStartMonth ?? null;
  const to = entry.periodEndMonth ?? null;
  if (from === null || to === null) return null;
  return `${shortMonth(from, i18n)}${SEASON_DASH}${shortMonth(to, i18n)}`;
}

/** Verfärbungen, eine Zeile je Auslöser, den mindestens eine Art trägt. */
export function changeRows(entries: readonly SpeciesEntry[], i18n: I18nService): Row[] {
  const names: string[] = [];
  for (const entry of entries) {
    for (const change of entry.colourChanges) {
      for (const trigger of change.triggers) {
        if (!names.includes(trigger.name)) names.push(trigger.name);
      }
    }
  }
  return names.map((name) =>
    buildRow(name, entries, (entry) => {
      const change = entry.colourChanges.find((one) => one.triggers.some((trigger) => trigger.name === name));
      return change
        ? swatchCell(colourSwatch(change.to))
        : plainCell(i18n.translate('species.reaction.unknown'));
    }),
  );
}
