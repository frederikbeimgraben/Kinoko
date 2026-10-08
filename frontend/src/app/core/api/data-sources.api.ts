import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { catchError, map, throwError, type Observable } from 'rxjs';
import { ApiClient } from './api-client';
import { API_BASE_URL } from './api.config';
import type {
  DataSource,
  DataSourceDetail,
  DataSourceKind,
  DataSourceVersion,
  Items,
  PipelineRun,
  RefreshRange,
  RemoteSource,
  RemoteSourceId,
  UploadCreate,
  UploadSession,
} from './models';

const SOURCES = '/data-sources';
const UPLOADS = '/data-source-uploads';
const OFFSET_HEADER = 'Upload-Offset';
const CONFLICT = 409;

/** The server has another offset than the part: it gives its own offset to continue from. */
export class OffsetMismatch extends Error {
  constructor(readonly offset: number) {
    super('offset_mismatch');
  }
}

/** A part failed. `retry` is false when a new try cannot help, for example after an abort. */
export class PartFailure extends Error {
  constructor(
    readonly status: number,
    readonly retry: boolean,
  ) {
    super(`part_failed_${status}`);
  }
}

/** The page query of the version history. */
export interface VersionQuery {
  cursor?: string;
  speciesId?: string;
}

/** The data sources, their versions and the resumable uploads. Each endpoint needs `data.manage`. */
@Injectable({ providedIn: 'root' })
export class DataSourcesApi {
  private readonly api = inject(ApiClient);
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);

  list(): Observable<DataSource[]> {
    return this.api
      .get<Items<DataSource>>(SOURCES, undefined, { quiet: true })
      .pipe(map((page) => page.items));
  }

  remotes(): Observable<RemoteSource[]> {
    return this.api
      .get<Items<RemoteSource>>('/remote-sources', undefined, { quiet: true })
      .pipe(map((page) => page.items));
  }

  /** A polling request is quiet: a short network gap does not show a toast at each tick. */
  detail(kind: DataSourceKind, query: VersionQuery = {}, quiet = false): Observable<DataSourceDetail> {
    return this.api.get<DataSourceDetail>(`${SOURCES}/${kind}`, { ...query }, { quiet });
  }

  version(kind: DataSourceKind, id: string): Observable<DataSourceVersion> {
    return this.api.get<DataSourceVersion>(this.versionPath(kind, id), undefined, { quiet: true });
  }

  activate(kind: DataSourceKind, id: string): Observable<DataSourceVersion> {
    return this.api.post<DataSourceVersion>(`${this.versionPath(kind, id)}/activate`);
  }

  reprocess(kind: DataSourceKind, id: string): Observable<DataSourceVersion> {
    return this.api.post<DataSourceVersion>(`${this.versionPath(kind, id)}/reprocess`);
  }

  remove(kind: DataSourceKind, id: string): Observable<null> {
    return this.api.delete<null>(this.versionPath(kind, id));
  }

  log(kind: DataSourceKind, id: string, tail = 200): Observable<string[]> {
    return this.api
      .get<{ lines?: string[] }>(`${this.versionPath(kind, id)}/log`, { tail }, { quiet: true })
      .pipe(map((answer) => answer.lines ?? []));
  }

  refresh(source: RemoteSourceId, range: RefreshRange = {}): Observable<PipelineRun> {
    return this.api.post<PipelineRun>(`/remote-sources/${source}/refresh`, range);
  }

  createUpload(kind: DataSourceKind, create: UploadCreate): Observable<UploadSession> {
    return this.api.post<UploadSession>(`${SOURCES}/${kind}/uploads`, create);
  }

  upload(id: string): Observable<UploadSession> {
    return this.api.get<UploadSession>(`${UPLOADS}/${encodeURIComponent(id)}`, undefined, { quiet: true });
  }

  /** Sends one part at `offset`. The store retries a failed part, so this call shows no toast.
   * A 409 with an `Upload-Offset` header becomes an {@link OffsetMismatch}. */
  append(id: string, offset: number, part: Blob): Observable<UploadSession> {
    const headers = new HttpHeaders({
      [OFFSET_HEADER]: String(offset),
      'Content-Type': 'application/octet-stream',
    });
    return this.http
      .patch<UploadSession>(`${this.base}${UPLOADS}/${encodeURIComponent(id)}`, part, { headers })
      .pipe(catchError((failure: unknown) => throwError(() => partError(failure))));
  }

  complete(id: string, sha256: string | null): Observable<DataSourceVersion> {
    return this.api.post<DataSourceVersion>(
      `${UPLOADS}/${encodeURIComponent(id)}/complete`,
      sha256 === null ? {} : { sha256 },
    );
  }

  abort(id: string): Observable<null> {
    return this.api.delete<null>(`${UPLOADS}/${encodeURIComponent(id)}`, undefined, { quiet: true });
  }

  private versionPath(kind: DataSourceKind, id: string): string {
    return `${SOURCES}/${kind}/versions/${encodeURIComponent(id)}`;
  }
}

/** Sorts a failed part: an offset conflict, a closed upload, or a network or server error. */
export function partError(failure: unknown): Error {
  if (!(failure instanceof HttpErrorResponse)) return new PartFailure(0, true);
  const offset = Number(failure.headers.get(OFFSET_HEADER));
  if (failure.status === CONFLICT && failure.headers.has(OFFSET_HEADER) && Number.isFinite(offset)) {
    return new OffsetMismatch(offset);
  }
  // A network gap (0), a time-out (408), a rate limit (429) or a server error can pass with a new try.
  const retry =
    failure.status === 0 || failure.status === 408 || failure.status === 429 || failure.status >= 500;
  return new PartFailure(failure.status, retry);
}
