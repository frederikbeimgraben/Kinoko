import type { BodyPart, ColourGroup, ColourMode, ColourValue, SpeciesEntry } from '../../core/api/models';
import type { ColourMode as FieldMode } from '../../ui/colour-field/colour-field.component';

/** Die Farbgruppe eines Teils, sofern die Art eine trägt. */
export function groupOf(species: SpeciesEntry | null, part: BodyPart): ColourGroup | null {
  return species?.colours.find((one) => one.part === part) ?? null;
}

/** Legt die Farbgruppe eines Teils an die Stelle der alten. */
export function withGroup(species: SpeciesEntry, group: ColourGroup): ColourGroup[] {
  const known = species.colours.some((one) => one.part === group.part);
  if (!known) return [...species.colours, group];
  return species.colours.map((one) => (one.part === group.part ? group : one));
}

/** Setzt eine Farbe an ihre Stelle in der Liste. */
export function withColour(colours: readonly ColourValue[], at: number, colour: ColourValue): ColourValue[] {
  return colours.map((one, index) => (index === at ? colour : one));
}

/** Der Verlauf braucht zwei Farben, eine Farbe genau eine. */
export function trimmed(colours: readonly ColourValue[], mode: ColourMode): ColourValue[] {
  return mode === 'single' ? colours.slice(0, 1) : [...colours];
}

/** Der Baustein kennt `multiple`, der Vertrag `distinct`. */
export function fieldMode(mode: ColourMode): FieldMode {
  return mode === 'distinct' ? 'multiple' : mode;
}

/** Der Wert des Segments folgt dem Vertrag. */
export const COLOUR_MODES: readonly ColourMode[] = ['single', 'gradient', 'distinct'];
