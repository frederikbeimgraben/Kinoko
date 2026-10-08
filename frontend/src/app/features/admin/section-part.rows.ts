import type { BodyPart, ColourChange, ColourGroup, Measurement, SpeciesEntry } from '../../core/api/models';
import type { TranslationKey } from '../../core/i18n/translations';

/** A size row: dimension and range. Its route opens the measurement. */
export interface SizeRow {
  dimension: Measurement['dimension'];
  title: TranslationKey;
  value: string;
}

/** A colour row: name and the swatch that the value paints. */
export interface ColourRow {
  key: string;
  title: string;
  colours: readonly { name: string; hex: string }[];
  gradient: boolean;
  /** The index of the colour change in the species. A colour group has no such index. */
  at: number;
}

export function sizeRows(
  species: SpeciesEntry | null,
  part: BodyPart,
  titles: Readonly<Record<Measurement['dimension'], TranslationKey>>,
  span: (one: Measurement) => string,
): SizeRow[] {
  const group = species?.measurements.find((one) => one.part === part);
  return (group?.measurements ?? []).map((one) => ({
    dimension: one.dimension,
    title: titles[one.dimension],
    value: span(one),
  }));
}

export function colourRows(species: SpeciesEntry | null, part: BodyPart, title: string): ColourRow[] {
  const groups: readonly ColourGroup[] = (species?.colours ?? []).filter((one) => one.part === part);
  return groups.map((group, at) => ({
    key: `farbe-${String(at)}`,
    title,
    colours: group.colours,
    gradient: group.mode === 'gradient',
    at,
  }));
}

/** The colour changes of a part, with their index in the full species. */
export function changeRows(species: SpeciesEntry | null, part: BodyPart): ColourRow[] {
  const changes: readonly ColourChange[] = species?.colourChanges ?? [];
  return changes
    .map((change, at) => ({ change, at }))
    .filter((one) => one.change.part === part)
    .map((one) => ({
      key: `verfaerbung-${String(one.at)}`,
      title: one.change.triggers[0]?.name ?? '',
      colours: [one.change.from, one.change.to].filter((value) => value !== null && value !== undefined),
      gradient: false,
      at: one.at,
    }));
}
