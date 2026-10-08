import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withProps, withState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { catchError, filter, map, mergeMap, of, pipe, tap } from 'rxjs';
import { TaxaApi } from '../../core/api/taxa.api';
import type { TaxonPage, TaxonRank } from '../../core/api/models';

/** One rank and slug of the taxonomy. */
export interface TaxonKey {
  readonly rank: TaxonRank;
  readonly slug: string;
}

interface TaxonomyFields {
  /** The loaded steps, by `rank/slug`. */
  pages: ReadonlyMap<string, TaxonPage>;
  /** The steps that the service does not know. */
  missing: ReadonlySet<string>;
  /** The steps that are requested or known. */
  asked: ReadonlySet<string>;
}

/** The map key of a step. */
export function taxonKey({ rank, slug }: TaxonKey): string {
  return `${rank}/${slug}`;
}

/** The loaded steps of the taxonomy, by rank and slug. Each step loads one time. */
export const TaxonomyStore = signalStore(
  { providedIn: 'root' },
  withState<TaxonomyFields>(() => ({ pages: new Map(), missing: new Set(), asked: new Set() })),
  withProps(() => ({ _api: inject(TaxaApi) })),
  withMethods((store) => ({
    pageOf(rank: TaxonRank, slug: string): TaxonPage | null {
      return store.pages().get(taxonKey({ rank, slug })) ?? null;
    },

    isUnknown(rank: TaxonRank, slug: string): boolean {
      return store.missing().has(taxonKey({ rank, slug }));
    },

    /** Loads each step one time. `null` is an address without a known rank. */
    load: rxMethod<TaxonKey | null>(
      pipe(
        filter((step): step is TaxonKey => step !== null),
        map((step) => ({ step, key: taxonKey(step) })),
        filter(({ key }) => !store.asked().has(key)),
        tap(({ key }) => {
          patchState(store, ({ asked }) => ({ asked: new Set(asked).add(key) }));
        }),
        mergeMap(({ step, key }) =>
          store._api.page(step.rank, step.slug).pipe(
            map((page): TaxonPage | null => page),
            catchError(() => of(null)),
            map((page) => ({ key, page })),
          ),
        ),
        tap(({ key, page }) => {
          if (page === null) patchState(store, ({ missing }) => ({ missing: new Set(missing).add(key) }));
          else patchState(store, ({ pages }) => ({ pages: new Map(pages).set(key, page) }));
        }),
      ),
    ),
  })),
);

/** The instance type of {@link TaxonomyStore}. */
export type TaxonomyStore = InstanceType<typeof TaxonomyStore>;
