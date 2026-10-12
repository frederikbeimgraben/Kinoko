/** The species catalogue types, directly from the contract. */

import type { components } from '../contract';

export type SpeciesBundle = components['schemas']['SpeciesBundle'];
export type StandardColour = components['schemas']['StandardColour'];
export type SpeciesEntry = components['schemas']['Species'];
export type SpeciesSummary = components['schemas']['SpeciesSummary'];
export type SpeciesCounts = components['schemas']['SpeciesCounts'];
export type SpeciesWrite = components['schemas']['SpeciesWrite'];
export type Group = components['schemas']['Group'];
export type Edibility = components['schemas']['Edibility'];
export type Protection = components['schemas']['Protection'];
export type CapShape = components['schemas']['CapShape'];
export type HymeniumType = components['schemas']['HymeniumType'];
export type StemFeature = components['schemas']['StemFeature'];
export type Phase = components['schemas']['Phase'];
export type BodyPart = components['schemas']['BodyPart'];
export type Dimension = components['schemas']['Dimension'];
export type ColourGroup = components['schemas']['ColourGroup'];
export type ColourValue = components['schemas']['ColourValue'];
export type ColourMode = components['schemas']['ColourMode'];
export type ColourChange = components['schemas']['ColourChange'];
export type TriggerGroup = components['schemas']['TriggerGroup'];
export type Lookalike = components['schemas']['Lookalike'];
export type Speed = components['schemas']['Speed'];
export type GillAttachment = components['schemas']['GillAttachment'];
export type GillSpacing = components['schemas']['GillSpacing'];
export type GillEdge = components['schemas']['GillEdge'];
export type RingShape = components['schemas']['RingShape'];
export type TermRef = components['schemas']['TermRef'];
export type Term = components['schemas']['Term'];
export type TermCreate = components['schemas']['TermCreate'];
export type TermUpdate = components['schemas']['TermUpdate'];
export type TermKind = components['schemas']['TermKind'];
export type MeasurementGroup = components['schemas']['MeasurementGroup'];
export type PartNote = components['schemas']['PartNote'];
export type TraitEntry = components['schemas']['Trait'];
export type SourceEntry = components['schemas']['SourceEntry'];
export type SourceScope = components['schemas']['SourceScope'];
export type Measurement = components['schemas']['Measurement'];
export type Unit = components['schemas']['Unit'];
export type TaxonPage = components['schemas']['TaxonPage'];
export type TaxonStep = components['schemas']['TaxonStep'];
export type TaxonChild = components['schemas']['TaxonChild'];
export type TaxonRank = components['schemas']['TaxonRank'];
export type RedListStatus = components['schemas']['RedListStatus'];
export type Frequency = components['schemas']['Frequency'];
export type Season = components['schemas']['Season'];
export type CapFeature = components['schemas']['CapFeature'];
export type CapMargin = components['schemas']['CapMargin'];
export type TraitKey = components['schemas']['TraitKey'];
export type SpeciesReaction = components['schemas']['SpeciesReaction'];
export type ReactionSource = components['schemas']['ReactionSource'];
export type ReactionResult = SpeciesReaction['result'];

export const EDIBILITIES: readonly Edibility[] = [
  'edible',
  'conditionally_edible',
  'inedible',
  'poisonous',
  'deadly',
];

export const PROTECTIONS: readonly Protection[] = ['none', 'personal_use', 'strict'];

export const DIMENSIONS: readonly Dimension[] = ['width', 'height', 'thickness', 'length'];

export const UNITS: readonly Unit[] = ['cm', 'mm', 'um'];

export const HYMENIUM_TYPES: readonly HymeniumType[] = ['gills', 'tubes', 'pores', 'spines', 'folds'];

export const CAP_SHAPES: readonly CapShape[] = [
  'convex',
  'flat',
  'hemispherical',
  'depressed',
  'funnel',
  'conical',
  'bell',
  'egg',
  'spherical',
  'shell',
  'pear',
  'club',
  'cylindrical',
];

/** The ring shapes, from the full ring to its trace on the stem. */
export const RING_SHAPES: readonly RingShape[] = [
  'pendant',
  'flaring',
  'sheathing',
  'double',
  'zone',
  'cortina',
];

export const TAXON_RANKS: readonly TaxonRank[] = ['division', 'class', 'order', 'family', 'genus'];

/** The red list levels, from the highest threat down. */
export const RED_LIST_STATUSES: readonly RedListStatus[] = [
  'critically_endangered',
  'endangered',
  'vulnerable',
  'unknown_extent',
  'extremely_rare',
  'near_threatened',
  'data_deficient',
];

export const FREQUENCIES: readonly Frequency[] = ['very_common', 'common', 'scattered', 'rare', 'very_rare'];

export const SEASONS: readonly Season[] = ['spring', 'summer', 'autumn', 'winter'];

export const CAP_FEATURES: readonly CapFeature[] = [
  'umbonate',
  'hygrophanous',
  'zoned',
  'sunken',
  'irregular',
  'navelled',
];

export const CAP_MARGINS: readonly CapMargin[] = [
  'inrolled',
  'wavy',
  'striate',
  'cracked',
  'fringed',
  'incurved',
  'overhanging',
  'sharp',
  'lobed',
];

export const STEM_FEATURES: readonly StemFeature[] = [
  'ring',
  'volva',
  'bulb',
  'netted',
  'banded',
  'hollow',
  'solid',
  'fibrous',
  'flocked',
  'hairy',
  'striate',
  'rooting',
  'brittle',
];

export const REACTION_RESULTS: readonly ReactionResult[] = ['positive', 'negative', 'variable', 'unknown'];

export const TERM_KINDS: readonly TermKind[] = ['smell', 'taste', 'tree', 'trigger'];
