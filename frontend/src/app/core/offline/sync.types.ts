import type { EntryKind } from '../api/entry-paths';

/** The objects that the user can make without network. */
export type SyncKind = EntryKind;

export type SyncOperation = 'create' | 'update' | 'delete';

/** A pending task. The device makes `target`, so `PUT` is idempotent. */
export interface SyncTask<B = unknown> {
  id: string;
  kind: SyncKind;
  operation: SyncOperation;
  target: string;
  body: B;
  photos: Blob[];
  createdAt: string;
  conflict: boolean;
}
