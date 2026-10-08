import { computed, inject } from '@angular/core';
import { tapResponse } from '@ngrx/operators';
import { patchState, signalStore, withComputed, withMethods, withProps, withState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { exhaustMap, filter, pipe, tap } from 'rxjs';
import { SpeciesApi } from '../../core/api/species.api';
import type { StandardColour } from '../../core/api/models';
import { trigger } from './write';

interface CatalogueState {
  /** `null` until the first request starts. */
  colours: readonly StandardColour[] | null;
}

/** The standard colours of the catalogue. They come with the species bundle. */
export const CatalogueStore = signalStore(
  { providedIn: 'root' },
  withState<CatalogueState>({ colours: null }),
  withComputed(({ colours }) => ({
    standardColours: computed(() => colours() ?? []),
  })),
  withProps(() => ({ _api: inject(SpeciesApi) })),
  withMethods((store) => ({
    load: trigger(
      rxMethod<true>(
        pipe(
          filter(() => store.colours() === null),
          tap(() => {
            patchState(store, { colours: [] });
          }),
          exhaustMap(() =>
            store._api.bundle(null).pipe(
              tapResponse({
                next: (page) => {
                  patchState(store, { colours: page.body?.standardColours ?? [] });
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

/** The instance type of {@link CatalogueStore}. */
export type CatalogueStore = InstanceType<typeof CatalogueStore>;
