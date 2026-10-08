import { TestBed } from '@angular/core/testing';
import { patchState, signalStore } from '@ngrx/signals';
import { unprotected } from '@ngrx/signals/testing';
import { setFailed, setLoaded, setLoading, withLoadState } from './load-state.feature';

const Store = signalStore({ providedIn: 'root' }, withLoadState());

describe('withLoadState', () => {
  it('starts idle with all flags off', () => {
    const store = TestBed.inject(Store);

    expect(store.status()).toBe('idle');
    expect([store.loading(), store.loaded(), store.failed()]).toEqual([false, false, false]);
  });

  it('follows the updaters', () => {
    const store = TestBed.inject(Store);

    patchState(unprotected(store), setLoading());
    expect(store.loading()).toBe(true);

    patchState(unprotected(store), setLoaded());
    expect([store.loading(), store.loaded()]).toEqual([false, true]);

    patchState(unprotected(store), setFailed());
    expect([store.loaded(), store.failed()]).toEqual([false, true]);
  });
});
