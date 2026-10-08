import { computed, effect } from '@angular/core';
import { getState, patchState, signalStoreFeature, type, withHooks } from '@ngrx/signals';

/** How `withStorageSync` saves a part of the state and reads it back. */
export interface StorageSyncConfig<State extends object, Saved> {
  /** The key in the storage. */
  key: string;
  /** Selects the part of the state to save. The value `null` removes the key. */
  select: (state: State) => Saved | null;
  /** Makes a state patch from the stored value. Return `null` for a value with a wrong shape. */
  restore: (stored: unknown) => Partial<State> | null;
  /** The time in ms between the last change and the write. Default: 0, which writes at once. */
  debounceMs?: number;
  /** The storage to use. Default: `localStorage`. */
  storage?: () => Storage;
}

const defaultStorage = (): Storage => localStorage;

/** Reads the saved state when the store starts and writes each change back. */
export function withStorageSync<State extends object, Saved = unknown>(
  config: StorageSyncConfig<State, Saved>,
) {
  const debounceMs = config.debounceMs ?? 0;
  const storage = (): Storage | null => {
    try {
      return (config.storage ?? defaultStorage)();
    } catch {
      return null;
    }
  };

  return signalStoreFeature(
    { state: type<State>() },
    withHooks((store) => {
      let timer: ReturnType<typeof setTimeout> | null = null;
      // `undefined` means that no write waits. `null` means that a removal waits.
      let pending: string | null | undefined = undefined;
      let written: string | null = null;

      const write = (value: string | null): void => {
        try {
          if (value === null) storage()?.removeItem(config.key);
          else storage()?.setItem(config.key, value);
          written = value;
        } catch {
          // A full or blocked storage keeps the state for this session only.
        }
      };

      const flush = (): void => {
        if (timer !== null) clearTimeout(timer);
        timer = null;
        if (pending !== undefined && pending !== written) write(pending);
        pending = undefined;
      };

      const read = (): Partial<State> | null => {
        try {
          const raw = storage()?.getItem(config.key) ?? null;
          written = raw;
          return raw === null ? null : config.restore(JSON.parse(raw));
        } catch {
          return null;
        }
      };

      return {
        onInit() {
          const patch = read();
          if (patch !== null) patchState(store, patch);

          // A string compares by value, so a change outside the selected part writes nothing.
          const serialized = computed(() => {
            const saved = config.select(getState(store));
            return saved === null ? null : JSON.stringify(saved);
          });
          effect(() => {
            pending = serialized();
            if (debounceMs <= 0) {
              flush();
              return;
            }
            if (timer !== null) clearTimeout(timer);
            timer = setTimeout(flush, debounceMs);
          });
        },
        onDestroy() {
          flush();
        },
      };
    }),
  );
}
