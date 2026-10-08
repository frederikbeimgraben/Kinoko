import { computed } from '@angular/core';
import { patchState, signalStoreFeature, withComputed, withMethods, withState } from '@ngrx/signals';

/** How `withSearchableList` filters and sorts its items. */
export interface SearchableListConfig<T> {
  /** Tells if an item matches the search. `needle` is trimmed and in lower case. */
  matches: (item: T, needle: string) => boolean;
  /** The list stays sorted by this key. */
  sortKey: (item: T) => string;
}

/** The state part that `withSearchableList` adds to a store. */
export interface SearchableListState<T> {
  /** `null` while the first response is pending. */
  items: readonly T[] | null;
  search: string;
}

/** Adds a list of items with an id, a search text and the computed `found` list. */
export function withSearchableList<T extends { id: string }>(config: SearchableListConfig<T>) {
  const sorted = (items: readonly T[]): readonly T[] =>
    [...items].sort((a, b) => config.sortKey(a).localeCompare(config.sortKey(b)));

  return signalStoreFeature(
    withState<SearchableListState<T>>({ items: null, search: '' }),
    withComputed(({ items, search }) => ({
      found: computed<readonly T[]>(() => {
        const needle = search().trim().toLocaleLowerCase();
        const all = items() ?? [];
        return needle === '' ? all : all.filter((item) => config.matches(item, needle));
      }),
    })),
    withMethods((store) => ({
      setSearch(search: string): void {
        patchState(store, { search });
      },
      /** Reads the item with this id. In a `computed`, it follows the list. */
      one(id: string): T | null {
        return store.items()?.find((item) => item.id === id) ?? null;
      },
      /** Sets the whole list. `null` sets the list back to pending. */
      setItems(items: readonly T[] | null): void {
        patchState(store, { items: items === null ? null : sorted(items) });
      },
      /** Adds the item, or replaces the item with the same id. */
      put(item: T): void {
        patchState(store, ({ items }) => ({
          items: sorted([...(items ?? []).filter((one) => one.id !== item.id), item]),
        }));
      },
      drop(id: string): void {
        patchState(store, ({ items }) => ({
          items: items?.filter((one) => one.id !== id) ?? null,
        }));
      },
    })),
  );
}
