import { MARKER_COLOURS, type MarkerColour } from '../../core/api/models';
import type { I18nService } from '../../core/i18n/i18n.service';
import { type ColourSwatch, OBJECT_COLOURS } from '../../ui/colour-swatches/colour-swatches.component';

/** Gives the hex value of a contract colour. The contract colours and the artboard `Zone` values have the same order. */
export function colourHex(colour: MarkerColour): `#${string}` {
  const index = MARKER_COLOURS.indexOf(colour);
  return OBJECT_COLOURS[index === -1 ? 0 : index];
}

/** The colour of an object in a list. It follows the colour scheme. */
export function colourToken(colour: MarkerColour): string {
  return `var(--colour-object-${colour})`;
}

/** The inverse: the contract colour of a hex value. */
export function colourFromHex(hex: string): MarkerColour {
  const index = OBJECT_COLOURS.findIndex((value) => value === hex);
  return index === -1 ? 'green' : MARKER_COLOURS[index];
}

/** The choices for `ColorSwatches`. The value is the colour, because the swatch paints it as background.
 * The label gives the name, so a screen reader does not read a hex code. */
export function colourSwatches(i18n: I18nService): ColourSwatch[] {
  return MARKER_COLOURS.map((colour) => ({
    value: colourHex(colour),
    label: i18n.translate(`farbe.${colour}`),
  }));
}
