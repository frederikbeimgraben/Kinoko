import { hashChunks } from './hash-chunks';
import type { HashJob, HashReply } from './hash-messages';

// In a worker, `self` is the global scope. The DOM types know only the window form, so this narrow view is enough.
interface WorkerScope {
  postMessage(reply: HashReply): void;
  addEventListener(kind: 'message', handler: (event: MessageEvent<HashJob>) => void): void;
}

const scope = self as unknown as WorkerScope;

scope.addEventListener('message', (event) => {
  void (async () => {
    try {
      for await (const reply of hashChunks(event.data.file, event.data.chunk)) scope.postMessage(reply);
    } catch {
      scope.postMessage({ error: 'read_failed' });
    }
  })();
});
