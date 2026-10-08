/** The step after a successful write, for example to close a sheet or to leave the page. */
export interface AfterWrite {
  readonly onDone?: () => void;
}

/** Calls the step after a write, if the caller gave one. */
export function finish(request: AfterWrite): void {
  request.onDone?.();
}

/** Wraps an `rxMethod` that needs no value, so that a caller calls it without an argument. */
export function trigger(method: (value: true) => unknown): () => void {
  return () => {
    method(true);
  };
}
