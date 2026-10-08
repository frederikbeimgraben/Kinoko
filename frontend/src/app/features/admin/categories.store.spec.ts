import { TestBed } from '@angular/core/testing';
import { ANISE, OAK, TermsApiDouble, termsApiProvider } from '../../testing/terms-fixture';
import { CategoriesStore } from './categories.store';

function build(api = new TermsApiDouble()): { store: CategoriesStore; api: TermsApiDouble } {
  TestBed.configureTestingModule({ providers: [termsApiProvider(api)] });
  const store = TestBed.inject(CategoriesStore);
  store.load();
  return { store, api };
}

describe('CategoriesStore', () => {
  it('shows only the terms of the chosen kind', () => {
    const { store } = build();

    expect(store.visible().map((one) => one.id)).toEqual([ANISE.id, 'begriff-mehl']);

    store.setKind('tree');

    expect(store.visible().map((one) => one.id)).toEqual([OAK.id]);
  });

  it('searches inside the kind', () => {
    const { store } = build();

    store.setSearch('mehl');

    expect(store.visible().map((one) => one.name)).toEqual(['Mehl']);
  });

  it('creates a term with a slug from the name and calls the next step', () => {
    const { store, api } = build();
    const onDone = vi.fn();
    store.setKind('tree');

    store.save({ id: null, name: 'Grüne Eiche', onDone });

    expect(api.created).toEqual([{ kind: 'tree', slug: 'gruene-eiche', name: 'Grüne Eiche' }]);
    expect(store.visible().map((one) => one.name)).toContain('Grüne Eiche');
    expect(onDone).toHaveBeenCalledOnce();
    expect(store.saving()).toBe(false);
  });

  it('renames and keeps the list sorted', () => {
    const { store, api } = build();

    store.save({ id: ANISE.id, name: 'Zimt' });

    expect(api.patched).toEqual([{ id: ANISE.id, write: { name: 'Zimt' } }]);
    expect(store.visible().map((one) => one.name)).toEqual(['Mehl', 'Zimt']);
  });

  it('removes a deleted term from the list', () => {
    const { store, api } = build();

    store.drop({ id: ANISE.id, into: null });

    expect(api.removed).toEqual([ANISE.id]);
    expect(store.visible().map((one) => one.id)).toEqual(['begriff-mehl']);
  });

  it('removes a merged term from the list', () => {
    const { store, api } = build();

    store.drop({ id: ANISE.id, into: 'begriff-mehl' });

    expect(api.merged).toEqual([{ id: ANISE.id, into: 'begriff-mehl' }]);
    expect(store.visible().map((one) => one.id)).toEqual(['begriff-mehl']);
  });
});
