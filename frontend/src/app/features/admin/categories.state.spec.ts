import { TestBed } from '@angular/core/testing';
import { ANISE, OAK, TermsApiDouble, termsApiProvider } from '../../testing/terms-fixture';
import { CategoriesState } from './categories.state';

function build(api = new TermsApiDouble()): { state: CategoriesState; api: TermsApiDouble } {
  TestBed.configureTestingModule({ providers: [termsApiProvider(api)] });
  const state = TestBed.inject(CategoriesState);
  state.load();
  return { state, api };
}

describe('CategoriesState', () => {
  it('zeigt nur die Begriffe der gewählten Gattung', () => {
    const { state } = build();

    expect(state.visible().map((one) => one.id)).toEqual([ANISE.id, 'begriff-mehl']);

    state.setKind('tree');

    expect(state.visible().map((one) => one.id)).toEqual([OAK.id]);
  });

  it('sucht innerhalb der Gattung', () => {
    const { state } = build();

    state.setSearch('mehl');

    expect(state.visible().map((one) => one.name)).toEqual(['Mehl']);
  });

  it('legt einen Begriff mit Kennung aus dem Namen an', () => {
    const { state, api } = build();
    state.setKind('tree');

    state.create('Grüne Eiche').subscribe();

    expect(api.created).toEqual([{ kind: 'tree', slug: 'gruene-eiche', name: 'Grüne Eiche' }]);
    expect(state.visible().map((one) => one.name)).toContain('Grüne Eiche');
  });

  it('benennt um und hält die Liste sortiert', () => {
    const { state, api } = build();

    state.rename(ANISE.id, 'Zimt').subscribe();

    expect(api.patched).toEqual([{ id: ANISE.id, write: { name: 'Zimt' } }]);
    expect(state.visible().map((one) => one.name)).toEqual(['Mehl', 'Zimt']);
  });

  it('nimmt einen gelöschten Begriff aus der Liste', () => {
    const { state, api } = build();

    state.remove(ANISE.id).subscribe();

    expect(api.removed).toEqual([ANISE.id]);
    expect(state.visible().map((one) => one.id)).toEqual(['begriff-mehl']);
  });

  it('nimmt den verschmolzenen Begriff aus der Liste', () => {
    const { state, api } = build();

    state.merge(ANISE.id, 'begriff-mehl').subscribe();

    expect(api.merged).toEqual([{ id: ANISE.id, into: 'begriff-mehl' }]);
    expect(state.visible().map((one) => one.id)).toEqual(['begriff-mehl']);
  });
});
