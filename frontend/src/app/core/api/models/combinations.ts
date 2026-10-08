import type { components } from '../contract';

/** How the map combines the factors. */
export type Rule = components['schemas']['Rule'];

/** The three forms of a condition. Each one is a range of the scale. */
export type Condition = components['schemas']['Condition'];

/** A factor in the wire format of the contract. */
export type WireFactor = components['schemas']['Factor'];

export type Combination = components['schemas']['Combination'];

export type CombinationInput = components['schemas']['CombinationWrite'];

export type CombinationPage = components['schemas']['CombinationPage'];
