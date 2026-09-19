import type { ColourMode, ColourValue } from '../../core/api/models';
import type { ColourMode as FieldMode } from '../../ui/colour-field/colour-field.component';

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
