import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withProps, withState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { catchError, of, pipe, switchMap, tap, type Observable } from 'rxjs';
import { GroupsApi } from '../api/groups.api';
import type { FriendGroup } from '../api/models';
import { confirmed, settle, withSearchableList } from '../state';

/** What `load` asks for: all groups (with `group.manage`) and a call without a toast. */
interface GroupsQuery {
  readonly all: boolean;
  readonly quiet: boolean;
}

/** The groups in memory. The account, the visibility choice and the administration read the same list. */
export const GroupsStore = signalStore(
  { providedIn: 'root' },
  withSearchableList<FriendGroup>({
    matches: (group, needle) => group.name.toLocaleLowerCase().includes(needle),
    sortKey: (group) => group.name,
  }),
  withState({ writing: false }),
  withProps(({ items }) => ({ groups: items, _api: inject(GroupsApi) })),
  withMethods((store) => {
    const fetch = rxMethod<GroupsQuery>(
      pipe(
        switchMap(({ all, quiet }) =>
          store._api.list(all, { quiet }).pipe(catchError(() => of<FriendGroup[]>([]))),
        ),
        tap((groups) => {
          store.setItems(groups);
        }),
      ),
    );

    /** Runs one write. `writing` is true while it runs; `done` gets a success only. */
    async function write<T>(request: Observable<T>, done: (value: T) => void): Promise<T | null> {
      patchState(store, { writing: true });
      const value = await settle(request);
      if (value !== null) done(value);
      patchState(store, { writing: false });
      return value;
    }

    const keep = (group: FriendGroup): void => {
      store.put(group);
    };

    return {
      /** A quiet call does not show an error as a toast. */
      load(all = false, quiet = false): void {
        fetch({ all, quiet });
      },
      create(name: string): Promise<FriendGroup | null> {
        return write(store._api.create(name), keep);
      },
      join(inviteCode: string): Promise<FriendGroup | null> {
        return write(store._api.join(inviteCode), keep);
      },
      rename(id: string, name: string): Promise<FriendGroup | null> {
        return write(store._api.rename(id, name), keep);
      },
      /** True when the service deleted the group. */
      async remove(id: string): Promise<boolean> {
        const done = await write(confirmed(store._api.remove(id)), () => {
          store.drop(id);
        });
        return done === true;
      },
      /** True when the service removed the member. */
      async removeMember(id: string, userId: string): Promise<boolean> {
        const done = await write(confirmed(store._api.removeMember(id, userId)), () => {
          const group = store.one(id);
          if (group !== null) {
            store.put({ ...group, members: group.members.filter((one) => one.userId !== userId) });
          }
        });
        return done === true;
      },
    };
  }),
);

/** The instance type of {@link GroupsStore}. */
export type GroupsStore = InstanceType<typeof GroupsStore>;
