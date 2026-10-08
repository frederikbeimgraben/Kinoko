import type { CombinationBound, CombinationRule, ValueScale } from './value-colors';

/** Messages between the main thread and the colour worker. */

export interface ColorizeJob {
  kind: 'faerbe';
  id: number;
  url: string;
  scale: ValueScale;
  colors: readonly string[];
}

export interface CombinationPart {
  url: string;
  bound: CombinationBound;
}

export interface CombinationJob {
  kind: 'combination';
  id: number;
  parts: readonly CombinationPart[];
  rule: CombinationRule;
  colors: readonly string[];
}

export interface PrefetchJob {
  kind: 'vorladen';
  urls: readonly string[];
}

export type ValueJob = ColorizeJob | CombinationJob | PrefetchJob;

/** `shot` is `null` when the tile does not exist. This is not an error. */
export interface ValueReply {
  id: number;
  shot: ImageBitmap | null;
}
