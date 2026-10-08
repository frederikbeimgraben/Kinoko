import { computed, effect, inject } from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withHooks,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';
import type { Permission } from '../api/models';
import { withStorageSync } from '../state';
import { AuthService } from './auth.service';

/** The last known state of the session. It holds no secret. */
export interface SessionMemory {
  name: string;
  permissions: readonly Permission[];
}

/** Three values: open, without account, with account. "Open" is not "without account". */
export type SessionStatus = 'unknown' | 'guest' | 'signedIn';

interface SessionState {
  memory: SessionMemory | null;
}

const KEY = 'pilzkarte.session.v1';

/** Makes a memory from a stored value. Gives `null` for a bad shape. */
export function readMemory(value: unknown): SessionMemory | null {
  if (typeof value !== 'object' || value === null) return null;
  const { name, permissions } = value as Partial<SessionMemory>;
  if (typeof name !== 'string' || name === '' || !Array.isArray(permissions)) return null;
  return { name, permissions: permissions.filter((right): right is Permission => typeof right === 'string') };
}

/** Adds a part to a memory. A memory without a name is no memory. */
export function mergeMemory(known: SessionMemory | null, part: Partial<SessionMemory>): SessionMemory | null {
  const next: SessionMemory = { name: '', permissions: [], ...known, ...part };
  return next.name === '' ? known : next;
}

/** The session for the user interface. The device keeps the name and permissions, but no token. */
export const SessionStore = signalStore(
  { providedIn: 'root' },
  withState<SessionState>({ memory: null }),
  withStorageSync<SessionState, SessionMemory>({
    key: KEY,
    select: (state) => state.memory,
    restore: (stored) => {
      const memory = readMemory(stored);
      return memory === null ? null : { memory };
    },
  }),
  withProps(() => ({ _auth: inject(AuthService) })),
  withComputed(({ _auth, memory }) => {
    const status = computed<SessionStatus>(() => {
      if (_auth.signedIn()) return 'signedIn';
      if (_auth.settled()) return 'guest';
      if (memory() !== null) return 'signedIn';
      return _auth.checked() ? 'guest' : 'unknown';
    });
    return {
      status,
      /** The name for the avatar: from the session or from the device. */
      name: computed<string | null>(() => {
        if (status() !== 'signedIn') return null;
        return _auth.user()?.name ?? memory()?.name ?? null;
      }),
    };
  }),
  withMethods((store) => ({
    keep(part: Partial<SessionMemory>): void {
      patchState(store, (state) => ({ memory: mergeMemory(state.memory, part) }));
    },
    forget(): void {
      patchState(store, { memory: null });
    },
  })),
  withHooks({
    onInit(store) {
      effect(() => {
        const person = store._auth.user();
        if (person !== null) store.keep({ name: person.name });
        else if (store._auth.settled()) store.forget();
      });
    },
  }),
);

/** The instance type of {@link SessionStore}. */
export type SessionStore = InstanceType<typeof SessionStore>;
