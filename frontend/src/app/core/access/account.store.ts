import { inject } from '@angular/core';
import { patchState, signalStore, withHooks, withMethods, withProps, withState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { catchError, map, of, pipe, switchMap, tap } from 'rxjs';
import { AccessApi } from '../api/access.api';
import { AuthService } from '../auth';

interface AccountState {
  /** The identifier of the own account, `null` without a sign-in. */
  userId: string | null;
}

/** The identifier of the own account, to compare with `ownerId`. */
export const AccountStore = signalStore(
  { providedIn: 'root' },
  withState<AccountState>({ userId: null }),
  withProps(() => ({ _api: inject(AccessApi), _auth: inject(AuthService) })),
  withMethods((store) => ({
    /** True when the person who is signed in owns the account `ownerId`. */
    owns(ownerId: string | null): boolean {
      return ownerId !== null && ownerId === store.userId();
    },

    _follow: rxMethod<boolean>(
      pipe(
        switchMap((signedIn) =>
          signedIn
            ? store._api.me({ quiet: true }).pipe(
                map((me): string | null => me.id),
                catchError(() => of(null)),
              )
            : of(null),
        ),
        tap((userId) => {
          patchState(store, { userId });
        }),
      ),
    ),
  })),
  withHooks({
    onInit(store) {
      store._follow(store._auth.signedIn);
    },
  }),
);

/** The instance type of {@link AccountStore}. */
export type AccountStore = InstanceType<typeof AccountStore>;
