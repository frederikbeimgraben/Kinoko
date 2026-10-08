import type { ColourMode, ColourValue } from '../../core/api/models';
import type { ColourMode as FieldMode } from '../../ui/colour-field/colour-field.component';

/** Puts a colour at its index in the list. */
export function withColour(colours: readonly ColourValue[], at: number, colour: ColourValue): ColourValue[] {
  return colours.map((one, index) => (index === at ? colour : one));
}

/** Mode `single` keeps exactly one colour. A gradient needs two colours, thus the other modes keep all colours. */
export function trimmed(colours: readonly ColourValue[], mode: ColourMode): ColourValue[] {
  return mode === 'single' ? colours.slice(0, 1) : [...colours];
}

/** The UI component uses `multiple`. The contract uses `distinct`. */
export function fieldMode(mode: ColourMode): FieldMode {
  return mode === 'distinct' ? 'multiple' : mode;
}

/** The segment values are the contract values. */
export const COLOUR_MODES: readonly ColourMode[] = ['single', 'gradient', 'distinct'];
