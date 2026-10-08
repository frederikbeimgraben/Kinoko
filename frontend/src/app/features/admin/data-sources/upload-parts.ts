import {
  EMPTY,
  catchError,
  defer,
  exhaustMap,
  map,
  of,
  retry,
  switchMap,
  takeWhile,
  throwError,
  timer,
  type Observable,
} from 'rxjs';
import { OffsetMismatch, PartFailure, type DataSourcesApi } from '../../../core/api/data-sources.api';
import type { DataSourceKind, DataSourceVersion, UploadSession } from '../../../core/api/models';
import type { ProblemDetail } from '../../../core/api/problem';
import {
  MAX_RETRIES,
  backoffMs,
  factsOf,
  nextPart,
  sameFile,
  type ResumeRecord,
  type UploadState,
} from './upload-machine';

/** The state of a new version changes on the server. The page asks again at this interval. */
export const POLL_MS = 3000;

/** A version in these states still changes. */
export const SETTLING: readonly DataSourceVersion['state'][] = ['validating', 'processing'];

/** A request to upload a file as a new version of a data source. */
export interface UploadStart {
  readonly kind: DataSourceKind;
  readonly file: File;
  readonly activate: boolean;
  readonly speciesId?: string;
}

/** The code of a failed request, for a text in the catalogue. */
export function codeOf(failure: unknown): string {
  if (failure instanceof PartFailure)
    return failure.retry ? 'network' : (failure.code ?? `status_${failure.status}`);
  const problem = failure as Partial<ProblemDetail> | null;
  return problem?.code ?? 'failed';
}

/** Sends the next part of the state. A failed part gets new tries with a growing wait. */
export function sendPart(
  api: DataSourcesApi,
  state: () => UploadState,
  file: File | null,
  onRetry: (attempt: number) => void,
): Observable<{ readonly receivedBytes: number }> {
  return defer(() => {
    const now = state();
    const part = nextPart(now);
    const moving = now.phase === 'sending' || now.phase === 'retrying';
    if (!moving || part === null || file === null || now.uploadId === null) return EMPTY;
    return api
      .append(now.uploadId, part.start, file.slice(part.start, part.end))
      .pipe(
        catchError((failure: unknown) =>
          failure instanceof OffsetMismatch
            ? of({ receivedBytes: failure.offset })
            : throwError(() => failure),
        ),
      );
  }).pipe(
    retry({
      count: MAX_RETRIES,
      delay: (failure: unknown, attempt) => {
        if (!(failure instanceof PartFailure) || !failure.retry) return throwError(() => failure);
        onRetry(attempt);
        return timer(backoffMs(attempt));
      },
    }),
  );
}

/** The session for a request. The same file after a reload continues its open session. */
export function sessionFor(
  api: DataSourcesApi,
  saved: ResumeRecord | null,
  request: UploadStart,
): Observable<UploadSession> {
  const facts = factsOf(request.file);
  const create = defer(() =>
    api.createUpload(request.kind, {
      fileName: facts.name,
      sizeBytes: facts.size,
      activate: request.activate,
      ...(request.speciesId === undefined ? {} : { speciesId: request.speciesId }),
    }),
  );
  if (saved === null || !sameFile(saved, request.kind, facts)) return create;
  return api.upload(saved.uploadId).pipe(
    map((open) => (open.state === 'open' ? open : null)),
    catchError(() => of(null)),
    switchMap((open) => (open === null ? create : of(open))),
  );
}

/** Asks for the version at each interval until it stops changing. */
export function followVersion(
  api: DataSourcesApi,
  version: DataSourceVersion,
): Observable<DataSourceVersion> {
  return timer(POLL_MS, POLL_MS).pipe(
    exhaustMap(() => api.version(version.kind, version.id).pipe(catchError(() => EMPTY))),
    takeWhile((next) => SETTLING.includes(next.state), true),
  );
}

/** Asks the server to drop a session. A failure changes nothing: the session expires. */
export function dropSession(api: DataSourcesApi, id: string | null): Observable<null> {
  return id === null ? of(null) : api.abort(id).pipe(catchError(() => of(null)));
}

/** The session that a cancel drops: the session of the upload, or the saved session of its kind. */
export function ownedSession(state: UploadState, saved: ResumeRecord | null): string | null {
  return state.uploadId ?? (saved !== null && saved.kind === state.kind ? saved.uploadId : null);
}
