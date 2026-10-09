import { computed, inject } from '@angular/core';
import { tapResponse } from '@ngrx/operators';
import { patchState, signalStore, withComputed, withMethods, withProps, withState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { exhaustMap, filter, pipe, switchMap, type Observable } from 'rxjs';
import { TermsApi } from '../../core/api/terms.api';
import type { Term, TermKind } from '../../core/api/models';
import { withSearchableList } from '../../core/state';
import { slugOf } from './term-slug';
import { type AfterWrite, finish, trigger } from './write';

interface CategoriesState {
  kind: TermKind;
  /** True while a write runs. A second tap then has no effect. */
  saving: boolean;
}

/** A new category with this name, or a new name for the category `id`. */
export interface CategoryWrite extends AfterWrite {
  readonly id: string | null;
  readonly name: string;
}

/** Delete the category `id`, or merge it into the category `into`. */
export interface CategoryDrop extends AfterWrite {
  readonly id: string;
  readonly into: string | null;
}

/** The terms of the administration: create, rename, delete and merge. */
export const CategoriesStore = signalStore(
  { providedIn: 'root' },
  withSearchableList<Term>({
    matches: (item, needle) => item.name.toLocaleLowerCase().includes(needle),
    sortKey: (item) => item.name,
  }),
  withState<CategoriesState>({ kind: 'smell', saving: false }),
  withComputed(({ found, kind }) => ({
    /** The terms of the chosen kind that the search keeps. */
    visible: computed(() => found().filter((one) => one.kind === kind())),
  })),
  withProps(() => ({ _api: inject(TermsApi) })),
  withMethods((store) => {
    const written = <T>(
      call: Observable<T>,
      request: AfterWrite,
      next: (value: T) => void,
    ): Observable<T> => {
      patchState(store, { saving: true });
      return call.pipe(
        tapResponse({
          next: (value) => {
            patchState(store, { saving: false });
            next(value);
            finish(request);
          },
          error: () => {
            patchState(store, { saving: false });
          },
        }),
      );
    };

    return {
      load: trigger(
        rxMethod<true>(
          pipe(
            switchMap(() =>
              store._api.list().pipe(
                tapResponse({
                  next: (terms) => {
                    store.setItems(terms);
                  },
                  error: () => undefined,
                }),
              ),
            ),
          ),
        ),
      ),

      setKind(kind: TermKind): void {
        patchState(store, { kind });
      },

      save: rxMethod<CategoryWrite>(
        pipe(
          filter(() => !store.saving()),
          exhaustMap((request) =>
            written(
              request.id === null
                ? store._api.create({ kind: store.kind(), slug: slugOf(request.name), name: request.name })
                : store._api.patch(request.id, { name: request.name }),
              request,
              // A write answers without the count: a new term has no use yet, a renamed term keeps its count.
              (term) => {
                const known = store.items()?.find((one) => one.id === term.id);
                store.put({ ...term, usage: term.usage ?? known?.usage ?? 0 });
              },
            ),
          ),
        ),
      ),

      remove: rxMethod<CategoryDrop>(
        pipe(
          filter(() => !store.saving()),
          exhaustMap((request) =>
            written(
              request.into === null
                ? store._api.remove(request.id)
                : store._api.merge(request.id, request.into),
              request,
              () => {
                store.drop(request.id);
              },
            ),
          ),
        ),
      ),
    };
  }),
);

/** The instance type of {@link CategoriesStore}. */
export type CategoriesStore = InstanceType<typeof CategoriesStore>;
