import { InjectionToken } from '@angular/core';
import type { UserManager, UserManagerSettings } from 'oidc-client-ts';

/** Gives the service a `UserManager`. */
export type UserManagerFactory = (settings: UserManagerSettings) => Promise<UserManager>;

/**
 * Loads `oidc-client-ts` with a dynamic import, so the map start does not load it.
 */
export const USER_MANAGER_FACTORY = new InjectionToken<UserManagerFactory>('USER_MANAGER_FABRIK', {
  providedIn: 'root',
  factory:
    (): UserManagerFactory =>
    async (settings): Promise<UserManager> => {
      const { InMemoryWebStorage, UserManager, WebStorageStateStore } = await import('oidc-client-ts');
      return new UserManager({
        ...settings,
        // Tokens stay in memory, so no token survives a reload.
        // After a reload, a silent renewal restores the session.
        userStore: new WebStorageStateStore({ store: new InMemoryWebStorage() }),
        // The PKCE verifier must survive the redirect, but it is no token.
        // `sessionStorage` ends with the tab.
        stateStore: new WebStorageStateStore({ store: sessionStorage }),
      });
    },
});
