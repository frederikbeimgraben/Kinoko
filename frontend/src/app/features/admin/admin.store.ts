import { inject } from '@angular/core';
import { tapResponse } from '@ngrx/operators';
import { patchState, signalStore, withMethods, withProps, withState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { EMPTY, exhaustMap, filter, pipe, switchMap, tap, type Observable } from 'rxjs';
import { AccessApi } from '../../core/api/access.api';
import type {
  AdminSummary,
  Permission,
  PermissionEntry,
  Person,
  Role,
  RoleInput,
  RolePatch,
} from '../../core/api/models';
import { type AfterWrite, finish, trigger } from './write';

interface AdminState {
  /** `null` while the first response is pending. */
  roles: readonly Role[] | null;
  catalogue: readonly PermissionEntry[] | null;
  people: readonly Person[] | null;
  search: string;
  summary: AdminSummary | null;
  /** True while a write of a role or a person runs. A second tap then has no effect. */
  saving: boolean;
}

/** A new role or a change of a role. */
export type RoleWrite = AfterWrite &
  ({ readonly input: RoleInput } | { readonly id: string; readonly patch: RolePatch });

/** The new roles of a person. The list replaces the old roles. */
export interface PersonRolesWrite extends AfterWrite {
  readonly id: string;
  readonly roles: readonly string[];
}

/** A request that deletes one item. */
export interface DeleteWrite extends AfterWrite {
  readonly id: string;
}

/** Roles, the permission catalogue and the accounts in memory.
 * Several admin pages read the same data, so a change of page does not load the list again. */
export const AdminStore = signalStore(
  { providedIn: 'root' },
  withState<AdminState>({
    roles: null,
    catalogue: null,
    people: null,
    search: '',
    summary: null,
    saving: false,
  }),
  withProps(() => ({ _api: inject(AccessApi) })),
  withMethods((store) => {
    const loadRoles = trigger(
      rxMethod<true>(
        pipe(
          switchMap(() =>
            store._api.roles().pipe(
              tapResponse({
                next: (roles) => {
                  patchState(store, { roles });
                },
                error: () => undefined,
              }),
            ),
          ),
        ),
      ),
    );

    /** A write that ends with a new role list. The person count of each role is in that list. */
    const written = <T>(
      call: Observable<T>,
      request: AfterWrite,
      next: (value: T) => void,
    ): Observable<T> => {
      patchState(store, { saving: true });
      return call.pipe(
        tapResponse({
          next: (value) => {
            patchState(store, { saving: false });
            next(value);
            if (store.roles() !== null) loadRoles();
            finish(request);
          },
          // The service refuses, for example, to remove the last admin. The form stays open.
          error: () => {
            patchState(store, { saving: false });
          },
        }),
      );
    };

    return {
      loadRoles,

      /** Loads the counters as soon as the own permissions are known. */
      followSummary: rxMethod<readonly Permission[] | null>(
        pipe(
          filter((held) => held !== null),
          switchMap(() =>
            store._api.summary().pipe(
              tapResponse({
                next: (summary) => {
                  patchState(store, { summary });
                },
                error: () => undefined,
              }),
            ),
          ),
        ),
      ),

      loadCatalogue: trigger(
        rxMethod<true>(
          pipe(
            filter(() => store.catalogue() === null),
            exhaustMap(() =>
              store._api.catalogue().pipe(
                tapResponse({
                  next: (catalogue) => {
                    patchState(store, { catalogue });
                  },
                  error: () => undefined,
                }),
              ),
            ),
          ),
        ),
      ),

      /** Searches in name and e-mail. An empty text gives all accounts. A new search cancels the old one. */
      loadPeople: rxMethod<string>(
        pipe(
          tap((search) => {
            patchState(store, { search });
          }),
          switchMap((search) =>
            store._api.people(search).pipe(
              tapResponse({
                next: (people) => {
                  patchState(store, { people });
                },
                error: () => undefined,
              }),
            ),
          ),
        ),
      ),

      saveRole: rxMethod<RoleWrite>(
        pipe(
          filter(() => !store.saving()),
          exhaustMap((request) =>
            written(
              'input' in request
                ? store._api.createRole(request.input)
                : store._api.patchRole(request.id, request.patch),
              request,
              () => undefined,
            ),
          ),
        ),
      ),

      deleteRole: rxMethod<DeleteWrite>(
        pipe(exhaustMap((request) => written(store._api.deleteRole(request.id), request, () => undefined))),
      ),

      setRoles: rxMethod<PersonRolesWrite>(
        pipe(
          filter(() => !store.saving()),
          exhaustMap((request) =>
            written(store._api.setRoles(request.id, [...request.roles]), request, (person) => {
              patchState(store, ({ people }) => ({
                people: people?.map((one) => (one.id === person.id ? person : one)) ?? null,
              }));
            }),
          ),
        ),
      ),

      deletePerson: rxMethod<DeleteWrite>(
        pipe(
          exhaustMap((request) =>
            request.id === ''
              ? EMPTY
              : written(store._api.deletePerson(request.id), request, () => {
                  patchState(store, ({ people }) => ({
                    people: people?.filter((one) => one.id !== request.id) ?? null,
                  }));
                }),
          ),
        ),
      ),
    };
  }),
);

/** The instance type of {@link AdminStore}. */
export type AdminStore = InstanceType<typeof AdminStore>;
