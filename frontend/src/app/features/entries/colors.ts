import { MARKER_COLOURS, type MarkerColour } from '../../core/api/models';
import type { I18nService } from '../../core/i18n/i18n.service';
import { type ColourSwatch, OBJECT_COLOURS } from '../../ui/colour-swatches/colour-swatches.component';

/** Die Farben des Vertrags und die Werte des Artboards `Zone`, gleiche Reihenfolge. */
export function colourHex(colour: MarkerColour): `#${string}` {
  const index = MARKER_COLOURS.indexOf(colour);
  return OBJECT_COLOURS[index === -1 ? 0 : index];
}

/** Die Farbe eines Objekts in einer Liste. Sie folgt der Darstellung. */
export function colourToken(colour: MarkerColour): string {
  return `var(--colour-object-${colour})`;
}

/** Die Umkehrung: welche Farbe des Vertrags zu diesem Wert gehört. */
export function colourFromHex(hex: string): MarkerColour {
  const index = OBJECT_COLOURS.findIndex((value) => value === hex);
  return index === -1 ? 'green' : MARKER_COLOURS[index];
}

/**
 * Die Farbwahl für `ColorSwatches`. Der Wert ist die Farbe selbst, weil der
 * Baustein daraus den Hintergrund des Feldes macht; der Name steht daneben,
 * damit ein Bildschirmleser nicht „#004225“ vorliest.
 */
export function colourSwatches(i18n: I18nService): ColourSwatch[] {
  return MARKER_COLOURS.map((colour) => ({
    value: colourHex(colour),
    label: i18n.translate(`farbe.${colour}`),
  }));
}
