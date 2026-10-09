import type { GillAttachment, GillEdge, GillSpacing, HymeniumType } from '../../core/api/models';
import { ATTACHMENT_TEXT, EDGE_TEXT, HYMENIUM_TEXT, SPACING_TEXT } from '../species/labels';
import type { TranslationKey } from '../../core/i18n/translations';

/** The hymenium field that a row shows. */
export type HymeniumField = 'kind' | 'attachment' | 'spacing' | 'edge';

/** Only gills and folds have an attachment, a spacing and an edge. */
export const GILL_ONLY: readonly HymeniumType[] = ['gills', 'folds'];

/** The order of the design board: tubes first, pores last. */
export const HYMENIUM_TYPES_ORDER: readonly HymeniumType[] = ['tubes', 'gills', 'folds', 'spines', 'pores'];

export const ATTACHMENTS: readonly GillAttachment[] = ['free', 'adnate', 'emarginate', 'decurrent'];
export const SPACINGS: readonly GillSpacing[] = ['close', 'normal', 'distant'];
export const EDGES: readonly GillEdge[] = ['smooth', 'serrate', 'ciliate'];

export const FIELD_TITLE: Readonly<Record<HymeniumField, TranslationKey>> = {
  kind: 'admin.hymenium.type',
  attachment: 'species.field.hymeniumAttachment',
  spacing: 'species.field.hymeniumStand',
  edge: 'species.field.hymeniumEdge',
};

/** The values of a field, in catalogue order. */
export function choicesOf(field: HymeniumField): readonly string[] {
  if (field === 'kind') return HYMENIUM_TYPES_ORDER;
  if (field === 'attachment') return ATTACHMENTS;
  if (field === 'spacing') return SPACINGS;
  return EDGES;
}

export function choiceText(field: HymeniumField, value: string): TranslationKey {
  if (field === 'kind') return HYMENIUM_TEXT[value as HymeniumType];
  if (field === 'attachment') return ATTACHMENT_TEXT[value as GillAttachment];
  if (field === 'spacing') return SPACING_TEXT[value as GillSpacing];
  return EDGE_TEXT[value as GillEdge];
}
