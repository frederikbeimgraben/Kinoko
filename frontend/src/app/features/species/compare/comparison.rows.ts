import type { BodyPart, Dimension, HymeniumType, SpeciesEntry } from '../../../core/api/models';
import type { I18nService } from '../../../core/i18n/i18n.service';
import { shortMonth } from '../../../core/i18n/dates';
import type { ColourMode, ColourValue } from '../../../ui/colour-field/colour-field.component';
import { spanText } from '../../../ui/measurement/measurement.component';
import { CAP_SHAPE_TEXT, EDIBILITY_TEXT, EDIBILITY_TONE, HYMENIUM_TEXT, MUTED_TONE, PROTECTION_TEXT } from '../labels';

/** Ein Verlauf des Katalogs heißt `distinct`, wo die Fläche hart trennt. */
const MODE: Record<SpeciesEntry['colours'][number]['mode'], ColourMode> = {
  single: 'single',
  gradient: 'gradient',
  distinct: 'multiple',
};

const SEPARATOR = ', ';
const SEASON_DASH = ' – ';

/** Die Teile mit einer Fruchtschicht, deren Farbe an derselben Stelle steht. */
const HYMENIUM_COLOUR_PARTS: readonly HymeniumType[] = ['gills', 'tubes', 'pores'];

/** Eine Farbfläche einer Zelle. */
export interface Swatch {
  readonly colours: readonly ColourValue[];
  readonly mode: ColourMode;
  readonly label: string;
}

/** Eine Strecke einer Zelle: Zahl und Einheit stehen getrennt. */
export interface Measure {
  readonly value: string;
  readonly unit: string;
}

/** Eine Zelle des Bretts: genau eine der fünf Arten. */
export type Cell =
  | { readonly kind: 'badge'; readonly text: string; readonly colour: string; readonly background: string }
  | { readonly kind: 'value'; readonly text: string; readonly unit: string }
  | { readonly kind: 'swatch'; readonly colours: readonly ColourValue[]; readonly mode: ColourMode; readonly text: string }
  | { readonly kind: 'plain'; readonly text: string }
  | { readonly kind: 'none' };

/** Eine Zeile: ihr Schlüssel, eine Zelle je Art, ob die Zellen sich unterscheiden. */
export interface Row {
  readonly key: string;
  readonly cells: readonly Cell[];
  readonly diff: boolean;
}

/** Eine Gruppe von Zeilen unter einer Überschrift. */
export interface Group {
  readonly label: string;
  readonly rows: readonly Row[];
}

const NONE_CELL: Cell = { kind: 'none' };

function badgeCell(text: string, colour: string, background: string): Cell {
  return { kind: 'badge', text, colour, background };
}

function valueCell(measure: Measure | null): Cell {
  return measure ? { kind: 'value', text: measure.value, unit: measure.unit } : NONE_CELL;
}

function swatchCell(swatch: Swatch | null): Cell {
  return swatch ? { kind: 'swatch', colours: swatch.colours, mode: swatch.mode, text: swatch.label } : NONE_CELL;
}

function plainCell(text: string | null): Cell {
  return text && text !== '' ? { kind: 'plain', text } : NONE_CELL;
}

function cellText(cell: Cell): string {
  return cell.kind === 'none' ? '' : cell.text;
}

function cellColourKey(cell: Cell): string {
  return cell.kind === 'swatch' ? cell.colours.map((one) => one.hex).join('|') : '';
}

/** Zwei Zellen sind gleich, wo Text und Farben übereinstimmen. */
function rowDiffers(cells: readonly Cell[]): boolean {
  const [first, ...rest] = cells;
  if (!first) return false;
  return rest.some((cell) => cellText(cell) !== cellText(first) || cellColourKey(cell) !== cellColourKey(first));
}

function buildRow(key: string, entries: readonly SpeciesEntry[], cellOf: (entry: SpeciesEntry) => Cell): Row {
  const cells = entries.map(cellOf);
  return { key, cells, diff: rowDiffers(cells) };
}

function colourSwatch(colour: ColourValue): Swatch {
  return { colours: [colour], mode: 'single', label: colour.name };
}

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

/** Die Hutform: eine Angabe allein, oder Jugend bis Alter, wo sie sich unterscheiden. */
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

/** Die Saison als kurzer Monat bis kurzer Monat. */
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
      return change ? swatchCell(colourSwatch(change.to)) : plainCell(i18n.translate('species.reaction.unknown'));
    }),
  );
}

/** Die Gruppen des Bretts: leere Zeilen und leere Gruppen fallen weg. */
export function compareGroups(
  entries: readonly SpeciesEntry[],
  i18n: I18nService,
  diffOnly: boolean,
): readonly Group[] {
  const groups: Group[] = [
    {
      label: i18n.translate('species.section.classification'),
      rows: [
        buildRow(i18n.translate('species.field.edibility'), entries, (entry) =>
          badgeCell(
            i18n.translate(EDIBILITY_TEXT[entry.edibility]),
            EDIBILITY_TONE[entry.edibility].colour,
            EDIBILITY_TONE[entry.edibility].background,
          ),
        ),
        buildRow(i18n.translate('species.field.protection'), entries, (entry) =>
          badgeCell(i18n.translate(PROTECTION_TEXT[entry.protection]), MUTED_TONE.colour, MUTED_TONE.background),
        ),
      ],
    },
    {
      label: i18n.translate('species.field.cap'),
      rows: [
        buildRow(i18n.translate('enum.dimension.width'), entries, (entry) =>
          valueCell(measurementOf(entry, 'cap', 'width', i18n)),
        ),
        buildRow(i18n.translate('species.section.colour'), entries, (entry) => swatchCell(swatchOf(entry, 'cap'))),
        buildRow(i18n.translate('species.field.shape'), entries, (entry) => plainCell(capShapeOf(entry, i18n))),
      ],
    },
    {
      label: i18n.translate('species.field.stem'),
      rows: [
        buildRow(i18n.translate('enum.dimension.height'), entries, (entry) =>
          valueCell(measurementOf(entry, 'stem', 'length', i18n)),
        ),
        buildRow(i18n.translate('enum.dimension.thickness'), entries, (entry) =>
          valueCell(measurementOf(entry, 'stem', 'thickness', i18n)),
        ),
        buildRow(i18n.translate('species.section.colour'), entries, (entry) => swatchCell(swatchOf(entry, 'stem'))),
        buildRow(i18n.translate('species.field.net'), entries, (entry) => plainCell(partNoteOf(entry, 'stem'))),
      ],
    },
    {
      label: i18n.translate('species.field.ring'),
      rows: [
        buildRow(i18n.translate('species.field.shape'), entries, (entry) => plainCell(partNoteOf(entry, 'ring'))),
        buildRow(i18n.translate('species.section.colour'), entries, (entry) => swatchCell(swatchOf(entry, 'ring'))),
      ],
    },
    {
      label: i18n.translate('species.field.bulb'),
      rows: [
        buildRow(i18n.translate('species.field.shape'), entries, (entry) =>
          plainCell(partNoteOf(entry, 'stem_base')),
        ),
        buildRow(i18n.translate('species.section.colour'), entries, (entry) =>
          swatchCell(swatchOf(entry, 'stem_base')),
        ),
      ],
    },
    {
      label: i18n.translate('species.section.hymenium'),
      rows: [
        buildRow(i18n.translate('species.fieldLabel'), entries, (entry) => plainCell(hymeniumTypeOf(entry, i18n))),
        buildRow(i18n.translate('species.section.colour'), entries, (entry) => swatchCell(hymeniumColourOf(entry))),
      ],
    },
    {
      label: i18n.translate('species.field.flesh'),
      rows: [
        buildRow(i18n.translate('species.section.colour'), entries, (entry) => swatchCell(swatchOf(entry, 'flesh'))),
        buildRow(i18n.translate('species.field.smell'), entries, (entry) => plainCell(senseSmellOf(entry))),
      ],
    },
    { label: i18n.translate('species.section.colourChange'), rows: changeRows(entries, i18n) },
    {
      label: i18n.translate('species.field.spore'),
      rows: [
        buildRow(i18n.translate('enum.dimension.length'), entries, (entry) =>
          valueCell(measurementOf(entry, 'spore', 'length', i18n)),
        ),
        buildRow(i18n.translate('species.field.powder'), entries, (entry) =>
          swatchCell(swatchOf(entry, 'spore_print')),
        ),
      ],
    },
    {
      label: i18n.translate('species.field.time'),
      rows: [buildRow(i18n.translate('species.section.season'), entries, (entry) => plainCell(seasonOf(entry, i18n)))],
    },
  ];
  return groups
    .map((group) => ({
      label: group.label,
      rows: group.rows.filter(
        (row) => row.cells.some((cell) => cell.kind !== 'none') && (!diffOnly || row.diff),
      ),
    }))
    .filter((group) => group.rows.length > 0);
}
