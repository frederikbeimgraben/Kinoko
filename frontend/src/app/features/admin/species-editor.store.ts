import { computed, inject } from '@angular/core';
import { tapResponse } from '@ngrx/operators';
import { patchState, signalStore, withComputed, withMethods, withProps, withState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { EMPTY, concatMap, exhaustMap, filter, merge, pipe, switchMap, tap } from 'rxjs';
import { SpeciesApi } from '../../core/api/species.api';
import type { BodyPart, SpeciesCounts, SpeciesEntry, SpeciesWrite } from '../../core/api/models';
import { toWrite } from './species-write';
import { finish, type AfterWrite } from './write';

interface SpeciesEditorState {
  slug: string;
  species: SpeciesEntry | null;
  counts: SpeciesCounts | null;
  /** Parts that a person chose and that have no value yet. */
  extraParts: readonly BodyPart[];
}

/** The profile and the counts of a species in edit mode. */
export const SpeciesEditorStore = signalStore(
  { providedIn: 'root' },
  withState<SpeciesEditorState>({ slug: '', species: null, counts: null, extraParts: [] }),
  withComputed(({ species }) => ({
    forecast: computed(() => species()?.forecastEnabled ?? false),
  })),
  withProps(() => ({ _api: inject(SpeciesApi) })),
  withMethods((store) => {
    const keep = (species: SpeciesEntry): void => {
      patchState(store, { species });
    };

    return {
      /** Loads the profile and the counts of a species. A second call for the same species has no effect. */
      load: rxMethod<string>(
        pipe(
          filter((slug) => slug !== store.slug()),
          tap((slug) => {
            patchState(store, { slug, species: null, counts: null, extraParts: [] });
          }),
          switchMap((slug) =>
            slug === ''
              ? EMPTY
              : merge(
                  store._api.profile(slug).pipe(tapResponse({ next: keep, error: () => undefined })),
                  store._api.counts(slug).pipe(
                    tapResponse({
                      next: (counts) => {
                        patchState(store, { counts });
                      },
                      error: () => undefined,
                    }),
                  ),
                ),
          ),
        ),
      ),

      /** Keeps parts without a value, so that the editor shows a row for each. */
      addParts(parts: readonly BodyPart[]): void {
        patchState(store, ({ extraParts }) => ({
          extraParts: [...extraParts, ...parts.filter((one) => !extraParts.includes(one))],
        }));
      },

      /** Writes the changed fields. The response holds the new profile. */
      save: rxMethod<Partial<SpeciesWrite>>(
        pipe(
          concatMap((change) => {
            const species = store.species();
            const slug = store.slug();
            if (species === null || slug === '') return EMPTY;
            return store._api
              .replace(slug, { ...toWrite(species), ...change })
              .pipe(tapResponse({ next: keep, error: () => undefined }));
          }),
        ),
      ),

      setForecast: rxMethod<boolean>(
        pipe(
          filter(() => store.slug() !== ''),
          concatMap((enabled) =>
            store._api
              .setForecast(store.slug(), enabled)
              .pipe(tapResponse({ next: keep, error: () => undefined })),
          ),
        ),
      ),

      remove: rxMethod<AfterWrite>(
        pipe(
          filter(() => store.slug() !== ''),
          exhaustMap((request) =>
            store._api.remove(store.slug()).pipe(
              tapResponse({
                next: () => {
                  finish(request);
                },
                error: () => undefined,
              }),
            ),
          ),
        ),
      ),
    };
  }),
);

/** The instance type of {@link SpeciesEditorStore}. */
export type SpeciesEditorStore = InstanceType<typeof SpeciesEditorStore>;
