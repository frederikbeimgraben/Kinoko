import { photoCaption, photoPath, type Photo, type SpeciesEntry } from '../../core/api/models';
import type { I18nService } from '../../core/i18n/i18n.service';
import type { TranslationKey } from '../../core/i18n/translations';
import { LICENCE_CODE, OWN_PHOTO_KEY } from '../../ui/image-credit/licences';
import { dayAndMonth } from '../admin/find-card';
import { capColour } from '../entries/cap-colour';
import { isoDatum } from '../entries/formats';

/** One label and value row of a card, per the board `ImageQueue`. */
export interface ReviewCardRow {
  readonly label: string;
  readonly value: string;
}

/** A card in the review stack: the photo, the species with the caption, and the facts of the submission. */
export interface ReviewCard {
  readonly id: string;
  readonly path: string;
  readonly species: string;
  /** The cap colour of the species, for the tile next to the name. */
  readonly colour: string;
  readonly caption: string;
  readonly rows: readonly ReviewCardRow[];
  readonly alt: string;
}

/** The licence as a code. Own photos show a word, not a licence code. */
export function licenceText(photo: Photo, i18n: I18nService): string {
  return photo.licence === 'own' ? i18n.translate(OWN_PHOTO_KEY) : LICENCE_CODE[photo.licence];
}

/** The rows Urheber, Lizenz and Eingereicht. */
function rowsOf(photo: Photo, i18n: I18nService): readonly ReviewCardRow[] {
  const row = (label: TranslationKey, value: string): ReviewCardRow => ({
    label: i18n.translate(label),
    value,
  });
  return [
    row('image.field.author', photo.photographer || photo.ownerName),
    row('image.field.licence', licenceText(photo, i18n)),
    row('image.field.submitted', dayAndMonth(isoDatum(new Date(photo.createdAt)), i18n.locale())),
  ];
}

export function reviewCard(photo: Photo, species: SpeciesEntry | null, i18n: I18nService): ReviewCard {
  const name = species?.name ?? i18n.translate('find.unknownSpecies');
  const caption = photoCaption(photo, i18n.locale());
  return {
    id: photo.id,
    path: photoPath(photo.id, 'full'),
    species: name,
    colour: capColour(species),
    caption: caption ?? '',
    rows: rowsOf(photo, i18n),
    alt: caption ?? name,
  };
}
