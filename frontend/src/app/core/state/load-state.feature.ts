import { computed } from '@angular/core';
import { signalStoreFeature, withComputed, withState } from '@ngrx/signals';

/** The stage of a request: not started, in progress, done or failed. */
export type LoadStatus = 'idle' | 'loading' | 'loaded' | 'error';

/** The state part that `withLoadState` adds to a store. */
export interface LoadState {
  status: LoadStatus;
}

/** Adds `status` and the flags `loading`, `loaded` and `failed`. Use the updaters below with `patchState`. */
export function withLoadState() {
  return signalStoreFeature(
    withState<LoadState>({ status: 'idle' }),
    withComputed(({ status }) => ({
      loading: computed(() => status() === 'loading'),
      loaded: computed(() => status() === 'loaded'),
      failed: computed(() => status() === 'error'),
    })),
  );
}

/** Updater for `patchState`: a request starts. */
export function setLoading(): LoadState {
  return { status: 'loading' };
}

/** Updater for `patchState`: the request is done. */
export function setLoaded(): LoadState {
  return { status: 'loaded' };
}

/** Updater for `patchState`: the request failed. */
export function setFailed(): LoadState {
  return { status: 'error' };
}
