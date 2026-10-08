import { computed, inject } from '@angular/core';
import { tapResponse } from '@ngrx/operators';
import { patchState, signalStore, withComputed, withMethods, withProps, withState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { exhaustMap, filter, pipe } from 'rxjs';
import { AccessApi } from '../../core/api/access.api';
import type { SpeciesCountsEntry } from '../../core/api/models';
import { trigger } from './write';

/** The counts of each species, by id. */
export type CountsBySpecies = ReadonlyMap<string, SpeciesCountsEntry>;

interface AdminSpeciesState {
  rows: readonly SpeciesCountsEntry[];
}

/** The counts of the species administration. The list itself is in the local catalogue. */
export const AdminSpeciesStore = signalStore(
  { providedIn: 'root' },
  withState<AdminSpeciesState>({ rows: [] }),
  withComputed(({ rows }) => ({
    counts: computed<CountsBySpecies>(() => new Map(rows().map((one) => [one.speciesId, one]))),
  })),
  withProps(() => ({ _api: inject(AccessApi) })),
  withMethods((store) => ({
    load: trigger(
      rxMethod<true>(
        pipe(
          filter(() => store.rows().length === 0),
          exhaustMap(() =>
            store._api.speciesCounts().pipe(
              tapResponse({
                next: (rows) => {
                  patchState(store, { rows });
                },
                error: () => undefined,
              }),
            ),
          ),
        ),
      ),
    ),
  })),
);

/** The instance type of {@link AdminSpeciesStore}. */
export type AdminSpeciesStore = InstanceType<typeof AdminSpeciesStore>;
