/** Die Objekte, die ohne Netz entstehen dürfen. */
export const SYNC_KINDS = ['find', 'marker', 'zone'] as const;

export type SyncKind = (typeof SYNC_KINDS)[number];

/** Was mit einem Objekt geschehen soll. */
export const SYNC_OPERATIONS = ['create', 'update', 'delete'] as const;

export type SyncOperation = (typeof SYNC_OPERATIONS)[number];

/** Der Weg der API je Art. */
export const SYNC_PATHS: Record<SyncKind, string> = {
  find: '/finds',
  marker: '/markers',
  zone: '/zones',
};

/** Ein Auftrag, der noch beim Server fehlt. Seine Kennung kommt vom Gerät. */
export interface SyncTask<B = unknown> {
  id: string;
  deviceId: string;
  kind: SyncKind;
  operation: SyncOperation;
  target: string;
  body: B;
  photos: Blob[];
  createdAt: string;
  conflict: boolean;
}
