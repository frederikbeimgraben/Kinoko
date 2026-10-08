import { computed, signal, type Provider } from '@angular/core';
import { SyncStore } from '../core/offline/sync.store';
import type { SyncKind, SyncOperation, SyncTask } from '../core/offline/sync.types';

/** A queue without IndexedDB. It keeps what it gets. */
export class SyncStub {
  /** False means: the device has no space. */
  accepts = true;
  sent = 0;

  private readonly list = signal<readonly SyncTask[]>([]);

  readonly tasks = this.list.asReadonly();
  readonly online = signal(true);
  readonly pendingCount = computed(() => this.list().length);
  readonly pendingTargets = computed(() => new Set(this.list().map((task) => task.target)));

  get stored(): readonly SyncTask[] {
    return this.list();
  }

  enqueue(
    kind: SyncKind,
    operation: SyncOperation,
    body: unknown,
    photos: readonly Blob[] = [],
    target = 'target',
  ): Promise<SyncTask | null> {
    if (!this.accepts) return Promise.resolve(null);
    const task: SyncTask = {
      id: `task-${String(this.list().length + 1)}`,
      kind,
      operation,
      target,
      body,
      photos: [...photos],
      createdAt: new Date().toISOString(),
      conflict: false,
    };
    this.list.update((all) => [...all, task]);
    return Promise.resolve(task);
  }

  read(): Promise<readonly SyncTask[]> {
    return Promise.resolve(this.list());
  }

  flush(): Promise<number> {
    return Promise.resolve(this.sent);
  }

  start(): Promise<void> {
    return Promise.resolve();
  }
}

export function syncStubProviders(stub: SyncStub): Provider[] {
  return [{ provide: SyncStore, useValue: stub }];
}
