import type { SpeciesEntry } from '../../core/api/models';
import { isLight } from '../../ui/private-image/private-image.component';

/** The brown of the boards for a thumb without a known species. */
export const FALLBACK_COLOUR = '#7a5230';

/** The cap colour of a species for a thumb without a photo.
 * A white or cream tone disappears on the light and on the dark surface, so the first darker tone wins. */
export function capColour(species: SpeciesEntry | null | undefined): string {
  const colours = species?.colours.find((group) => group.part === 'cap')?.colours ?? [];
  return (colours.find((one) => !isLight(one.hex)) ?? colours.at(0))?.hex ?? FALLBACK_COLOUR;
}
