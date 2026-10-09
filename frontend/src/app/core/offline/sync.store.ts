import { DestroyRef, computed, effect, inject, untracked } from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withHooks,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { ApiClient } from '../api/api-client';
import { ENTRY_PATHS } from '../api/entry-paths';
import { PhotosApi } from '../api/photos.api';
import { AuthService } from '../auth';
import { I18nService } from '../i18n/i18n.service';
import { ToastService } from '../../ui/toast/toast.service';
import { OfflineStore } from './offline-store';
import type { SyncKind, SyncOperation, SyncTask } from './sync.types';

/** The service has the object in another version. Its version wins. */
const CONFLICT = [409, 412];

/** What became of one task: sent, kept for later, or a stop of the whole run. */
type Outcome = 'sent' | 'kept' | 'stop';

interface SyncState {
  /** What the service does not have yet, oldest first. */
  tasks: readonly SyncTask[];
  online: boolean;
}

/** The queue of own objects and its transfer when the network is back. */
export const SyncStore = signalStore(
  { providedIn: 'root' },
  withState<SyncState>({ tasks: [], online: navigator.onLine }),
  withProps(() => ({
    _api: inject(ApiClient),
    _photos: inject(PhotosApi),
    _auth: inject(AuthService),
    _offline: inject(OfflineStore),
    _toasts: inject(ToastService),
    _i18n: inject(I18nService),
  })),
  withComputed(({ tasks }) => ({
    pendingCount: computed(() => tasks().length),
    /** The ids of the objects with a pending change. */
    pendingTargets: computed(() => new Set(tasks().map((task) => task.target))),
  })),
  withMethods((store) => {
    // One run at a time: a second `flush` gets the promise of the run that is active.
    let running: Promise<number> | null = null;

    async function read(): Promise<readonly SyncTask[]> {
      const all = [...(await store._offline.all<SyncTask>('queue'))].sort((left, right) =>
        left.createdAt.localeCompare(right.createdAt),
      );
      patchState(store, { tasks: all });
      return all;
    }

    function request(task: SyncTask): ReturnType<ApiClient['put']> {
      const path = `${ENTRY_PATHS[task.kind]}/${encodeURIComponent(task.target)}`;
      if (task.operation === 'delete') return store._api.delete(path, undefined, { quiet: true });
      return store._api.put(path, task.body, { quiet: true });
    }

    function upload(findId: string, blob: Blob, index: number): ReturnType<PhotosApi['ofFind']> {
      const file = new File([blob], `photo-${String(index + 1)}.jpg`, { type: blob.type || 'image/jpeg' });
      return store._photos.ofFind(findId, store._auth.user()?.name ?? '', file, { quiet: true });
    }

    /** A sent photo leaves the task, so that it does not go twice. */
    async function attachPhotos(task: SyncTask): Promise<Outcome> {
      if (task.kind !== 'find' || task.operation === 'delete') return 'sent';
      const failedAt = await task.photos.reduce<Promise<number | null>>(async (failed, blob, index) => {
        const before = await failed;
        if (before !== null) return before;
        try {
          await firstValueFrom(upload(task.target, blob, index));
          return null;
        } catch {
          return index;
        }
      }, Promise.resolve(null));
      if (failedAt === null) return 'sent';
      await store._offline.put('queue', task.id, { ...task, photos: task.photos.slice(failedAt) });
      return 'stop';
    }

    /** A submission goes out as a form, not as a `PUT` on an object. */
    async function sendPhoto(task: SyncTask): Promise<Outcome> {
      if (task.photos.length === 0) return 'sent';
      const [blob] = task.photos;
      const file = new File([blob], `${task.target}.jpg`, { type: blob.type || 'image/jpeg' });
      const fields = task.body as Record<string, string | undefined>;
      try {
        await firstValueFrom(store._api.postFile(ENTRY_PATHS.photo, 'file', file, fields, { quiet: true }));
        return 'sent';
      } catch {
        return 'stop';
      }
    }

    async function send(task: SyncTask): Promise<Outcome> {
      if (task.kind === 'photo') return sendPhoto(task);
      try {
        await firstValueFrom(request(task));
      } catch (failure) {
        const status = (failure as { status?: number }).status ?? 0;
        if (!CONFLICT.includes(status)) return 'stop';
        // The service wins. The task stays visible as pending.
        await store._offline.put('queue', task.id, { ...task, conflict: true });
        return 'kept';
      }
      return attachPhotos(task);
    }

    /** Sends the tasks in order. A stop ends the run; the rest waits for the next one. */
    async function run(): Promise<number> {
      if (!store.online() || !store._auth.signedIn()) return 0;
      const tasks = await read();
      const sent = await tasks.reduce<Promise<{ sent: number; stopped: boolean }>>(
        async (state, task) => {
          const progress = await state;
          if (progress.stopped) return progress;
          const outcome = await send(task);
          if (outcome === 'sent') await store._offline.remove('queue', task.id);
          return { sent: progress.sent + (outcome === 'sent' ? 1 : 0), stopped: outcome === 'stop' };
        },
        Promise.resolve({ sent: 0, stopped: false }),
      );
      await read();
      // The person saw "waits for the transfer" before, so the end of the wait gets a message too.
      if (sent.sent === 0) return 0;
      store._toasts.success(store._i18n.translate('entry.pending.sent', { count: sent.sent }));
      return sent.sent;
    }

    function flush(): Promise<number> {
      running ??= run().finally(() => {
        running = null;
      });
      return running;
    }

    return {
      read,
      flush,

      /** Reads the queue and sends what can go already. */
      async start(): Promise<void> {
        await read();
        await flush();
      },

      /** Takes a task. `null` means: the device has no space. */
      async enqueue(
        kind: SyncKind,
        operation: SyncOperation,
        body: unknown,
        photos: readonly Blob[] = [],
        target: string = crypto.randomUUID(),
      ): Promise<SyncTask | null> {
        const task: SyncTask = {
          id: crypto.randomUUID(),
          kind,
          operation,
          target,
          body,
          photos: [...photos],
          createdAt: new Date().toISOString(),
          conflict: false,
        };
        if (!(await store._offline.put('queue', task.id, task))) return null;
        await read();
        return task;
      },

      async remove(id: string): Promise<void> {
        await store._offline.remove('queue', id);
        await read();
      },

      _setOnline(online: boolean): void {
        patchState(store, { online });
      },
    };
  }),
  withHooks({
    onInit(store) {
      // A queued entry goes out at the sign-in on each page, not only on the map.
      effect(() => {
        if (store._auth.signedIn()) untracked(() => void store.flush());
      });
      const online = (): void => {
        store._setOnline(true);
        void store.flush();
      };
      const offline = (): void => {
        store._setOnline(false);
      };
      // The queue goes out after each sign-in, also after the return from the SSO on any page.
      effect(() => {
        if (store._auth.signedIn()) untracked(() => void store.flush());
      });
      addEventListener('online', online);
      addEventListener('offline', offline);
      inject(DestroyRef).onDestroy(() => {
        removeEventListener('online', online);
        removeEventListener('offline', offline);
      });
    },
  }),
);

/** The instance type of {@link SyncStore}. */
export type SyncStore = InstanceType<typeof SyncStore>;
