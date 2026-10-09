import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withProps, withState } from '@ngrx/signals';
import { catchError, defer, firstValueFrom, of, shareReplay } from 'rxjs';
import { ApiClient } from '../api/api-client';
import type { components } from '../api/contract';
import { setFailed, setLoaded, setLoading, withLoadState } from '../state';

/** What the backend tells about itself and the sign-in. `GET /api/config`. */
export type AppConfig = components['schemas']['Config'];

interface ConfigState {
  /** The configuration, or `null`. The map and the species work without the backend. */
  configuration: AppConfig | null;
}

/** The host name of an issuer URL, as the backend gives it. An issuer that is not a URL shows as it came. */
export function issuerHost(issuer: string): string {
  try {
    return new URL(issuer).hostname;
  } catch {
    return issuer;
  }
}

/** The configuration of the backend. The read goes through `ApiClient`, so a failure shows a toast. */
export const ConfigStore = signalStore(
  { providedIn: 'root' },
  withState<ConfigState>({ configuration: null }),
  withLoadState(),
  withComputed(({ status, configuration }) => ({
    /** True when the read has an answer or failed. */
    settled: computed(() => status() === 'loaded' || status() === 'error'),
    /** The name of the SSO for the sign-in button. An older backend sends no name, so the host is the fallback. */
    providerName: computed(() => {
      const config = configuration();
      if (config === null) return '';
      return config.oidcName || issuerHost(config.oidcIssuer);
    }),
    /** True when the backend answered without an SSO. Then nobody can sign in. */
    ssoMissing: computed(() => status() === 'loaded' && (configuration()?.oidcIssuer ?? '') === ''),
  })),
  withProps(() => {
    const api = inject(ApiClient);
    // A shared observable reads one time for all callers and adds no pending task.
    // `shareReplay` forgets a failure, so the next `load` reads again.
    return { _read$: defer(() => api.get<AppConfig>('/config')).pipe(shareReplay(1)) };
  }),
  withMethods((store) => ({
    /** Reads the configuration. All callers share one read; after a failure the next call reads again. */
    async load(): Promise<void> {
      if (store.status() === 'loaded') return;
      patchState(store, setLoading());
      const configuration = await firstValueFrom(store._read$.pipe(catchError(() => of(null))));
      patchState(store, { configuration }, configuration === null ? setFailed() : setLoaded());
    },
  })),
);

/** The instance type of {@link ConfigStore}. */
export type ConfigStore = InstanceType<typeof ConfigStore>;
