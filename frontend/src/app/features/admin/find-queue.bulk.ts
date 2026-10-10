import { catchError, filter, from, map, mergeMap, type Observable, of, toArray } from 'rxjs';
import type { FindsApi } from '../../core/api/finds.api';
import type { OpenFind } from '../../core/api/models';

/** The number of decisions that "accept all" sends at the same time. */
const BULK_PARALLEL = 4;

/** The result of "accept all": the number of finds that the server accepted and that stay open. */
export interface BulkResult {
  readonly accepted: number;
  readonly failed: number;
}

/** A request to accept all open finds. `onDone` gets the result. */
export interface BulkAccept {
  readonly onDone?: (result: BulkResult) => void;
}

/** Accepts each find with its own request. Gives the ids that the server accepted, once all requests end.
 * A failed request shows no toast: the caller reports the result once. */
export function acceptEach(api: FindsApi, ids: readonly string[]): Observable<ReadonlySet<string>> {
  return from(ids).pipe(
    mergeMap(
      (id) =>
        api.review(id, 'accepted', { quiet: true }).pipe(
          map(() => id),
          catchError(() => of(null)),
        ),
      BULK_PARALLEL,
    ),
    filter((id): id is string => id !== null),
    toArray(),
    map((accepted) => new Set(accepted)),
  );
}

/** Removes the accepted finds from the open cards. Cards with a decision and failed finds stay. */
export function withoutAccepted(
  stack: readonly OpenFind[] | null,
  decided: number,
  accepted: ReadonlySet<string>,
): readonly OpenFind[] | null {
  return stack?.filter((one, index) => index < decided || !accepted.has(one.id)) ?? null;
}
