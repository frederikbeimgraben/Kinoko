import type { EntryKind } from '../api/entry-paths';

/** Die Objekte, die ohne Netz entstehen dürfen. */
export type SyncKind = EntryKind;

/** Was mit einem Objekt geschehen soll. */
export type SyncOperation = 'create' | 'update' | 'delete';

/** Ein Auftrag, der fehlt. `target` kommt vom Gerät und macht `PUT` idempotent. */
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
