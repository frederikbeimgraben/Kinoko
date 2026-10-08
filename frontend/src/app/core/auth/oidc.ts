import { InjectionToken } from '@angular/core';
import type { UserManager, UserManagerSettings } from 'oidc-client-ts';

/** Gives the service a `UserManager`. */
export type UserManagerFactory = (settings: UserManagerSettings) => Promise<UserManager>;

/**
 * Loads `oidc-client-ts` with a dynamic import, so the map start does not load it. `userStore` keeps the tokens in memory, so no token survives a reload. A silent renewal restores the session. `stateStore` keeps the PKCE verifier in `sessionStorage`. It survives the redirect and ends with the tab.
 */
export const USER_MANAGER_FACTORY = new InjectionToken<UserManagerFactory>('USER_MANAGER_FABRIK', {
  providedIn: 'root',
  factory:
    (): UserManagerFactory =>
    async (settings): Promise<UserManager> => {
      const { InMemoryWebStorage, UserManager, WebStorageStateStore } = await import('oidc-client-ts');
      return new UserManager({
        ...settings,
        userStore: new WebStorageStateStore({ store: new InMemoryWebStorage() }),
        stateStore: new WebStorageStateStore({ store: sessionStorage }),
      });
    },
});
