import type { I18nService } from '../../core/i18n/i18n.service';
import type { StandardColour } from '../../core/api/models';
import type { CatalogueEntry } from './species.state';
import type { GroupKey, Selection } from './facets';
import { valueLabel } from './filter-groups';
import { COLOUR_TEXT } from './labels';

/** Eine abnehmbare Marke über der Liste. */
export interface FilterChip {
  readonly group: GroupKey;
  readonly value: string;
  readonly part: string | null;
  readonly label: string;
}

/** Je gewähltem Wert eine Marke, auch für eine Spanne. */
export function chipsOf(
  selection: Selection,
  entries: readonly CatalogueEntry[],
  palette: readonly StandardColour[],
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
    const colour = palette.find((one) => one.hex === hex);
    found.push({
      group: 'colour',
      value: hex,
      part,
      label: colour === undefined ? hex : i18n.translate(COLOUR_TEXT[colour.key]),
    });
  }
  for (const [key, span] of selection.sizes) {
    const label = i18n.translate('filter.size.range', { von: String(span[0]), bis: String(span[1]) });
    found.push({ group: 'size', value: key, part: null, label });
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
