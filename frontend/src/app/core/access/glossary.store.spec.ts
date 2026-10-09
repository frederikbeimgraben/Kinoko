import { TestBed } from '@angular/core/testing';
import { GlossaryApiDouble, HYMENIUM, LAMELLEN, glossaryApiProvider } from '../../testing/glossary-fixture';
import { GlossaryStore, glossaryIn } from './glossary.store';

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

describe('glossaryIn', () => {
  const VELUM = { ...HYMENIUM, id: 'begriff-drei', term: 'Velum', termEn: 'Veil', definitionEn: 'Cover.' };

  it('gives term and definition in English, sorted by the English term', () => {
    const shown = glossaryIn([VELUM, HYMENIUM, LAMELLEN], 'en');

    expect(shown.map((entry) => entry.term)).toEqual(['Hymenium', 'Lamellen', 'Veil']);
    expect(shown.map((entry) => entry.definition)).toEqual([
      HYMENIUM.definitionEn,
      LAMELLEN.definition,
      'Cover.',
    ]);
  });

  it('keeps the German texts in German', () => {
    expect(glossaryIn([VELUM, LAMELLEN], 'de').map((entry) => entry.term)).toEqual(['Lamellen', 'Velum']);
  });
});
