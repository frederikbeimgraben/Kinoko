import type { ColourMode, ColourValue } from '../../../ui/colour-field/colour-field.component';
import type { SpeciesEntry } from '../../../core/api/models';

/** The colour area of a cell. */
export interface Swatch {
  readonly colours: readonly ColourValue[];
  readonly mode: ColourMode;
  readonly label: string;
}

/** The span of a cell: the number and the unit are separate. */
export interface Measure {
  readonly value: string;
  readonly unit: string;
}

/** A cell of the table: exactly one of the five kinds. */
export type Cell =
  | { readonly kind: 'badge'; readonly text: string; readonly colour: string; readonly background: string }
  | { readonly kind: 'value'; readonly text: string; readonly unit: string }
  | {
      readonly kind: 'swatch';
      readonly colours: readonly ColourValue[];
      readonly mode: ColourMode;
      readonly text: string;
    }
  | { readonly kind: 'plain'; readonly text: string }
  | { readonly kind: 'none' };

/** A row: its key, one cell for each species, and if the cells are different. */
export interface Row {
  readonly key: string;
  readonly cells: readonly Cell[];
  readonly diff: boolean;
}

/** A group of rows below a heading. */
export interface Group {
  readonly label: string;
  readonly rows: readonly Row[];
}

const NONE_CELL: Cell = { kind: 'none' };

export function badgeCell(text: string, colour: string, background: string): Cell {
  return { kind: 'badge', text, colour, background };
}

export function valueCell(measure: Measure | null): Cell {
  return measure ? { kind: 'value', text: measure.value, unit: measure.unit } : NONE_CELL;
}

export function swatchCell(swatch: Swatch | null): Cell {
  return swatch
    ? { kind: 'swatch', colours: swatch.colours, mode: swatch.mode, text: swatch.label }
    : NONE_CELL;
}

export function plainCell(text: string | null): Cell {
  return text && text !== '' ? { kind: 'plain', text } : NONE_CELL;
}

export function colourSwatch(colour: ColourValue): Swatch {
  return { colours: [colour], mode: 'single', label: colour.name };
}

function cellText(cell: Cell): string {
  return cell.kind === 'none' ? '' : cell.text;
}

function cellColourKey(cell: Cell): string {
  return cell.kind === 'swatch' ? cell.colours.map((one) => one.hex).join('|') : '';
}

/** Two cells are equal when their text and their colours are equal. */
function rowDiffers(cells: readonly Cell[]): boolean {
  if (cells.length === 0) return false;
  const first = cells[0];
  return cells
    .slice(1)
    .some((cell) => cellText(cell) !== cellText(first) || cellColourKey(cell) !== cellColourKey(first));
}

/** A row with one cell for each species and its difference calculated. */
export function buildRow(
  key: string,
  entries: readonly SpeciesEntry[],
  cellOf: (entry: SpeciesEntry) => Cell,
): Row {
  const cells = entries.map(cellOf);
  return { key, cells, diff: rowDiffers(cells) };
}
