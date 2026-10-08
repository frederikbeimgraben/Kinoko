import { TestBed } from '@angular/core/testing';
import { GlossaryApiDouble, HYMENIUM, glossaryApiProvider } from '../../testing/glossary-fixture';
import { GlossaryStore } from './glossary.store';

function build(api = new GlossaryApiDouble()): { store: GlossaryStore; api: GlossaryApiDouble } {
  TestBed.configureTestingModule({ providers: [glossaryApiProvider(api)] });
  return { store: TestBed.inject(GlossaryStore), api };
}

describe('GlossaryStore', () => {
  it('loads the terms and finds one by its id', () => {
    const { store } = build();

    store.load();

    expect(store.entries()).toHaveLength(2);
    expect(store.one(HYMENIUM.id)?.term).toBe('Hymenium');
    expect(store.one('missing')).toBeNull();
  });

  it('searches in the term and the definition', () => {
    const { store } = build();
    store.load();

    store.setSearch('blattartige');
    expect(store.found().map((one) => one.term)).toEqual(['Lamellen']);

    store.setSearch('hymen');
    expect(store.found()).toHaveLength(1);

    store.setSearch('');
    expect(store.found()).toHaveLength(2);
  });

  it('keeps a new term in term order', async () => {
    const { store, api } = build();
    store.load();

    await store.create({ term: 'Anhängsel', definition: 'Kurz.' });

    expect(api.created).toEqual([{ term: 'Anhängsel', definition: 'Kurz.' }]);
    expect(store.entries()?.[0]?.term).toBe('Anhängsel');
  });

  it('replaces a changed term and deletes one', async () => {
    const { store, api } = build();
    store.load();

    await store.update(HYMENIUM.id, { term: 'Hymenium', definition: 'Neu.' });
    expect(store.one(HYMENIUM.id)?.definition).toBe('Neu.');

    await expect(store.remove(HYMENIUM.id)).resolves.toBe(true);
    expect(api.removed).toEqual([HYMENIUM.id]);
    expect(store.entries()).toHaveLength(1);
  });
});
