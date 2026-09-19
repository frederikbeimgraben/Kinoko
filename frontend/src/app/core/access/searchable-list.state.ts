import { computed, signal } from '@angular/core';

/** Shared search, list, upsert and sort logic for a signal-backed item list. */
export abstract class SearchableListState<T extends { id: string }> {
  private readonly _items = signal<readonly T[] | null>(null);
  private readonly _search = signal('');

  /** `null` while the first response is pending. */
  readonly items = this._items.asReadonly();
  readonly search = this._search.asReadonly();

  readonly found = computed(() => {
    const needle = this._search().trim().toLocaleLowerCase();
    const all = this._items() ?? [];
    return needle === '' ? all : all.filter((item) => this.matches(item, needle));
  });

  setSearch(value: string): void {
    this._search.set(value);
  }

  one(id: string): T | null {
    return this._items()?.find((item) => item.id === id) ?? null;
  }

  protected setItems(items: readonly T[] | null): void {
    this._items.set(items);
  }

  /** Adds one item, or replaces it. The list stays sorted by `sortKey`. */
  protected put(item: T): void {
    this._items.update((all) => {
      const rest = (all ?? []).filter((one) => one.id !== item.id);
      return [...rest, item].sort((a, b) => this.sortKey(a).localeCompare(this.sortKey(b)));
    });
  }

  protected drop(id: string): void {
    this._items.update((all) => all?.filter((one) => one.id !== id) ?? null);
  }

  protected abstract matches(item: T, needle: string): boolean;

  protected abstract sortKey(item: T): string;
}
