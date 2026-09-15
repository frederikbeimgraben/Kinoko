import type { SpeciesEntry } from '../../core/api/models';
import type { CatalogueEntry } from './species.state';
import type { I18nService } from '../../core/i18n/i18n.service';
import type { SpeciesRowSpecies } from '../../ui/species-row/species-row.component';
import { EDIBILITY_TEXT, EDIBILITY_TONE } from './labels';

const HEX = /^#[0-9a-fA-F]{6}$/;
const SHADE = 0.78;

/** Ein dunkleres Ende, damit auch eine einzige Hutfarbe einen Verlauf gibt. */
function shade(hex: string): string {
  const parts = [1, 3, 5].map((at) => Math.round(parseInt(hex.slice(at, at + 2), 16) * SHADE));
  return `#${parts.map((one) => one.toString(16).padStart(2, '0')).join('')}`;
}

/** Die Töne des Platzhalters kommen aus den Hutfarben der Art. */
function tint(entry: SpeciesEntry): readonly [string, string] | undefined {
  const cap = entry.colours.find((group) => group.part === 'cap');
  const hexes = (cap?.colours ?? []).map((one) => one.hex).filter((hex) => HEX.test(hex));
  if (hexes.length === 0) return undefined;
  const first = hexes[0];
  const last = hexes[hexes.length - 1];
  return [first, last === first ? shade(first) : last];
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
    tint: tint(entry),
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
