import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiClient } from '../api/api-client';
import { AuthService } from '../auth';
import { OfflineStore } from './offline-store';
import { SYNC_PATHS, type SyncKind, type SyncOperation, type SyncTask } from './sync.types';

/** Der Server hat das Objekt schon anders. Seine Fassung gilt. */
const CONFLICT = [409, 412];

const PHOTO_LICENCE = 'own';

/**
 * Die Warteschlange der eigenen Objekte und ihr Abgleich bei Netz.
 */
@Injectable({ providedIn: 'root' })
export class SyncService {
  private readonly api = inject(ApiClient);
  private readonly auth = inject(AuthService);
  private readonly store = inject(OfflineStore);

  private readonly _tasks = signal<readonly SyncTask[]>([]);
  private readonly _online = signal(navigator.onLine);
  private running: Promise<number> | null = null;

  /** Was noch beim Server fehlt, älteste zuerst. */
  readonly tasks = this._tasks.asReadonly();
  readonly online = this._online.asReadonly();
  readonly pendingCount = computed(() => this._tasks().length);

  /** Die Kennungen der Objekte, die eine ausstehende Änderung tragen. */
  readonly pendingTargets = computed(() => new Set(this._tasks().map((task) => task.target)));

  constructor() {
    addEventListener('online', () => {
      this._online.set(true);
      void this.flush();
    });
    addEventListener('offline', () => {
      this._online.set(false);
    });
  }

  /** Liest die Warteschlange und sendet, was schon gehen kann. */
  async start(): Promise<void> {
    await this.read();
    await this.flush();
  }

  /** Nimmt einen Auftrag an. `null` heißt: das Gerät hat keinen Platz. */
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
    if (!(await this.store.put('queue', task.id, task))) return null;
    await this.read();
    return task;
  }

  async read(): Promise<readonly SyncTask[]> {
    const all = [...(await this.store.all<SyncTask>('queue'))];
    all.sort((left, right) => left.createdAt.localeCompare(right.createdAt));
    this._tasks.set(all);
    return all;
  }

  async remove(id: string): Promise<void> {
    await this.store.remove('queue', id);
    await this.read();
  }

  /** Sendet die Warteschlange und gibt zurück, wie viel angekommen ist. */
  flush(): Promise<number> {
    this.running ??= this.run().finally(() => {
      this.running = null;
    });
    return this.running;
  }

  private async run(): Promise<number> {
    if (!this._online() || !this.auth.signedIn()) return 0;
    let sent = 0;
    for (const task of await this.read()) {
      const done = await this.send(task);
      if (done === 'stop') break;
      if (done === 'sent') {
        await this.store.remove('queue', task.id);
        sent += 1;
      }
    }
    await this.read();
    return sent;
  }

  private async send(task: SyncTask): Promise<'sent' | 'kept' | 'stop'> {
    if (task.kind === 'photo') return this.sendPhoto(task);
    try {
      await firstValueFrom(this.request(task));
    } catch (failure) {
      const status = (failure as { status?: number }).status ?? 0;
      if (!CONFLICT.includes(status)) return 'stop';
      await this.markConflict(task);
      return 'kept';
    }
    return this.attachPhotos(task);
  }

  private request(task: SyncTask): ReturnType<ApiClient['put']> {
    const path = `${SYNC_PATHS[task.kind]}/${encodeURIComponent(task.target)}`;
    if (task.operation === 'delete') return this.api.delete(path, undefined, { quiet: true });
    return this.api.put(path, task.body, { quiet: true });
  }

  /** Der Server gewinnt. Der Auftrag bleibt ausstehend sichtbar. */
  private async markConflict(task: SyncTask): Promise<void> {
    await this.store.put('queue', task.id, { ...task, conflict: true });
  }

  /** Ein gesendetes Foto fällt aus dem Auftrag, damit es nicht doppelt geht. */
  private async attachPhotos(task: SyncTask): Promise<'sent' | 'stop'> {
    if (task.kind !== 'find' || task.operation === 'delete') return 'sent';
    let left = task.photos;
    while (left.length > 0) {
      try {
        await firstValueFrom(this.upload(task.target, left[0], task.photos.length - left.length));
      } catch {
        await this.store.put('queue', task.id, { ...task, photos: left });
        return 'stop';
      }
      left = left.slice(1);
    }
    return 'sent';
  }

  /** Eine Einreichung geht als Formular hinaus, nicht als `PUT` auf ein Objekt. */
  private async sendPhoto(task: SyncTask): Promise<'sent' | 'stop'> {
    const [blob] = task.photos;
    if (task.photos.length === 0) return 'sent';
    const file = new File([blob], `${task.target}.jpg`, { type: blob.type || 'image/jpeg' });
    const fields = task.body as Record<string, string | undefined>;
    try {
      await firstValueFrom(this.api.postFile(SYNC_PATHS.photo, 'file', file, fields, { quiet: true }));
    } catch {
      return 'stop';
    }
    return 'sent';
  }

  private upload(findId: string, blob: Blob, index: number): ReturnType<ApiClient['postFile']> {
    const file = new File([blob], `photo-${String(index + 1)}.jpg`, { type: blob.type || 'image/jpeg' });
    const fields = { findId, photographer: this.auth.user()?.name ?? '', licence: PHOTO_LICENCE };
    return this.api.postFile('/photos', 'file', file, fields, { quiet: true });
  }
}
