import type { BodyPart, Dimension, Measurement, MeasurementGroup, SpeciesEntry } from '../../core/api/models';
import type { TranslationKey } from '../../core/i18n/translations';

/** Der Kopf einer Maßseite: Teil und Strecke bilden ein Wort. */
export const SIZE_TITLE: Readonly<Record<Dimension, TranslationKey>> = {
  width: 'admin.size.width',
  height: 'admin.size.height',
  thickness: 'admin.size.thickness',
  length: 'admin.size.length',
};

/** Das Maß eines Teils für eine Strecke, sofern die Art es trägt. */
export function measurementOf(
  species: SpeciesEntry | null,
  part: BodyPart,
  dimension: Dimension,
): Measurement | null {
  const group = species?.measurements.find((one) => one.part === part);
  return group?.measurements.find((one) => one.dimension === dimension) ?? null;
}

/** Legt ein Maß in die Gruppe seines Teils, an die Stelle der alten Strecke. */
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
