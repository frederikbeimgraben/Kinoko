import type {
  BodyPart,
  Dimension,
  Measurement,
  MeasurementGroup,
  SpeciesEntry,
  Unit,
} from '../../core/api/models';

/** Per the board `EditSize`: a part has mm and cm. A spore has µm only. */
const PART_UNITS: readonly Unit[] = ['mm', 'cm'];
const SPORE_UNITS: readonly Unit[] = ['um'];

/** The units for a part, in the order of the board. The unit of a stored value stays available. */
export function unitsOf(part: BodyPart, stored: Unit | undefined): readonly Unit[] {
  const units = part === 'spore' ? SPORE_UNITS : PART_UNITS;
  return stored === undefined || units.includes(stored) ? units : [...units, stored];
}

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

/** Reads `0,7` and `0.7` alike. An empty or wrong field gives null. */
export function numberOf(text: string): number | null {
  const value = Number(text.trim().replace(',', '.'));
  return text.trim() === '' || !Number.isFinite(value) ? null : value;
}
