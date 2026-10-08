import { computed, inject } from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withHooks,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { EMPTY, catchError, map, of, pipe, switchMap, tap } from 'rxjs';
import { AccessApi } from '../api/access.api';
import type { Permission } from '../api/models';
import { AuthService, SessionStore } from '../auth';

interface PermissionsState {
  /** `null` while the answer waits. The user interface then shows nothing. */
  permissions: readonly Permission[] | null;
}

/** The step of the session that controls the permissions. */
type Phase = 'signedIn' | 'signedOut' | 'open';

/** The own permissions from `/api/me/permissions`. They only hide items: each server route checks itself. */
export const PermissionsStore = signalStore(
  { providedIn: 'root' },
  withState<PermissionsState>({ permissions: null }),
  withProps(() => ({
    _api: inject(AccessApi),
    _auth: inject(AuthService),
    _session: inject(SessionStore),
  })),
  withComputed(({ permissions, _session }) => ({
    /** True when the permissions are known. The state from the device counts. */
    settled: computed(() => permissions() !== null || _session.status() === 'guest'),
  })),
  withMethods((store) => ({
    can(permission: Permission): boolean {
      return store.permissions()?.includes(permission) ?? false;
    },

    /** True when the person has one of the permissions, for example to see the admin area. */
    canAny(permissions: readonly Permission[]): boolean {
      const held = store.permissions() ?? [];
      return permissions.some((permission) => held.includes(permission));
    },

    _follow: rxMethod<Phase>(
      pipe(
        switchMap((phase) => {
          // Without a sign-in the endpoint gives 401. The sign-out removes the permissions,
          // so that the admin area does not stay visible.
          if (phase === 'open') return EMPTY;
          if (phase === 'signedOut') return of(null);
          return store._api.mine().pipe(
            map((answer) => answer.permissions),
            tap((permissions) => {
              store._session.keep({ permissions });
            }),
            // A failure gives no permissions: a missing item is better than a button that gets 403.
            // The toast of the ApiClient tells the person.
            catchError(() => of(store.permissions() ?? [])),
          );
        }),
        tap((permissions) => {
          patchState(store, { permissions });
        }),
      ),
    ),
  })),
  withHooks({
    onInit(store) {
      patchState(store, { permissions: store._session.memory()?.permissions ?? null });
      store._follow(
        computed<Phase>(() => {
          if (store._auth.signedIn()) return 'signedIn';
          return store._auth.checked() ? 'signedOut' : 'open';
        }),
      );
    },
  }),
);

/** The instance type of {@link PermissionsStore}. */
export type PermissionsStore = InstanceType<typeof PermissionsStore>;
