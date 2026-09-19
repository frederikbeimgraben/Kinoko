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

/** Eine Verwechslung, wie der Vertrag sie schreibt. */
export type LookalikeWrite = NonNullable<SpeciesWrite['lookalikes']>[number];

/** Alles, was ein Teil einer Art trägt. */
export interface PartLists {
  measurements: MeasurementGroup[];
  colours: ColourGroup[];
  colourChanges: ColourChange[];
  partNotes: PartNote[];
}

/** Die Farbgruppen eines Teils. */
export function colourGroups(species: SpeciesEntry | null, part: BodyPart): ColourGroup[] {
  return (species?.colours ?? []).filter((one) => one.part === part);
}

/** Die Farbgruppe eines Teils an ihrer Stelle unter den Gruppen des Teils. */
export function colourGroupAt(species: SpeciesEntry | null, part: BodyPart, at: number): ColourGroup | null {
  return colourGroups(species, part)[at] ?? null;
}

/** Legt eine Farbgruppe an ihre Stelle im Teil. Eine neue Stelle hängt an. */
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

/** Nimmt eine Farbgruppe aus ihrem Teil. */
export function withoutColourGroup(species: SpeciesEntry | null, part: BodyPart, at: number): ColourGroup[] {
  let seen = -1;
  return (species?.colours ?? []).filter((one) => {
    if (one.part !== part) return true;
    seen += 1;
    return seen !== at;
  });
}

/** Nimmt ein Maß aus seinem Teil. Ein Teil ohne Maß fällt weg. */
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

/** Legt eine Verfärbung an ihre Stelle. Eine neue Stelle hängt an. */
export function withChange(species: SpeciesEntry | null, at: number, change: ColourChange): ColourChange[] {
  const held = changes(species);
  if (at >= held.length) return [...held, change];
  return held.map((one, index) => (index === at ? change : one));
}

/** Die Verfärbungen einer Art. */
export function changes(species: SpeciesEntry | null): readonly ColourChange[] {
  return species?.colourChanges ?? [];
}

/** Nimmt eine Verfärbung an ihrer Stelle heraus. */
export function withoutChange(species: SpeciesEntry | null, at: number): ColourChange[] {
  return changes(species).filter((_, index) => index !== at);
}

/** Legt die Notiz eines Teils an ihre Stelle. Eine leere Notiz fällt weg. */
export function withPartNote(species: SpeciesEntry | null, note: PartNote): PartNote[] {
  const held = (species?.partNotes ?? []).filter((one) => one.part !== note.part);
  if (note.description === '' && note.comment === '') return held;
  return [...held, note];
}

/** Nimmt ein Teil mit seinen Maßen, Farben und Verfärbungen heraus. */
export function withoutPart(species: SpeciesEntry | null, part: BodyPart): PartLists {
  return {
    measurements: (species?.measurements ?? []).filter((one) => one.part !== part),
    colours: (species?.colours ?? []).filter((one) => one.part !== part),
    colourChanges: changes(species).filter((one) => one.part !== part),
    partNotes: (species?.partNotes ?? []).filter((one) => one.part !== part),
  };
}

/** Die Teile einer Art, in der Reihenfolge des Körpers. */
export const PART_ORDER: readonly BodyPart[] = [
  'fruitbody',
  'cap',
  'stem',
  'stem_base',
  'gills',
  'tubes',
  'pores',
  'flesh',
  'spore_print',
  'spore',
];

/** Die Teile, die weder die Art noch die offene Wahl schon führt. */
export function freeParts(species: SpeciesEntry | null, extra: readonly BodyPart[]): BodyPart[] {
  const held = new Set<BodyPart>([
    ...(species?.measurements ?? []).map((one) => one.part),
    ...(species?.colours ?? []).map((one) => one.part),
    ...changes(species).map((one) => one.part),
    ...extra,
  ]);
  return PART_ORDER.filter((part) => !held.has(part));
}

/** Legt eine Quelle an ihre Stelle. Eine neue Stelle hängt an. */
export function withSource(species: SpeciesEntry | null, at: number, one: SourceEntry): SourceEntry[] {
  const held = [...(species?.sources ?? [])];
  if (at >= held.length) return [...held, one];
  return held.map((entry, index) => (index === at ? one : entry));
}

/** Nimmt eine Quelle an ihrer Stelle heraus. */
export function withoutSource(species: SpeciesEntry | null, at: number): SourceEntry[] {
  return (species?.sources ?? []).filter((_, index) => index !== at);
}

/** Die Verwechslungen, wie der Vertrag sie schreibt. */
export function lookalikeWrites(species: SpeciesEntry | null): LookalikeWrite[] {
  return (species?.lookalikes ?? []).map((one) => ({
    slug: one.slug,
    difference: one.difference ?? '',
  }));
}

/** Legt eine Verwechslung an ihre Stelle. Eine neue Stelle hängt an. */
export function withLookalike(
  species: SpeciesEntry | null,
  at: number,
  one: LookalikeWrite,
): LookalikeWrite[] {
  const held = lookalikeWrites(species);
  if (at >= held.length) return [...held, one];
  return held.map((entry, index) => (index === at ? one : entry));
}

/** Nimmt eine Verwechslung an ihrer Stelle heraus. */
export function withoutLookalike(species: SpeciesEntry | null, at: number): LookalikeWrite[] {
  return lookalikeWrites(species).filter((_, index) => index !== at);
}
