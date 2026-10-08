import { computed } from '@angular/core';
import { tapResponse } from '@ngrx/operators';
import { patchState, signalStoreFeature, withComputed, withMethods, withState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { filter, pipe, switchMap, type Observable } from 'rxjs';
import type { Page } from '../api/models';

/** Gets one page: `limit` rows from `offset` on. */
export type PageSource<E> = (offset: number, limit: number) => Observable<Page<E>>;

/** A page has more rows than one screen and fewer rows than the full list. */
export const DEFAULT_PAGE_SIZE = 25;

/** The state part that `withPagedList` adds to a store. `_held` is private. */
export interface PagedListState<E> {
  /** `null` while the first response is pending. */
  _held: readonly E[] | null;
  /** The number of rows in the service, not the number of rows in memory. */
  total: number;
  busy: boolean;
}

/** Adds a list that comes in pages. `source` runs in the injection context, so it can call `inject`. */
export function withPagedList<E>(source: () => PageSource<E>, pageSize = DEFAULT_PAGE_SIZE) {
  return signalStoreFeature(
    withState<PagedListState<E>>({ _held: null, total: 0, busy: false }),
    withComputed(({ _held, total }) => ({
      entries: computed<readonly E[]>(() => _held() ?? []),
      loaded: computed(() => _held() !== null),
      more: computed(() => (_held()?.length ?? 0) < total()),
    })),
    withMethods((store) => {
      let current = source();

      // A restart cancels a running request. A `next` call during a request has no effect.
      const load = rxMethod<boolean>(
        pipe(
          filter((fresh) => fresh || !store.busy()),
          switchMap((fresh) => {
            const held = fresh ? [] : (store._held() ?? []);
            patchState(store, fresh ? { _held: null, total: 0, busy: true } : { busy: true });
            return current(held.length, pageSize).pipe(
              tapResponse({
                next: (page) => {
                  patchState(store, {
                    _held: [...held, ...page.eintraege],
                    total: page.gesamt,
                    busy: false,
                  });
                },
                // A failure keeps the rows in memory. The ApiClient toast tells the user.
                error: () => {
                  patchState(store, { _held: held, busy: false });
                },
              }),
            );
          }),
        ),
      );

      return {
        /** Starts again from the first page. A change of view discards the old rows. */
        restart(next?: PageSource<E>): void {
          if (next !== undefined) current = next;
          load(true);
        },
        /** Adds the next page after the rows in memory. */
        next(): void {
          load(false);
        },
        /** Removes the rows that no longer belong to this view, without a new request. */
        withoutEntry(matches: (entry: E) => boolean): void {
          patchState(store, ({ _held, total }) => {
            if (_held === null) return {};
            const left = _held.filter((entry) => !matches(entry));
            return { _held: left, total: total - (_held.length - left.length) };
          });
        },
      };
    }),
  );
}
