/** Die Objekte, die ohne Netz entstehen dürfen. */
export type SyncKind = 'find' | 'marker' | 'zone' | 'photo';

/** Was mit einem Objekt geschehen soll. */
export type SyncOperation = 'create' | 'update' | 'delete';

/** Der Weg der API je Art. */
export const SYNC_PATHS: Record<SyncKind, string> = {
  find: '/finds',
  marker: '/markers',
  zone: '/zones',
  photo: '/photos',
};

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
