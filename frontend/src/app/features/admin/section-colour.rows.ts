import type { ColourMode, ColourValue } from '../../core/api/models';
import type { TranslationKey } from '../../core/i18n/translations';

/** Puts a colour at its index in the list. */
export function withColour(colours: readonly ColourValue[], at: number, colour: ColourValue): ColourValue[] {
  return colours.map((one, index) => (index === at ? colour : one));
}

/** Mode `single` keeps exactly one colour. A gradient needs two colours, thus the other modes keep all colours. */
export function trimmed(colours: readonly ColourValue[], mode: ColourMode): ColourValue[] {
  return mode === 'single' ? colours.slice(0, 1) : [...colours];
}

/** The text below a colour: start and end of a gradient, else the colour code. */
export function stopText(
  mode: ColourMode,
  at: number,
  count: number,
  hex: string,
  text: (key: TranslationKey) => string,
): string {
  if (mode !== 'gradient') return hex.toUpperCase();
  if (at === 0) return text('admin.colour.start');
  return at === count - 1 ? text('admin.colour.end') : text('admin.colour.middle');
}

/** The segment values are the contract values. */
export const COLOUR_MODES: readonly ColourMode[] = ['single', 'gradient', 'distinct'];
