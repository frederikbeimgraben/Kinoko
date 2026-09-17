/** Die Typen des Artenkatalogs, direkt aus dem Vertrag. */

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
export type BodyPart = components['schemas']['BodyPart'];
export type Dimension = components['schemas']['Dimension'];
export type ColourGroup = components['schemas']['ColourGroup'];
export type ColourChange = components['schemas']['ColourChange'];
export type Lookalike = components['schemas']['Lookalike'];
export type Speed = components['schemas']['Speed'];
export type GillAttachment = components['schemas']['GillAttachment'];
export type GillSpacing = components['schemas']['GillSpacing'];
export type GillEdge = components['schemas']['GillEdge'];
export type TermRef = components['schemas']['TermRef'];
export type Term = components['schemas']['Term'];
export type TermKind = components['schemas']['TermKind'];
export type MeasurementGroup = components['schemas']['MeasurementGroup'];
export type Measurement = components['schemas']['Measurement'];
export type Unit = components['schemas']['Unit'];
export type TaxonPage = components['schemas']['TaxonPage'];
export type TaxonStep = components['schemas']['TaxonStep'];
export type TaxonChild = components['schemas']['TaxonChild'];
export type TaxonRank = components['schemas']['TaxonRank'];

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

export const TAXON_RANKS: readonly TaxonRank[] = ['division', 'class', 'order', 'family', 'genus'];
