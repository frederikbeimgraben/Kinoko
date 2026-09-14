import type { components } from '../contract';

/** Wie die Karte die Faktoren zusammenrechnet. */
export type Rule = components['schemas']['Rule'];

/** Die drei Formen einer Bedingung. Alle drei sind eine Spanne der Skala. */
export type Condition = components['schemas']['Condition'];

/** Ein Faktor auf dem Draht, so wie der Vertrag ihn nennt. */
export type WireFactor = components['schemas']['Factor'];

export type Combination = components['schemas']['Combination'];

export type CombinationInput = components['schemas']['CombinationWrite'];

export type CombinationPage = components['schemas']['CombinationPage'];
