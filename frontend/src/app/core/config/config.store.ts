import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withProps, withState } from '@ngrx/signals';
import { catchError, defer, firstValueFrom, map, of, shareReplay } from 'rxjs';
import { ApiClient } from '../api/api-client';
import { setFailed, setLoaded, setLoading, withLoadState } from '../state';

/** What the backend tells about itself and the sign-in. `GET /api/config`. */
export interface AppConfig {
  oidcIssuer: string;
  oidcClientId: string;
  origin: string;
  version: string;
}

interface ConfigState {
  /** The configuration, or `null`. The map and the species work without the backend. */
  configuration: AppConfig | null;
}

/** The configuration of the backend. The read goes through `ApiClient`, so a failure shows a toast. */
export const ConfigStore = signalStore(
  { providedIn: 'root' },
  withState<ConfigState>({ configuration: null }),
  withLoadState(),
  withComputed(({ status }) => ({
    /** True when the read has an answer or failed. */
    settled: computed(() => status() === 'loaded' || status() === 'error'),
  })),
  withProps(() => {
    const api = inject(ApiClient);
    // A resource adds a pending task, so the app is not stable while the read waits.
    // A shared observable reads one time for all callers and adds no pending task.
    return {
      _read$: defer(() => api.get<AppConfig>('/config')).pipe(
        map((configuration): AppConfig | null => configuration),
        catchError(() => of(null)),
        shareReplay(1),
      ),
    };
  }),
  withMethods((store) => ({
    /** Reads the configuration one time. All callers share the same read. */
    async load(): Promise<void> {
      if (store.status() === 'idle') patchState(store, setLoading());
      const configuration = await firstValueFrom(store._read$);
      patchState(store, { configuration }, configuration === null ? setFailed() : setLoaded());
    },
  })),
);

/** The instance type of {@link ConfigStore}. */
export type ConfigStore = InstanceType<typeof ConfigStore>;
