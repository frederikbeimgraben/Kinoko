import { TestBed } from '@angular/core/testing';
import { FAMILY, GroupsApiDouble, KARLSRUHE, groupsApiProvider } from '../../testing/groups-fixture';
import { GroupsStore } from './groups.store';

function build(api = new GroupsApiDouble()): { store: GroupsStore; api: GroupsApiDouble } {
  TestBed.configureTestingModule({ providers: [groupsApiProvider(api)] });
  return { store: TestBed.inject(GroupsStore), api };
}

describe('GroupsStore', () => {
  it('loads the groups and finds one by its id', () => {
    const { store, api } = build();

    store.load();

    expect(api.calls).toEqual([false]);
    expect(store.groups()).toHaveLength(2);
    expect(store.one(KARLSRUHE.id)?.name).toBe('Pilzgruppe Karlsruhe');
    expect(store.one('missing')).toBeNull();
  });

  it('searches in the name', () => {
    const { store } = build();
    store.load();

    store.setSearch('fami');

    expect(store.search()).toBe('fami');
    expect(store.found().map((one) => one.name)).toEqual(['Familie']);
    store.setSearch('');
    expect(store.found()).toHaveLength(2);
  });

  it('keeps a new group in name order', async () => {
    const { store, api } = build();
    store.load();

    const group = await store.create('Aachen');

    expect(group?.name).toBe('Aachen');
    expect(api.created).toEqual(['Aachen']);
    expect(store.groups()?.[0]?.name).toBe('Aachen');
    expect(store.writing()).toBe(false);
  });

  it('keeps the group of a join', async () => {
    const { store, api } = build();

    await store.join('PILZ-7F3K');

    expect(api.joined).toEqual(['PILZ-7F3K']);
    expect(store.groups()).toHaveLength(1);
  });

  it('tells an unknown invite code from other errors', async () => {
    const { store, api } = build();

    api.rejectWith = { type: 'about:blank', title: 'Nicht gefunden', status: 404 };
    await expect(store.join('XXXXXX')).resolves.toBe('invalid');
    api.rejectWith = { type: 'about:blank', title: 'Fehler', status: 500 };
    await expect(store.join('XXXXXX')).resolves.toBeNull();

    expect(store.groups() ?? []).toHaveLength(0);
    expect(store.writing()).toBe(false);
  });

  it('replaces a renamed group', async () => {
    const { store } = build();
    store.load();

    await store.rename(FAMILY.id, 'Neu');

    expect(store.one(FAMILY.id)?.name).toBe('Neu');
  });

  it('removes a deleted group from the list', async () => {
    const { store } = build();
    store.load();

    await expect(store.remove(FAMILY.id)).resolves.toBe(true);

    expect(store.groups()).toHaveLength(1);
  });

  it('removes a member from the group', async () => {
    const { store, api } = build();
    store.load();

    await expect(store.removeMember(KARLSRUHE.id, 'konto-zwei')).resolves.toBe(true);

    expect(api.dropped).toEqual([{ id: KARLSRUHE.id, userId: 'konto-zwei' }]);
    expect(store.one(KARLSRUHE.id)?.members).toHaveLength(1);
  });

  it('keeps the list pending when the group of a removed member is not known', async () => {
    const { store } = build();

    await store.removeMember('missing', 'konto-zwei');

    expect(store.groups()).toBeNull();
  });
});
