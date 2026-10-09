import type {
  BodyPart,
  ColourChange,
  ColourGroup,
  Measurement,
  SpeciesEntry,
  TermRef,
} from '../../core/api/models';
import type { TranslationKey } from '../../core/i18n/translations';
import type { NamedColour } from '../species/catalogue-text';

/** A size row: dimension, range and unit. Its route opens the measurement. */
export interface SizeRow {
  dimension: Measurement['dimension'];
  title: TranslationKey;
  value: string;
  unit: string;
}

/** A colour row: title, the colour names and the swatch that the values paint. */
export interface ColourRow {
  key: string;
  title: string;
  subline: string;
  /** A CSS background for the swatch. A colour change has none. */
  swatch: string;
  /** The index of the colour group in the part, or of the colour change in the species. */
  at: number;
}

export function sizeRows(
  species: SpeciesEntry | null,
  part: BodyPart,
  titles: Readonly<Record<Measurement['dimension'], TranslationKey>>,
  span: (one: Measurement) => { value: string; unit: string },
): SizeRow[] {
  const group = species?.measurements.find((one) => one.part === part);
  return (group?.measurements ?? []).map((one) => ({
    dimension: one.dimension,
    title: titles[one.dimension],
    ...span(one),
  }));
}

/** The swatch of a group: a gradient blends the colours, the other modes show hard stripes. */
export function swatchOf(group: ColourGroup): string {
  const hexes = group.colours.map((one) => one.hex);
  if (hexes.length <= 1) return hexes[0] ?? 'transparent';
  if (group.mode === 'gradient') return `linear-gradient(90deg, ${hexes.join(', ')})`;
  const step = 100 / hexes.length;
  const stops = hexes.map((hex, at) => `${hex} ${String(at * step)}% ${String((at + 1) * step)}%`);
  return `linear-gradient(90deg, ${stops.join(', ')})`;
}

export function colourRows(
  species: SpeciesEntry | null,
  part: BodyPart,
  title: string,
  to: string,
  name: (colour: NamedColour) => string,
): ColourRow[] {
  const groups: readonly ColourGroup[] = (species?.colours ?? []).filter((one) => one.part === part);
  return groups.map((group, at) => {
    const names = group.colours.map((one) => name(one)).filter(Boolean);
    return {
      key: `farbe-${String(at)}`,
      title,
      subline: group.mode === 'gradient' ? names.join(` ${to} `) : names.join(', '),
      swatch: swatchOf(group),
      at,
    };
  });
}

/** The colour changes of a part, with their index in the full species. */
export function changeRows(
  species: SpeciesEntry | null,
  part: BodyPart,
  term: (one: TermRef) => string,
  name: (colour: NamedColour) => string,
): ColourRow[] {
  const changes: readonly ColourChange[] = species?.colourChanges ?? [];
  return changes
    .map((change, at) => ({ change, at }))
    .filter((one) => one.change.part === part)
    .map((one) => ({
      key: `verfaerbung-${String(one.at)}`,
      title: one.change.triggers.map((trigger) => term(trigger)).join(', '),
      subline: name(one.change.to),
      swatch: '',
      at: one.at,
    }));
}
