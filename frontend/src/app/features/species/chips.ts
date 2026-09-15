import type { I18nService } from '../../core/i18n/i18n.service';
import type { CatalogueEntry } from './species.state';
import type { GroupKey, Selection } from './facets';
import { valueLabel } from './filter-groups';
import { COLOUR_TEXT } from './labels';
import { STANDARD_COLOURS } from './standard-colours';

/** Eine abnehmbare Marke über der Liste. */
export interface FilterChip {
  readonly group: GroupKey;
  readonly value: string;
  readonly part: string | null;
  readonly label: string;
}

/** Je gewähltem Wert eine Marke. Eine Spanne trägt keine und zählt daneben. */
export function chipsOf(
  selection: Selection,
  entries: readonly CatalogueEntry[],
  i18n: I18nService,
): FilterChip[] {
  const found: FilterChip[] = [];
  const names = termNames(entries);
  for (const [group, values] of selection.values) {
    for (const value of values) {
      found.push({ group, value, part: null, label: valueLabel(group, value, i18n, names) });
    }
  }
  for (const [part, hex] of selection.colours) {
    const colour = STANDARD_COLOURS.find((one) => one.hex === hex);
    found.push({
      group: 'colour',
      value: hex,
      part,
      label: colour === undefined ? hex : i18n.translate(COLOUR_TEXT[colour.key]),
    });
  }
  return found;
}

function termNames(entries: readonly CatalogueEntry[]): ReadonlyMap<string, string> {
  const names = new Map<string, string>();
  for (const one of entries) {
    for (const held of one.species.terms) names.set(held.term.slug, held.term.name);
  }
  return names;
}
