import { TestBed } from '@angular/core/testing';
import { FAMILY, GroupsApiDouble, KARLSRUHE, groupsApiProvider } from '../../testing/groups-fixture';
import { GroupsState } from './groups.state';

function build(api = new GroupsApiDouble()): { state: GroupsState; api: GroupsApiDouble } {
  TestBed.configureTestingModule({ providers: [groupsApiProvider(api)] });
  return { state: TestBed.inject(GroupsState), api };
}

describe('GroupsState', () => {
  it('lädt die Gruppen und findet eine über ihre Kennung', () => {
    const { state, api } = build();

    state.load();

    expect(api.calls).toEqual([false]);
    expect(state.groups()).toHaveLength(2);
    expect(state.one(KARLSRUHE.id)?.name).toBe('Pilzgruppe Karlsruhe');
    expect(state.one('fehlt')).toBeNull();
  });

  it('sucht im Namen', () => {
    const { state } = build();
    state.load();

    state.setSearch('fami');

    expect(state.search()).toBe('fami');
    expect(state.found().map((one) => one.name)).toEqual(['Familie']);
    state.setSearch('');
    expect(state.found()).toHaveLength(2);
  });

  it('nimmt eine neue Gruppe nach Name geordnet auf', () => {
    const { state, api } = build();
    state.load();

    state.create('Aachen').subscribe();

    expect(api.created).toEqual(['Aachen']);
    expect(state.groups()?.[0]?.name).toBe('Aachen');
  });

  it('nimmt die Gruppe eines Beitritts auf', () => {
    const { state, api } = build();

    state.join('PILZ-7F3K').subscribe();

    expect(api.joined).toEqual(['PILZ-7F3K']);
    expect(state.groups()).toHaveLength(1);
  });

  it('ersetzt eine umbenannte Gruppe', () => {
    const { state } = build();
    state.load();

    state.rename(FAMILY.id, 'Neu').subscribe();

    expect(state.one(FAMILY.id)?.name).toBe('Neu');
  });

  it('nimmt eine gelöschte Gruppe aus der Liste', () => {
    const { state } = build();
    state.load();

    state.remove(FAMILY.id).subscribe();

    expect(state.groups()).toHaveLength(1);
  });

  it('nimmt ein entferntes Mitglied aus der Gruppe', () => {
    const { state, api } = build();
    state.load();

    state.removeMember(KARLSRUHE.id, 'konto-zwei').subscribe();

    expect(api.dropped).toEqual([{ id: KARLSRUHE.id, userId: 'konto-zwei' }]);
    expect(state.one(KARLSRUHE.id)?.members).toHaveLength(1);
  });

  it('lässt eine unbekannte Gruppe beim Entfernen stehen', () => {
    const { state } = build();

    state.removeMember('fehlt', 'konto-zwei').subscribe();

    expect(state.groups()).toBeNull();
  });
});
