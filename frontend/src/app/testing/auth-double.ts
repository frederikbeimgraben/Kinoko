import { computed, signal, type Provider } from '@angular/core';
import type { User, UserManager, UserManagerSettings } from 'oidc-client-ts';
import { USER_MANAGER_FACTORY } from '../core/auth';
import { ConfigStore, issuerHost, type AppConfig } from '../core/config/config.store';

/** The answer of `GET /api/config` in the tests. The values come from `docs/sso-authentik.md`. */
export const CONFIG: AppConfig = {
  oidcIssuer: 'https://sso.example.org/application/o/pilze/',
  oidcName: 'Example SSO',
  oidcClientId: 'pilze',
  origin: 'http://localhost:4200',
  version: '2026-09-09',
};

/** The fields of a user that the tests use. */
export interface UserValues {
  token?: string;
  sub?: string;
  name?: string | undefined;
  username?: string;
  email?: string | undefined;
  abgelaufen?: boolean;
  state?: unknown;
}

/** A user as oidc-client-ts gives it. A fixed `expired` lets a test expire a session without a clock. */
export function oidcUser(values: UserValues = {}): User {
  return {
    access_token: values.token ?? 'token-eins',
    expired: values.abgelaufen ?? false,
    state: values.state,
    profile: {
      sub: values.sub ?? 'sub-eins',
      name: 'name' in values ? values.name : 'Frederik',
      preferred_username: values.username,
      email: 'email' in values ? values.email : 'frederik@beimgraben.net',
    },
  } as unknown as User;
}

/** A `UserManager` without a network. The test sets its answers and reads its redirects. */
export class ManagerDouble {
  /** The settings with which the service made the manager. */
  settings: UserManagerSettings | null = null;
  /** The answer to `signinSilent`. The double throws an error value. */
  still: User | Error | null = null;
  /** The answer to `signinRedirectCallback`. */
  returnValue: User | Error = new Error('No callback is ready.');
  /** The error that `signinRedirect` throws instead of a redirect. */
  redirectError: Error | null = null;
  /** The state of each redirect, in the sequence of the calls. */
  readonly redirects: unknown[] = [];
  removed = 0;
  silentAttempts = 0;

  private readonly loaded: ((user: User) => void)[] = [];
  private readonly unloaded: (() => void)[] = [];
  private readonly renewErrors: (() => void)[] = [];
  private readonly expired: (() => void)[] = [];

  readonly events = {
    addUserLoaded: (callback: (user: User) => void): (() => void) => {
      this.loaded.push(callback);
      return () => undefined;
    },
    addUserUnloaded: (callback: () => void): (() => void) => {
      this.unloaded.push(callback);
      return () => undefined;
    },
    addSilentRenewError: (callback: () => void): (() => void) => {
      this.renewErrors.push(callback);
      return () => undefined;
    },
    addAccessTokenExpired: (callback: () => void): (() => void) => {
      this.expired.push(callback);
      return () => undefined;
    },
  };

  signinRedirect(args?: { state?: unknown }): Promise<void> {
    if (this.redirectError !== null) return Promise.reject(this.redirectError);
    this.redirects.push(args?.state);
    return Promise.resolve();
  }

  signinRedirectCallback(): Promise<User> {
    return this.returnValue instanceof Error
      ? Promise.reject(this.returnValue)
      : Promise.resolve(this.returnValue);
  }

  signinSilent(): Promise<User | null> {
    this.silentAttempts += 1;
    return this.still instanceof Error ? Promise.reject(this.still) : Promise.resolve(this.still);
  }

  removeUser(): Promise<void> {
    this.removed += 1;
    return Promise.resolve();
  }

  /** The event that the real manager sends after a renewal. */
  emitLoaded(user: User): void {
    for (const callback of this.loaded) callback(user);
  }

  emitUnloaded(): void {
    for (const callback of this.unloaded) callback();
  }

  /** The event that the real manager sends after a failed renewal. */
  emitRenewError(): void {
    for (const callback of this.renewErrors) callback();
  }

  /** The event that the real manager sends when the token expires. */
  emitExpired(): void {
    for (const callback of this.expired) callback();
  }

  asManager(): UserManager {
    return this as unknown as UserManager;
  }
}

/** The providers for a test with a sign-in. `configuration: null` is a backend that did not answer. */
export function authProvider(manager: ManagerDouble, configuration: AppConfig | null = CONFIG): Provider[] {
  const config = signal(configuration);
  return [
    {
      provide: USER_MANAGER_FACTORY,
      useValue: (settings: UserManagerSettings) => {
        manager.settings = settings;
        return Promise.resolve(manager.asManager());
      },
    },
    {
      provide: ConfigStore,
      useValue: {
        configuration: config,
        settled: signal(true),
        providerName: computed(() => {
          const value = config();
          return value === null ? '' : value.oidcName || issuerHost(value.oidcIssuer);
        }),
        ssoMissing: computed(() => config()?.oidcIssuer === ''),
        load: () => Promise.resolve(),
      },
    },
  ];
}
