import { inject } from '@angular/core';
import { tapResponse } from '@ngrx/operators';
import { patchState, signalStore, withMethods, withProps, withState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { concatMap, exhaustMap, filter, pipe, type Observable } from 'rxjs';
import { GlossaryState } from '../../core/access/glossary.state';
import { GroupsState } from '../../core/access/groups.state';
import type { GlossaryEntryWrite } from '../../core/api/models';
import { finish, type AfterWrite } from './write';

interface AdminSharedState {
  /** True while a write runs. A second tap then has no effect. */
  saving: boolean;
}

/** A new glossary entry, or a change of the entry `id`. */
export interface GlossaryWrite extends AfterWrite {
  readonly id: string | null;
  readonly write: GlossaryEntryWrite;
}

/** A new name for the group `id`. */
export interface GroupRename extends AfterWrite {
  readonly id: string;
  readonly name: string;
}

/** Removes the member `userId` from the group `id`. */
export interface MemberDrop {
  readonly id: string;
  readonly userId: string;
}

/** A request that deletes one item. */
export interface ItemDrop extends AfterWrite {
  readonly id: string;
}

/** The admin writes to the glossary and to the groups.
 * The lists stay in the shared states, so the account pages show each change too. */
export const AdminSharedStore = signalStore(
  { providedIn: 'root' },
  withState<AdminSharedState>({ saving: false }),
  withProps(() => ({ _glossary: inject(GlossaryState), _groups: inject(GroupsState) })),
  withMethods((store) => {
    const written = <T>(call: Observable<T>, request: AfterWrite): Observable<T> => {
      patchState(store, { saving: true });
      return call.pipe(
        tapResponse({
          next: () => {
            patchState(store, { saving: false });
            finish(request);
          },
          error: () => {
            patchState(store, { saving: false });
          },
        }),
      );
    };

    return {
      saveEntry: rxMethod<GlossaryWrite>(
        pipe(
          filter(() => !store.saving()),
          exhaustMap((request) =>
            written(
              request.id === null
                ? store._glossary.create(request.write)
                : store._glossary.update(request.id, request.write),
              request,
            ),
          ),
        ),
      ),

      removeEntry: rxMethod<ItemDrop>(
        pipe(exhaustMap((request) => written(store._glossary.remove(request.id), request))),
      ),

      renameGroup: rxMethod<GroupRename>(
        pipe(
          filter(() => !store.saving()),
          exhaustMap((request) => written(store._groups.rename(request.id, request.name), request)),
        ),
      ),

      removeGroup: rxMethod<ItemDrop>(
        pipe(exhaustMap((request) => written(store._groups.remove(request.id), request))),
      ),

      removeMember: rxMethod<MemberDrop>(
        pipe(
          concatMap((request) =>
            store._groups
              .removeMember(request.id, request.userId)
              .pipe(tapResponse({ next: () => undefined, error: () => undefined })),
          ),
        ),
      ),
    };
  }),
);

/** The instance type of {@link AdminSharedStore}. */
export type AdminSharedStore = InstanceType<typeof AdminSharedStore>;
