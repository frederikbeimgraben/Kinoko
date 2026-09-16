/** Die Typen der Rechenläufe, direkt aus dem Vertrag. */

import type { components } from '../contract';

export type RunKind = components['schemas']['RunKind'];
export type RunState = components['schemas']['RunState'];
export type PipelineRun = components['schemas']['PipelineRunSummary'];
export type PipelineRunDetail = components['schemas']['PipelineRunDetail'];
export type PipelineRunStep = components['schemas']['PipelineRunStep'];
export type PipelineRunSpecies = components['schemas']['PipelineRunSpeciesEntry'];

export const RUN_KINDS: readonly RunKind[] = ['training', 'render', 'full'];
