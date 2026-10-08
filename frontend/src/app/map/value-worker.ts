/** A separate file, so tests can replace it with a double and not start a real worker. */
export function createWorker(): Worker {
  return new Worker(new URL('./value.worker', import.meta.url), { type: 'module' });
}
