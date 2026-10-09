import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withProps, withState } from '@ngrx/signals';
import type { SpeciesEntry } from '../../../core/api/models';
import { SpeciesStore } from '../species.store';

/** The comparison puts two species side by side. */
const PAIR = 2;

/** The query parameter of the comparison address: `/arten/vergleich?arten=a,b`. */
export const COMPARE_PARAM = 'arten';

/** The query parameters of a comparison of these species. */
export function compareQuery(slugs: readonly string[]): Record<string, string> {
  return { [COMPARE_PARAM]: [...new Set(slugs)].slice(0, PAIR).join(',') };
}

/** The slugs of a comparison address, at most `limit`. An empty or a missing value gives no species. */
export function compareSlugs(value: string | null | undefined, limit = PAIR): string[] {
  return [...new Set((value ?? '').split(',').map((one) => one.trim()))]
    .filter((one) => one !== '')
    .slice(0, limit);
}

interface ComparisonFields {
  /** The chosen slugs, in the order of the choice. The page takes them from the address. */
  slugs: readonly string[];
  /** True when the table shows only the rows that differ. */
  diffOnly: boolean;
}

/** The species of the comparison. */
export const ComparisonStore = signalStore(
  { providedIn: 'root' },
  withState<ComparisonFields>({ slugs: [], diffOnly: false }),
  withProps(() => ({ _catalogue: inject(SpeciesStore) })),
  withComputed(({ slugs, _catalogue }) => ({
    /** The chosen species in the order of the choice, without the unknown ones. */
    species: computed<readonly SpeciesEntry[]>(() =>
      slugs()
        .map((slug) => _catalogue.entryOf(slug))
        .filter((one): one is SpeciesEntry => one !== null),
    ),
  })),
  withMethods((store) => ({
    /** Sets a new choice, for example from a species page. */
    set(slugs: readonly string[]): void {
      patchState(store, { slugs: [...new Set(slugs)].slice(0, PAIR) });
    },

    /** A further species takes the place of the second one. */
    add(slug: string): void {
      if (store.slugs().includes(slug)) return;
      patchState(store, ({ slugs }) => ({ slugs: [...slugs.slice(0, PAIR - 1), slug] }));
    },

    remove(slug: string): void {
      patchState(store, ({ slugs }) => ({ slugs: slugs.filter((one) => one !== slug) }));
    },

    setDiffOnly(diffOnly: boolean): void {
      patchState(store, { diffOnly });
    },
  })),
);

/** The instance type of {@link ComparisonStore}. */
export type ComparisonStore = InstanceType<typeof ComparisonStore>;
