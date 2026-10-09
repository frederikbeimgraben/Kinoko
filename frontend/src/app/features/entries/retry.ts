/** The status of an entry that is already gone. A delete takes it as done. */
export const NOT_FOUND = 404;

/** Statuses that can change on a later try. Another 4xx answer stays the same, so the queue never takes it. */
const TRANSIENT = new Set([0, 401, 408, 429]);

/** A failure without an answer or with a fault of the service can pass later. */
export function retryable(failure: unknown): boolean {
  const status = (failure as { status?: unknown } | null)?.status;
  return typeof status !== 'number' || TRANSIENT.has(status) || status >= 500;
}

/** The status of a failure, or 0 without an answer. */
export function statusOf(failure: unknown): number {
  const status = (failure as { status?: unknown } | null)?.status;
  return typeof status === 'number' ? status : 0;
}
