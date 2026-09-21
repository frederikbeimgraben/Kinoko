import { photoPath, type SpeciesEntry } from '../../core/api/models';
import type { CatalogueEntry } from './species.state';
import type { I18nService } from '../../core/i18n/i18n.service';
import type { SpeciesRowSpecies } from '../../ui/species-row/species-row.component';
import { EDIBILITY_KIND, EDIBILITY_TEXT, EDIBILITY_TONE } from './labels';

const FALLBACK_COLOUR = '#7a5230';

/** Die Grundfarbe der Art fuer das Ersatzsymbol im Titelbild. */
function leadColour(entry: SpeciesEntry): string {
  return entry.colours.find((group) => group.part === 'cap')?.colours[0]?.hex ?? FALLBACK_COLOUR;
}

/** Wandelt eine Art in eine Zeile. Sie trägt genau eine Plakette. */
export function speciesRow(entry: SpeciesEntry, i18n: I18nService): SpeciesRowSpecies {
  const tone = EDIBILITY_TONE[entry.edibility];
  return {
    name: entry.name,
    latin: entry.scientificName,
    levelText: i18n.translate(EDIBILITY_TEXT[entry.edibility]),
    levelColour: tone.colour,
    levelBackground: tone.background,
    levelKind: EDIBILITY_KIND[entry.edibility],
    colour: leadColour(entry),
    image: entry.leadPhotoId ? photoPath(entry.leadPhotoId, 'list') : null,
  };
}

/** Sucht lokal nach deutschem und lateinischem Namen. */
export function search(entries: readonly CatalogueEntry[], query: string): readonly CatalogueEntry[] {
  const needle = query.trim().toLocaleLowerCase();
  if (needle === '') return entries;
  return entries.filter(
    (one) =>
      one.species.name.toLocaleLowerCase().includes(needle) ||
      one.species.scientificName.toLocaleLowerCase().includes(needle),
  );
}
