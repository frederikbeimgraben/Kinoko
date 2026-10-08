import type {
  BodyPart,
  ColourChange,
  ColourGroup,
  Dimension,
  MeasurementGroup,
  PartNote,
  SourceEntry,
  SpeciesEntry,
  SpeciesWrite,
} from '../../core/api/models';

/** A lookalike in the contract format. */
export type LookalikeWrite = NonNullable<SpeciesWrite['lookalikes']>[number];

/** All lists that a part of a species has. */
export interface PartLists {
  measurements: MeasurementGroup[];
  colours: ColourGroup[];
  colourChanges: ColourChange[];
  partNotes: PartNote[];
}

export function colourGroups(species: SpeciesEntry | null, part: BodyPart): ColourGroup[] {
  return (species?.colours ?? []).filter((one) => one.part === part);
}

/** The colour group at an index among the groups of a part. */
export function colourGroupAt(species: SpeciesEntry | null, part: BodyPart, at: number): ColourGroup | null {
  return colourGroups(species, part)[at] ?? null;
}

/** Puts a colour group at its index in the part. A new index adds the group at the end. */
export function withColourGroup(
  species: SpeciesEntry | null,
  part: BodyPart,
  at: number,
  group: ColourGroup,
): ColourGroup[] {
  let seen = -1;
  const out = (species?.colours ?? []).map((one) => {
    if (one.part !== part) return one;
    seen += 1;
    return seen === at ? group : one;
  });
  return seen >= at ? out : [...out, group];
}

export function withoutColourGroup(species: SpeciesEntry | null, part: BodyPart, at: number): ColourGroup[] {
  let seen = -1;
  return (species?.colours ?? []).filter((one) => {
    if (one.part !== part) return true;
    seen += 1;
    return seen !== at;
  });
}

/** Removes a measurement from its part. A part with no measurement left is removed. */
export function withoutMeasurement(
  species: SpeciesEntry | null,
  part: BodyPart,
  dimension: Dimension,
): MeasurementGroup[] {
  return (species?.measurements ?? [])
    .map((group) =>
      group.part === part
        ? { ...group, measurements: group.measurements.filter((one) => one.dimension !== dimension) }
        : group,
    )
    .filter((group) => group.measurements.length > 0);
}

/** Puts a colour change at its index. A new index adds the change at the end. */
export function withChange(species: SpeciesEntry | null, at: number, change: ColourChange): ColourChange[] {
  const held = changes(species);
  if (at >= held.length) return [...held, change];
  return held.map((one, index) => (index === at ? change : one));
}

export function changes(species: SpeciesEntry | null): readonly ColourChange[] {
  return species?.colourChanges ?? [];
}

export function withoutChange(species: SpeciesEntry | null, at: number): ColourChange[] {
  return changes(species).filter((_, index) => index !== at);
}

/** Replaces the note of a part. An empty note is removed. */
export function withPartNote(species: SpeciesEntry | null, note: PartNote): PartNote[] {
  const held = (species?.partNotes ?? []).filter((one) => one.part !== note.part);
  if (note.description === '' && note.comment === '') return held;
  return [...held, note];
}

/** Removes a part with its measurements, colours and colour changes. */
export function withoutPart(species: SpeciesEntry | null, part: BodyPart): PartLists {
  return {
    measurements: (species?.measurements ?? []).filter((one) => one.part !== part),
    colours: (species?.colours ?? []).filter((one) => one.part !== part),
    colourChanges: changes(species).filter((one) => one.part !== part),
    partNotes: (species?.partNotes ?? []).filter((one) => one.part !== part),
  };
}

/** The parts of a species, in body order. */
export const PART_ORDER: readonly BodyPart[] = [
  'fruitbody',
  'cap',
  'stem',
  'ring',
  'stem_base',
  'gills',
  'tubes',
  'pores',
  'flesh',
  'spore_print',
  'spore',
];

/** The parts that are not in the species and not in the open choice. */
export function freeParts(species: SpeciesEntry | null, extra: readonly BodyPart[]): BodyPart[] {
  const held = new Set<BodyPart>([
    ...(species?.measurements ?? []).map((one) => one.part),
    ...(species?.colours ?? []).map((one) => one.part),
    ...changes(species).map((one) => one.part),
    ...extra,
  ]);
  return PART_ORDER.filter((part) => !held.has(part));
}

/** Puts a source at its index. A new index adds the source at the end. */
export function withSource(species: SpeciesEntry | null, at: number, one: SourceEntry): SourceEntry[] {
  const held = [...(species?.sources ?? [])];
  if (at >= held.length) return [...held, one];
  return held.map((entry, index) => (index === at ? one : entry));
}

export function withoutSource(species: SpeciesEntry | null, at: number): SourceEntry[] {
  return (species?.sources ?? []).filter((_, index) => index !== at);
}

/** The lookalikes in the contract format. */
export function lookalikeWrites(species: SpeciesEntry | null): LookalikeWrite[] {
  return (species?.lookalikes ?? []).map((one) => ({
    slug: one.slug,
    difference: one.difference ?? '',
  }));
}

/** Puts a lookalike at its index. A new index adds the lookalike at the end. */
export function withLookalike(
  species: SpeciesEntry | null,
  at: number,
  one: LookalikeWrite,
): LookalikeWrite[] {
  const held = lookalikeWrites(species);
  if (at >= held.length) return [...held, one];
  return held.map((entry, index) => (index === at ? one : entry));
}

export function withoutLookalike(species: SpeciesEntry | null, at: number): LookalikeWrite[] {
  return lookalikeWrites(species).filter((_, index) => index !== at);
}
