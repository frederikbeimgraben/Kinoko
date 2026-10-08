import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { hashChunks } from './hash-chunks';
import { HASH_CHUNK, type HashJob, type HashReply } from './hash-messages';

/** Hashes a file. The stream sends the progress and ends with the digest. */
export type FileHasher = (file: Blob) => Observable<HashReply>;

/** Hashes on the main thread. A browser without workers and the tests use it. */
export function hashInPage(file: Blob): Observable<HashReply> {
  return new Observable<HashReply>((subscriber) => {
    void (async () => {
      try {
        for await (const reply of hashChunks(file)) {
          if (subscriber.closed) return;
          subscriber.next(reply);
        }
        subscriber.complete();
      } catch {
        subscriber.next({ error: 'read_failed' });
        subscriber.complete();
      }
    })();
  });
}

/** Hashes in a Web Worker, so a file of many gigabytes does not block the page. */
export function hashInWorker(file: Blob): Observable<HashReply> {
  return new Observable<HashReply>((subscriber) => {
    const worker = new Worker(new URL('./sha256.worker', import.meta.url), { type: 'module' });
    worker.addEventListener('message', (event: MessageEvent<HashReply>) => {
      subscriber.next(event.data);
      if (!('done' in event.data)) subscriber.complete();
    });
    worker.addEventListener('error', () => {
      subscriber.next({ error: 'worker_failed' });
      subscriber.complete();
    });
    const job: HashJob = { file, chunk: HASH_CHUNK };
    worker.postMessage(job);
    return () => {
      worker.terminate();
    };
  });
}

/** The hasher of the upload. Tests give their own. */
export const FILE_HASHER = new InjectionToken<FileHasher>('FILE_HASHER', {
  providedIn: 'root',
  factory: () => (typeof Worker === 'undefined' ? hashInPage : hashInWorker),
});
