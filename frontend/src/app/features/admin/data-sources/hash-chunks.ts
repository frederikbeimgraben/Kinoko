import { HASH_CHUNK, type HashReply } from './hash-messages';
import { Sha256 } from './sha256';

/** Reads the file in parts and hashes each part. The digest comes as the last message. */
export async function* hashChunks(file: Blob, chunk = HASH_CHUNK): AsyncGenerator<HashReply> {
  const hash = new Sha256();
  for (let at = 0; at < file.size; at += chunk) {
    const part = await file.slice(at, Math.min(at + chunk, file.size)).arrayBuffer();
    hash.update(new Uint8Array(part));
    yield { done: Math.min(at + chunk, file.size) };
  }
  yield { hex: hash.hex() };
}
