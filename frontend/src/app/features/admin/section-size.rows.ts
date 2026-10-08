import type { BodyPart, Dimension, Measurement, MeasurementGroup, SpeciesEntry } from '../../core/api/models';
import type { TranslationKey } from '../../core/i18n/translations';

/** The title of a size page: part and dimension make one word. */
export const SIZE_TITLE: Readonly<Record<Dimension, TranslationKey>> = {
  width: 'admin.size.width',
  height: 'admin.size.height',
  thickness: 'admin.size.thickness',
  length: 'admin.size.length',
};

/** The measurement of a part for a dimension, or null if the species has none. */
export function measurementOf(
  species: SpeciesEntry | null,
  part: BodyPart,
  dimension: Dimension,
): Measurement | null {
  const group = species?.measurements.find((one) => one.part === part);
  return group?.measurements.find((one) => one.dimension === dimension) ?? null;
}

/** Puts a measurement in the group of its part. It replaces the old measurement of that dimension. */
export function withMeasurement(
  species: SpeciesEntry,
  part: BodyPart,
  measurement: Measurement,
): MeasurementGroup[] {
  const groups = species.measurements.map((group) =>
    group.part === part
      ? {
          ...group,
          measurements: replace(group.measurements, measurement),
        }
      : group,
  );
  if (groups.some((group) => group.part === part)) return groups;
  return [...groups, { part, measurements: [measurement] }];
}

function replace(measurements: readonly Measurement[], one: Measurement): Measurement[] {
  const known = measurements.some((entry) => entry.dimension === one.dimension);
  if (!known) return [...measurements, one];
  return measurements.map((entry) => (entry.dimension === one.dimension ? one : entry));
}
