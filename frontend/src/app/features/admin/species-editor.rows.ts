import type { BodyPart, ColourGroup, SpeciesEntry } from '../../core/api/models';
import { PART_TEXT } from '../species/labels';
import type { TranslationKey } from '../../core/i18n/translations';

/** Eine Zeile eines Abschnitts im Bearbeiten-Modus. */
export interface EditorRow {
  key: string;
  title: string;
  value: string;
}

/** Ein Maß als Spanne mit seiner Einheit. */
function span(low: number, high: number, unit: string, to: string): string {
  return `${low} ${to} ${high} ${unit}`;
}

/** Ein Verlauf liest sich als Spanne, alles andere als Aufzählung. */
function groupText(group: ColourGroup, to: string): string {
  const names = group.colours.map((colour) => colour.name);
  return group.mode === 'gradient' ? names.join(` ${to} `) : names.join(', ');
}

/** Die Farben eines Teils, Gruppe für Gruppe. */
function colourText(species: SpeciesEntry, to: string): Map<BodyPart, string> {
  const out = new Map<BodyPart, string>();
  for (const group of species.colours) {
    const known = out.get(group.part);
    const text = groupText(group, to);
    out.set(group.part, known === undefined ? text : `${known}, ${text}`);
  }
  return out;
}

/** Die Merkmalszeilen: je Teil das Maß und die Farben, wie das Brett sie zeigt. */
export function featureRows(
  species: SpeciesEntry,
  extra: readonly BodyPart[],
  text: (key: TranslationKey) => string,
  to: string,
): EditorRow[] {
  const colours = colourText(species, to);
  const held = [
    ...species.measurements.map((group) => group.part),
    ...[...colours.keys()].filter((part) => !species.measurements.some((one) => one.part === part)),
  ];
  const parts = [...held, ...extra.filter((part) => !held.includes(part))];
  return parts.map((part) => {
    const group = species.measurements.find((one) => one.part === part);
    const sizes = (group?.measurements ?? []).map((one) => span(one.low, one.high, one.unit, to));
    const trait = species.traits.find((one) => one.key === part);
    return {
      key: part,
      title: text(PART_TEXT[part]),
      value: [...sizes, colours.get(part), trait?.text].filter(Boolean).join(', '),
    };
  });
}

/** Die Quellen: Titel und die Adresse ohne Schema. */
export function sourceRows(species: SpeciesEntry): EditorRow[] {
  return species.sources.map((one, at) => ({
    key: `quelle-${String(at)}`,
    title: one.title,
    value: one.url,
  }));
}

/** Die Verwechslungen: Name und der Unterschied in einem Satz. */
export function lookalikeRows(species: SpeciesEntry): EditorRow[] {
  return species.lookalikes.map((one) => ({
    key: one.slug,
    title: one.name,
    value: one.difference ?? '',
  }));
}
