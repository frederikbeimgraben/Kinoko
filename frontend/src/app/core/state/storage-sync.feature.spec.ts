import { EnvironmentInjector, createEnvironmentInjector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { patchState, signalStore, withState } from '@ngrx/signals';
import { unprotected } from '@ngrx/signals/testing';
import { withStorageSync, type StorageSyncConfig } from './storage-sync.feature';

const KEY = 'test.sync';

interface Prefs {
  zoom: number;
  label: string;
  open: boolean;
}

const initial: Prefs = { zoom: 1, label: '', open: false };

const restore = (stored: unknown): Partial<Prefs> | null => {
  if (typeof stored !== 'object' || stored === null) return null;
  const zoom = (stored as { zoom?: unknown }).zoom;
  return typeof zoom === 'number' ? { zoom } : null;
};

function storeWith(config: Partial<StorageSyncConfig<Prefs, unknown>> = {}) {
  return signalStore(
    withState<Prefs>(initial),
    withStorageSync<Prefs>({
      key: KEY,
      select: (state) => (state.zoom < 0 ? null : { zoom: state.zoom }),
      restore,
      ...config,
    }),
  );
}

/** Starts a store in its own injector, so that a test can destroy it. */
function start(config: Partial<StorageSyncConfig<Prefs, unknown>> = {}) {
  const Store = storeWith(config);
  const injector = createEnvironmentInjector([Store], TestBed.inject(EnvironmentInjector));
  const store = injector.get(Store);
  TestBed.tick();
  return { store, writable: unprotected(store), injector };
}

describe('withStorageSync', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('restores a stored value with a good shape', () => {
    localStorage.setItem(KEY, JSON.stringify({ zoom: 7 }));

    expect(start().store.zoom()).toBe(7);
  });

  it('ignores a stored value with a bad shape or bad JSON', () => {
    localStorage.setItem(KEY, JSON.stringify({ zoom: 'big' }));
    expect(start().store.zoom()).toBe(1);

    localStorage.setItem(KEY, '{no json');
    expect(start().store.zoom()).toBe(1);
  });

  it('writes the selected part at once without a debounce time', () => {
    const { writable } = start();

    patchState(writable, { zoom: 3 });
    TestBed.tick();

    expect(localStorage.getItem(KEY)).toBe('{"zoom":3}');
  });

  it('removes the key when the selection is null', () => {
    localStorage.setItem(KEY, JSON.stringify({ zoom: 2 }));
    const { writable } = start();

    patchState(writable, { zoom: -1 });
    TestBed.tick();

    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('does not write a value that is already stored or outside the selection', () => {
    localStorage.setItem(KEY, JSON.stringify({ zoom: 2 }));
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const { writable } = start();

    patchState(writable, { label: 'x' });
    TestBed.tick();

    expect(setItem).not.toHaveBeenCalled();
  });

  it('waits for the debounce time after the last change', () => {
    vi.useFakeTimers();
    const { writable } = start({ debounceMs: 100 });

    patchState(writable, { zoom: 4 });
    TestBed.tick();
    vi.advanceTimersByTime(60);
    patchState(writable, { zoom: 5 });
    TestBed.tick();
    vi.advanceTimersByTime(60);
    expect(localStorage.getItem(KEY)).toBeNull();

    vi.advanceTimersByTime(40);
    expect(localStorage.getItem(KEY)).toBe('{"zoom":5}');
  });

  it('writes a waiting value when the store is destroyed', () => {
    vi.useFakeTimers();
    const { writable, injector } = start({ debounceMs: 1000 });

    patchState(writable, { zoom: 9 });
    TestBed.tick();
    injector.destroy();

    expect(localStorage.getItem(KEY)).toBe('{"zoom":9}');
  });

  it('keeps working when the storage is blocked', () => {
    const { store, writable } = start({
      storage: () => {
        throw new Error('blocked');
      },
    });

    patchState(writable, { zoom: 6 });
    TestBed.tick();

    expect(store.zoom()).toBe(6);
  });

  it('keeps working when a write fails', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('full');
    });
    const { store, writable } = start({ storage: () => sessionStorage });

    patchState(writable, { zoom: 8 });
    TestBed.tick();

    expect(store.zoom()).toBe(8);
  });
});
