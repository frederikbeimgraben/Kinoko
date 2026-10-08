/** A job for the hash worker: the file and the size of each read. */
export interface HashJob {
  readonly file: Blob;
  readonly chunk: number;
}

/** A message of the hash worker: the progress in bytes, or the digest at the end. */
export type HashReply = { readonly done: number } | { readonly hex: string } | { readonly error: string };

/** The size of one read. A smaller read gives more progress messages, a larger read uses more memory. */
export const HASH_CHUNK = 8 * 1024 * 1024;
