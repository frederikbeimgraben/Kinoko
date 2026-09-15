import type {
  BodyPart,
  CapShape,
  Dimension,
  Edibility,
  GillAttachment,
  GillEdge,
  GillSpacing,
  HymeniumType,
  Protection,
  Speed,
} from '../../core/api/models';
import type { I18nService } from '../../core/i18n/i18n.service';
import type { TranslationKey } from '../../core/i18n/translations';
import type { GroupKey } from './facets';

/** Plakettenfarbe und Fläche je Speisewert. */
export const EDIBILITY_TONE: Record<Edibility, { colour: string; background: string }> = {
  edible: { colour: '#4f9d6f', background: '#16291f' },
  conditionally_edible: { colour: '#9db44f', background: '#20291a' },
  inedible: { colour: '#95a09a', background: '#1d2420' },
  poisonous: { colour: '#d2915f', background: '#2a2119' },
  deadly: { colour: '#d2685f', background: '#2a1a19' },
};

export const EDIBILITY_TEXT: Record<Edibility, TranslationKey> = {
  edible: 'enum.edibility.edible',
  conditionally_edible: 'enum.edibility.conditionally_edible',
  inedible: 'enum.edibility.inedible',
  poisonous: 'enum.edibility.poisonous',
  deadly: 'enum.edibility.deadly',
};

export const PROTECTION_TEXT: Record<Protection, TranslationKey> = {
  none: 'enum.protection.none',
  personal_use: 'enum.protection.personal_use',
  strict: 'enum.protection.strict',
};

export const HYMENIUM_TEXT: Record<HymeniumType, TranslationKey> = {
  gills: 'enum.hymenium.gills',
  tubes: 'enum.hymenium.tubes',
  pores: 'enum.hymenium.pores',
  spines: 'enum.hymenium.spines',
  folds: 'enum.hymenium.folds',
};

export const CAP_SHAPE_TEXT: Record<CapShape, TranslationKey> = {
  convex: 'enum.cap_shape.convex',
  flat: 'enum.cap_shape.flat',
  hemispherical: 'enum.cap_shape.hemispherical',
  depressed: 'enum.cap_shape.depressed',
  funnel: 'enum.cap_shape.funnel',
  conical: 'enum.cap_shape.conical',
  bell: 'enum.cap_shape.bell',
  egg: 'enum.cap_shape.egg',
  spherical: 'enum.cap_shape.spherical',
  shell: 'enum.cap_shape.shell',
  pear: 'enum.cap_shape.pear',
  club: 'enum.cap_shape.club',
  cylindrical: 'enum.cap_shape.cylindrical',
};

export const PART_TEXT: Record<BodyPart, TranslationKey> = {
  fruitbody: 'species.field.fruitbody',
  cap: 'species.field.cap',
  stem: 'species.field.stem',
  stem_base: 'species.field.stemBase',
  gills: 'species.field.gills',
  flesh: 'species.field.flesh',
  spore_print: 'species.field.sporePrint',
  spore: 'species.field.spore',
  tubes: 'species.field.tubes',
  pores: 'species.field.pores',
};

export const SPEED_TEXT: Record<Speed, TranslationKey> = {
  immediate: 'enum.speed.instant',
  '30s': 'enum.speed.s30',
  '1min': 'enum.speed.min1',
  '3min': 'enum.speed.min3',
  longer: 'enum.speed.longer',
  permanent: 'enum.speed.stays',
};

export const ATTACHMENT_TEXT: Record<GillAttachment, TranslationKey> = {
  free: 'species.attachment.free',
  adnate: 'species.attachment.adnate',
  emarginate: 'species.attachment.notched',
  decurrent: 'species.attachment.decurrent',
};

export const SPACING_TEXT: Record<GillSpacing, TranslationKey> = {
  close: 'enum.gill_spacing.close',
  normal: 'enum.gill_spacing.normal',
  distant: 'enum.gill_spacing.distant',
};

export const EDGE_TEXT: Record<GillEdge, TranslationKey> = {
  smooth: 'enum.gill_edge.smooth',
  serrate: 'enum.gill_edge.serrate',
  ciliate: 'enum.gill_edge.ciliate',
};

export const DIMENSION_TEXT: Record<Dimension, TranslationKey> = {
  width: 'enum.dimension.width',
  height: 'enum.dimension.height',
  thickness: 'enum.dimension.thickness',
  length: 'enum.dimension.length',
};

export const GROUP_TEXT: Record<GroupKey, TranslationKey> = {
  edibility: 'species.field.edibility',
  hymenium: 'species.section.hymenium',
  capShape: 'filter.group.hutform',
  colour: 'filter.colour.title',
  size: 'filter.group.sizeTime',
  period: 'filter.group.period',
  senses: 'filter.group.senses',
  treePartner: 'filter.group.treePartner',
  genusFamily: 'filter.group.genusFamily',
  protection: 'species.field.protection',
  forecast: 'filter.group.forecast',
};

/** Der Titel einer Filtergruppe, im Blattkopf am Telefon und in der Spalte am Rechner. */
export function groupTitle(group: GroupKey, i18n: I18nService): string {
  return i18n.translate(GROUP_TEXT[group]);
}

/** Die Körperteile mit eigener Farbwahl, in der Reihenfolge des Bretts. */
export const COLOUR_PARTS: readonly BodyPart[] = ['cap', 'stem', 'gills', 'flesh', 'spore_print'];

export const MONTH_TEXT: readonly TranslationKey[] = [
  'enum.month.1',
  'enum.month.2',
  'enum.month.3',
  'enum.month.4',
  'enum.month.5',
  'enum.month.6',
  'enum.month.7',
  'enum.month.8',
  'enum.month.9',
  'enum.month.10',
  'enum.month.11',
  'enum.month.12',
];

/** Der Schlüssel einer Standardfarbe im Katalog. */
export const COLOUR_TEXT: Record<string, TranslationKey> = {
  white: 'enum.colour.white',
  cream: 'enum.colour.cream',
  yellow: 'enum.colour.yellow',
  orange: 'enum.colour.orange',
  redBrown: 'enum.colour.redBrown',
  brown: 'enum.colour.brown',
  darkBrown: 'enum.colour.darkBrown',
  olive: 'enum.colour.olive',
  green: 'enum.colour.green',
  red: 'enum.colour.red',
  violet: 'enum.colour.violet',
  grey: 'enum.colour.grey',
};

/** Der Name der Gruppe, die eine Art einordnet. */
export const GROUP_NAME_TEXT: Record<string, TranslationKey> = {
  bolete: 'enum.group.bolete',
  rough_stemmed_bolete: 'enum.group.rough_stemmed_bolete',
  slippery_jack: 'enum.group.slippery_jack',
  chanterelle: 'enum.group.chanterelle',
  hedgehog: 'enum.group.hedgehog',
  milkcap: 'enum.group.milkcap',
  brittlegill: 'enum.group.brittlegill',
  parasol: 'enum.group.parasol',
  agaricus: 'enum.group.agaricus',
  inkcap: 'enum.group.inkcap',
  puffball: 'enum.group.puffball',
  funnel: 'enum.group.funnel',
  blewit: 'enum.group.blewit',
  honey_fungus: 'enum.group.honey_fungus',
  scalycap: 'enum.group.scalycap',
  toughshank: 'enum.group.toughshank',
  porcelain: 'enum.group.porcelain',
  oyster: 'enum.group.oyster',
  lions_mane: 'enum.group.lions_mane',
  polypore: 'enum.group.polypore',
  cauliflower: 'enum.group.cauliflower',
  knight: 'enum.group.knight',
  parachute: 'enum.group.parachute',
  woodwax: 'enum.group.woodwax',
  amanita: 'enum.group.amanita',
  morel: 'enum.group.morel',
  jelly_ear: 'enum.group.jelly_ear',
  spike: 'enum.group.spike',
  webcap: 'enum.group.webcap',
  domecap: 'enum.group.domecap',
  pinkgill: 'enum.group.pinkgill',
  spine_fungus: 'enum.group.spine_fungus',
  cup_fungus: 'enum.group.cup_fungus',
};
