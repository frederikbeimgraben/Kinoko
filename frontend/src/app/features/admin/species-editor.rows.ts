import type { BodyPart, ColourGroup, Measurement, SpeciesEntry, TermRef, Unit } from '../../core/api/models';
import { decimal } from '../../core/i18n/numbers';
import { DEFAULT_LOCALE, type TranslationKey } from '../../core/i18n/translations';
import type { NamedColour } from '../species/catalogue-text';
import { HYMENIUM_TEXT, PART_TEXT, RING_SHAPE_TEXT } from '../species/labels';
import { nameLines } from '../species/species-names';
import { heldParts, partDescription } from './species-lists';

/** A row of a section in edit mode. */
export interface EditorRow {
  key: string;
  title: string;
  value: string;
}

/** The texts and the number format of the UI language. */
export interface RowText {
  readonly text: (key: TranslationKey, values?: Record<string, string | number>) => string;
  readonly locale: string;
  /** The name of a term in the UI language. */
  readonly term: (term: TermRef) => string;
  /** The name of a catalogue colour in the UI language. */
  readonly colour: (colour: NamedColour) => string;
}

export const UNIT_TEXT: Readonly<Record<Unit, TranslationKey>> = {
  cm: 'enum.unit.cm',
  mm: 'enum.unit.mm',
  um: 'enum.unit.um',
};

/** A measurement as the editor shows it: `0,7 bis 1,5 cm` in German. */
export function spanText(one: Measurement, t: RowText): string {
  return `${decimal(one.low, t.locale)} ${t.text('common.to')} ${decimal(one.high, t.locale)} ${t.text(UNIT_TEXT[one.unit])}`;
}

/** A gradient shows as a range. All other modes show as a list. */
function groupText(group: ColourGroup, t: RowText): string {
  const names = group.colours.map((colour) => t.colour(colour));
  return group.mode === 'gradient' ? names.join(` ${t.text('common.to')} `) : names.join(', ');
}

/** The colour text of each part, group by group. */
function colourText(species: SpeciesEntry, t: RowText): Map<BodyPart, string> {
  const out = new Map<BodyPart, string>();
  for (const group of species.colours) {
    const known = out.get(group.part);
    const text = groupText(group, t);
    out.set(group.part, known === undefined ? text : `${known}, ${text}`);
  }
  return out;
}

/** The feature rows: for each part, the size and the colours, as the design board shows. The ring also names its shape.
 * A part with only a text shows the text. */
export function featureRows(species: SpeciesEntry, extra: readonly BodyPart[], t: RowText): EditorRow[] {
  const colours = colourText(species, t);
  const held = heldParts(species);
  const parts = [...held, ...extra.filter((part) => !held.includes(part))];
  return parts.map((part) => {
    const group = species.measurements.find((one) => one.part === part);
    const sizes = (group?.measurements ?? []).map((one) => spanText(one, t));
    const shape = part === 'ring' && species.ringShape ? t.text(RING_SHAPE_TEXT[species.ringShape]) : '';
    const value = [shape, ...sizes, colours.get(part)].filter(Boolean).join(', ');
    return {
      key: part,
      title: t.text(PART_TEXT[part]),
      value: value === '' ? partDescription(species, part) : value,
    };
  });
}

/** The colour change rows: the triggers and the colour at the end. */
export function changeRows(species: SpeciesEntry, t: RowText): EditorRow[] {
  return species.colourChanges.map((one, at) => ({
    key: `verfaerbung-${String(at)}`,
    title: one.triggers.map((trigger) => t.term(trigger)).join(', ') || t.text(PART_TEXT[one.part]),
    value: t.colour(one.to),
  }));
}

/** The month name in the UI language. `month` is 1 to 12. */
function monthText(month: number | null | undefined, t: RowText): string {
  return month === null || month === undefined ? '' : t.text(`enum.month.${String(month)}` as TranslationKey);
}

/** The rows of the other features: season, hymenium, smell and taste. Each row opens its own page. */
export function moreRows(species: SpeciesEntry, t: RowText): EditorRow[] {
  const from = monthText(species.periodStartMonth, t);
  const to = monthText(species.periodEndMonth, t);
  const hymenium = species.hymeniumType;
  return [
    {
      key: 'zeitraum',
      title: t.text('species.section.period'),
      value: from === '' || to === '' ? from || to : `${from} ${t.text('common.to')} ${to}`,
    },
    {
      key: 'fruchtschicht',
      title: t.text('species.section.hymenium'),
      value: hymenium === null || hymenium === undefined ? '' : t.text(HYMENIUM_TEXT[hymenium]),
    },
    {
      key: 'sinne',
      title: t.text('species.section.senses'),
      value: [species.smellText, species.tasteText].filter(Boolean).join(' · '),
    },
  ];
}

/** The source rows: title and the address without the scheme. */
export function sourceRows(species: SpeciesEntry): EditorRow[] {
  return species.sources.map((one, at) => ({
    key: `quelle-${String(at)}`,
    title: one.title,
    value: one.url,
  }));
}

/** The lookalike rows: name per the name rule and the difference in one sentence. */
export function lookalikeRows(species: SpeciesEntry, locale: string = DEFAULT_LOCALE): EditorRow[] {
  return species.lookalikes.map((one) => ({
    key: one.slug,
    title: nameLines(one.name, one.scientificName, locale).title,
    value: one.difference ?? '',
  }));
}
