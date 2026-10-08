import { EMPTY, catchError, defer, of, repeat, takeWhile, type Observable } from 'rxjs';
import type { DataSourcesApi } from '../../../core/api/data-sources.api';
import type {
  DataSourceDetail,
  DataSourceKind,
  DataSourceVersion,
  RefreshRange,
  RemoteSourceId,
  VersionState,
} from '../../../core/api/models';
import type { AfterWrite } from '../write';

/** The server changes a version in the background. The page asks again at this interval. */
export const POLL_MS = 3000;

/** A version or a source in these states still changes. */
const SETTLING: readonly string[] = ['validating', 'processing'] satisfies VersionState[];

/** True when a version state still changes on the server. */
export function changing(state: string): boolean {
  return SETTLING.includes(state);
}

/** True when the detail or one of its versions still changes on the server. */
export function settling(detail: DataSourceDetail | null): boolean {
  return detail !== null && (changing(detail.state) || detail.versions.some((one) => changing(one.state)));
}

/** The page of a data source: its kind and, for model bundles, one species. */
export interface DetailQuery {
  readonly kind: DataSourceKind;
  readonly speciesId?: string | null;
}

/** An action on one version. */
export interface VersionAction extends AfterWrite {
  readonly version: DataSourceVersion;
  readonly action: 'activate' | 'reprocess' | 'remove';
}

/** A refresh of a remote source, with an optional range of years. */
export interface RemoteRefresh extends AfterWrite {
  readonly source: RemoteSourceId;
  readonly range: RefreshRange;
}

/** The request of an action on a version. */
export function versionCall(api: DataSourcesApi, request: VersionAction): Observable<unknown> {
  const { kind, id } = request.version;
  if (request.action === 'activate') return api.activate(kind, id);
  return request.action === 'reprocess' ? api.reprocess(kind, id) : api.remove(kind, id);
}

/** Reads the detail at once, and again at each interval while a version still changes. */
export function followDetail(api: DataSourcesApi, query: DetailQuery): Observable<DataSourceDetail> {
  const filter = query.speciesId ? { speciesId: query.speciesId } : {};
  // The first read shows a toast on a failure. A later read is quiet: a short gap needs no message.
  const reads = { count: 0 };
  return defer(() => api.detail(query.kind, filter, reads.count++ > 0)).pipe(
    repeat({ delay: POLL_MS }),
    takeWhile((detail) => settling(detail), true),
    catchError(() => EMPTY),
  );
}

/** Reads the log of a version, and again at each interval while `current` says that it changes. */
export function followLog(
  api: DataSourcesApi,
  version: DataSourceVersion,
  current: () => DataSourceVersion,
): Observable<string[]> {
  return defer(() => api.log(version.kind, version.id)).pipe(
    repeat({ delay: POLL_MS }),
    takeWhile(() => changing(current().state), true),
    catchError(() => of([])),
  );
}

/** Adds a page of older versions to the held detail. */
export function withPage(held: DataSourceDetail | null, page: DataSourceDetail): DataSourceDetail {
  return held === null
    ? page
    : { ...held, versions: [...held.versions, ...page.versions], nextCursor: page.nextCursor };
}
