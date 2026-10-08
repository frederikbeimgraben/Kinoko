import { TestBed } from '@angular/core/testing';
import { signalStore } from '@ngrx/signals';
import { withSearchableList } from './searchable-list.feature';

interface Item {
  id: string;
  name: string;
}

const Store = signalStore(
  { providedIn: 'root' },
  withSearchableList<Item>({
    matches: (item, needle) => item.name.toLocaleLowerCase().includes(needle),
    sortKey: (item) => item.name,
  }),
);

const names = (items: readonly Item[] | null): string[] | null => items?.map((item) => item.name) ?? null;

describe('withSearchableList', () => {
  it('is pending until the first list comes', () => {
    const store = TestBed.inject(Store);

    expect(store.items()).toBeNull();
    expect(store.found()).toEqual([]);
    expect(store.one('a')).toBeNull();
  });

  it('sorts the list and finds an item by its id', () => {
    const store = TestBed.inject(Store);

    store.setItems([
      { id: 'b', name: 'Birch' },
      { id: 'a', name: 'Alder' },
    ]);

    expect(names(store.items())).toEqual(['Alder', 'Birch']);
    expect(store.one('b')?.name).toBe('Birch');
  });

  it('filters by the trimmed search text in lower case', () => {
    const store = TestBed.inject(Store);
    store.setItems([
      { id: 'a', name: 'Alder' },
      { id: 'b', name: 'Birch' },
    ]);

    store.setSearch('  BIR ');

    expect(store.search()).toBe('  BIR ');
    expect(names(store.found())).toEqual(['Birch']);
  });

  it('adds, replaces and drops items', () => {
    const store = TestBed.inject(Store);

    store.put({ id: 'c', name: 'Cedar' });
    store.put({ id: 'a', name: 'Alder' });
    store.put({ id: 'c', name: 'Aspen' });
    expect(names(store.items())).toEqual(['Alder', 'Aspen']);

    store.drop('a');
    expect(names(store.items())).toEqual(['Aspen']);

    store.setItems(null);
    store.drop('c');
    expect(store.items()).toBeNull();
  });
});
