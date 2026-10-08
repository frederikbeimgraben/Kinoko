import { computed, inject } from '@angular/core';
import { rxResource, toObservable } from '@angular/core/rxjs-interop';
import { signalStore, withComputed, withMethods, withProps } from '@ngrx/signals';
import { filter, firstValueFrom } from 'rxjs';
import { ApiClient } from '../api/api-client';

/** What the backend tells about itself and the sign-in. `GET /api/config`. */
export interface AppConfig {
  oidcIssuer: string;
  oidcClientId: string;
  origin: string;
  version: string;
}

/** The configuration of the backend. The read goes through `ApiClient`, so a failure shows a toast. */
export const ConfigStore = signalStore(
  { providedIn: 'root' },
  withProps(() => {
    const api = inject(ApiClient);
    return { _resource: rxResource({ stream: () => api.get<AppConfig>('/config') }) };
  }),
  withComputed(({ _resource }) => ({
    /** The configuration, or `null`. The map and the species work without the backend. */
    configuration: computed<AppConfig | null>(() => (_resource.hasValue() ? _resource.value() : null)),
    /** True when the read has an answer or failed. */
    settled: computed(() => {
      const status = _resource.status();
      return status === 'resolved' || status === 'error' || status === 'local';
    }),
  })),
  withProps(({ settled }) => ({
    _settled$: toObservable(settled).pipe(filter(Boolean)),
  })),
  withMethods((store) => ({
    /** Resolves when the read has an answer or failed. All callers share the same read. */
    async load(): Promise<void> {
      await firstValueFrom(store._settled$);
    },
  })),
);

/** The instance type of {@link ConfigStore}. */
export type ConfigStore = InstanceType<typeof ConfigStore>;
