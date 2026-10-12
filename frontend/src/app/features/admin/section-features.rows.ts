import type { Phase } from '../../core/api/models';

/** A feature with the phase of the fruit body that shows it. */
export interface PhaseEntry<T extends string> {
  value: T;
  phase: Phase;
}

/** The values of one phase, in stored order. */
export function inPhase<T extends string>(entries: readonly PhaseEntry<T>[], phase: Phase): T[] {
  return entries.filter((one) => one.phase === phase).map((one) => one.value);
}

/** The entries of both phases: first the young ones, each phase in the order of `order`. */
export function phaseEntries<T extends string>(
  order: readonly T[],
  young: readonly string[],
  old: readonly string[],
): PhaseEntry<T>[] {
  const of = (chosen: readonly string[], phase: Phase): PhaseEntry<T>[] =>
    order.filter((value) => chosen.includes(value)).map((value) => ({ value, phase }));
  return [...of(young, 'young'), ...of(old, 'old')];
}
