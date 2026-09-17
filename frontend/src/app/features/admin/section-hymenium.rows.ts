import type {
  GillAttachment,
  GillEdge,
  GillSpacing,
  HymeniumType,
  SpeciesEntry,
} from '../../core/api/models';
import { ATTACHMENT_TEXT, EDGE_TEXT, HYMENIUM_TEXT, SPACING_TEXT } from '../species/labels';
import type { TranslationKey } from '../../core/i18n/translations';

/** Welches Feld der Fruchtschicht eine Zeile führt. */
export type HymeniumField = 'kind' | 'attachment' | 'spacing' | 'edge';

/** Eine Zeile der Kopfkarte: Beschriftung, Wert und das Feld dahinter. */
export interface HymeniumRow {
  field: HymeniumField;
  title: TranslationKey;
  value: string;
}

/** Nur Lamellen und Leisten tragen Ansatz, Stand und Schneide. */
const GILL_ONLY: readonly HymeniumType[] = ['gills', 'folds'];

export const HYMENIUM_TYPES_ORDER: readonly HymeniumType[] = ['gills', 'tubes', 'pores', 'spines', 'folds'];

export const ATTACHMENTS: readonly GillAttachment[] = ['free', 'adnate', 'emarginate', 'decurrent'];
export const SPACINGS: readonly GillSpacing[] = ['close', 'normal', 'distant'];
export const EDGES: readonly GillEdge[] = ['smooth', 'serrate', 'ciliate'];

export const FIELD_TITLE: Readonly<Record<HymeniumField, TranslationKey>> = {
  kind: 'species.fieldLabel',
  attachment: 'species.field.hymeniumAttachment',
  spacing: 'species.field.hymeniumStand',
  edge: 'species.field.hymeniumEdge',
};

/** Die Werte eines Feldes, in der Reihenfolge des Katalogs. */
export function choicesOf(field: HymeniumField): readonly string[] {
  if (field === 'kind') return HYMENIUM_TYPES_ORDER;
  if (field === 'attachment') return ATTACHMENTS;
  if (field === 'spacing') return SPACINGS;
  return EDGES;
}

/** Der Textschlüssel eines Wertes. */
export function choiceText(field: HymeniumField, value: string): TranslationKey {
  if (field === 'kind') return HYMENIUM_TEXT[value as HymeniumType];
  if (field === 'attachment') return ATTACHMENT_TEXT[value as GillAttachment];
  if (field === 'spacing') return SPACING_TEXT[value as GillSpacing];
  return EDGE_TEXT[value as GillEdge];
}

/** Der Wert eines Feldes an einer Art. */
export function valueOf(species: SpeciesEntry, field: HymeniumField): string | null {
  if (field === 'kind') return species.hymeniumType ?? null;
  if (field === 'attachment') return species.gillAttachment ?? null;
  if (field === 'spacing') return species.gillSpacing ?? null;
  return species.gillEdge ?? null;
}

/** Die Zeilen der Kopfkarte. Ohne Lamellen bleibt nur die Art. */
export function hymeniumRows(species: SpeciesEntry, text: (key: TranslationKey) => string): HymeniumRow[] {
  const kind = species.hymeniumType ?? null;
  const fields: HymeniumField[] =
    kind !== null && GILL_ONLY.includes(kind) ? ['kind', 'attachment', 'spacing', 'edge'] : ['kind'];
  return fields.map((field) => {
    const value = valueOf(species, field);
    return {
      field,
      title: FIELD_TITLE[field],
      value: value === null ? '' : text(choiceText(field, value)),
    };
  });
}
