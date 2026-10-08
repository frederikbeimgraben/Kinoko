/** The types of the pipeline runs, from the contract. */

import type { components } from '../contract';

export type RunKind = components['schemas']['RunKind'];
export type RunState = components['schemas']['RunState'];
export type PipelineRun = components['schemas']['PipelineRunSummary'];
export type PipelineRunDetail = components['schemas']['PipelineRunDetail'];
export type PipelineRunStep = components['schemas']['PipelineRunStep'];
export type PipelineRunSpecies = components['schemas']['PipelineRunSpeciesEntry'];
export type PipelineRunInput = components['schemas']['PipelineRunInput'];

export const RUN_KINDS: readonly RunKind[] = ['training', 'render', 'full', 'fetch'];
