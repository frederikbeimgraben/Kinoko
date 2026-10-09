import {
  HttpClient,
  HttpErrorResponse,
  HttpEventType,
  HttpHeaders,
  HttpParams,
  type HttpEvent,
} from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { catchError, filter, map, of, throwError, type Observable } from 'rxjs';
import { I18nService } from '../i18n/i18n.service';
import { DEFAULT_LOCALE } from '../i18n/translations';
import { ConnectionNotice } from '../../ui/banner/connection-notice';
import { ToastService } from '../../ui/toast/toast.service';
import { API_BASE_URL } from './api.config';
import { SIGN_IN_REQUIRED, isProblemDetail, type ProblemDetail } from './problem';

const NOT_MODIFIED = 304;

/**
 * Query values of a URL. `undefined` is dropped. A repeated field (`?wert=a&wert=b`) gives a list.
 */
export type Query = Record<string, string | number | boolean | readonly string[] | undefined>;

/** A response with an ETag. For a known version, `body` stays empty. */
export interface Tagged<T> {
  etag: string | null;
  body: T | null;
}

/** One upload step: the percentage, and at the end the response. */
export interface Upload<T> {
  percent: number;
  body: T | null;
}

/** A background call stays silent: `quiet` hides the toast. */
export interface Silent {
  quiet?: boolean;
  /** Status codes that show no toast. The caller handles them. */
  quietStatus?: readonly number[];
}

/**
 * The only path to the own API. Each error becomes a {@link ProblemDetail}, a toast, and goes to the caller.
 */
/** The text key of a problem code, as the service makes it: "not_found" gives "error.notFound". */
export function problemKey(code: string | null | undefined): string | null {
  const parts = (code ?? '').split('_').filter((part) => part !== '');
  if (parts.length === 0) return null;
  const [first, ...rest] = parts;
  return `error.${first}${rest.map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join('')}`;
}

@Injectable({ providedIn: 'root' })
export class ApiClient {
  private readonly http = inject(HttpClient);
  private readonly basis = inject(API_BASE_URL);
  private readonly toasts = inject(ToastService);
  private readonly notice = inject(ConnectionNotice);
  private readonly i18n = inject(I18nService);

  get<T>(path: string, query?: Query, options?: Silent): Observable<T> {
    return this.http
      .get<T>(this.url(path), { params: this.params(query) })
      .pipe(catchError((failure: unknown) => this.report(failure, options)));
  }

  /** Gets a response with an ETag. For a known version, the body stays empty. */
  getTagged<T>(path: string, etag: string | null, options?: Silent): Observable<Tagged<T>> {
    const headers = etag === null ? undefined : new HttpHeaders({ 'If-None-Match': etag });
    return this.http.get<T>(this.url(path), { headers, observe: 'response' }).pipe(
      map((answer) => ({ etag: answer.headers.get('ETag'), body: answer.body })),
      catchError((failure: unknown) =>
        failure instanceof HttpErrorResponse && failure.status === NOT_MODIFIED
          ? of({ etag: failure.headers.get('ETag') ?? etag, body: null })
          : this.report(failure, options),
      ),
    );
  }

  post<T>(path: string, body?: unknown, options?: Silent): Observable<T> {
    return this.http
      .post<T>(this.url(path), body ?? {})
      .pipe(catchError((failure: unknown) => this.report(failure, options)));
  }

  /**
   * Uploads a file and the form fields as `multipart/form-data`. Do not set `Content-Type`: only the browser knows the part boundary.
   */
  postFile<T>(path: string, field: string, file: File, fields: Query = {}, options?: Silent): Observable<T> {
    const body = new FormData();
    body.append(field, file, file.name);
    for (const [name, value] of Object.entries(fields)) {
      if (value !== undefined) body.append(name, String(value));
    }
    return this.http
      .post<T>(this.url(path), body)
      .pipe(catchError((failure: unknown) => this.report(failure, options)));
  }

  /** Uploads a file and gives the percentage. The last step has the response. */
  uploadFile<T>(path: string, field: string, file: File, fields: Query = {}): Observable<Upload<T>> {
    const body = new FormData();
    body.append(field, file, file.name);
    for (const [name, value] of Object.entries(fields)) {
      if (value !== undefined) body.append(name, String(value));
    }
    return this.http.post<T>(this.url(path), body, { reportProgress: true, observe: 'events' }).pipe(
      map((event) => step<T>(event)),
      filter((state): state is Upload<T> => state !== null),
      catchError((failure: unknown) => this.report(failure)),
    );
  }

  /**
   * Gets a file with the token, not `src` on the image, because a photo uses the permissions of its find.
   */
  getBlob(path: string): Observable<Blob> {
    return this.http
      .get(this.url(path), { responseType: 'blob' })
      .pipe(catchError((failure: unknown) => this.report(failure)));
  }

  put<T>(path: string, body: unknown, options?: Silent): Observable<T> {
    return this.http
      .put<T>(this.url(path), body)
      .pipe(catchError((failure: unknown) => this.report(failure, options)));
  }

  patch<T>(path: string, body: unknown): Observable<T> {
    return this.http
      .patch<T>(this.url(path), body)
      .pipe(catchError((failure: unknown) => this.report(failure)));
  }

  delete<T>(path: string, query?: Query, options?: Silent): Observable<T> {
    return this.http
      .delete<T>(this.url(path), { params: this.params(query) })
      .pipe(catchError((failure: unknown) => this.report(failure, options)));
  }

  private url(path: string): string {
    return `${this.basis}${path}`;
  }

  private params(query?: Query): HttpParams {
    let params = new HttpParams();
    for (const [name, value] of Object.entries(query ?? {})) {
      if (value === undefined) continue;
      if (Array.isArray(value)) {
        for (const one of value as readonly string[]) params = params.append(name, one);
      } else {
        params = params.set(name, String(value));
      }
    }
    return params;
  }

  private report(failure: unknown, options?: Silent): Observable<never> {
    const problem = this.asProblem(failure);
    if (this.loud(problem, options)) this.toasts.error(this.messageOf(problem));
    return throwError(() => problem);
  }

  /** The service writes its texts in German. In another language, the code gives the text. */
  private messageOf(problem: ProblemDetail): string {
    const german = problem.detail ?? problem.title;
    const key = problemKey(problem.code);
    if (this.i18n.locale() === DEFAULT_LOCALE || key === null) return german;
    const text = this.i18n.translateOptional(key);
    return text === key ? german : text;
  }

  private loud(problem: ProblemDetail, options?: Silent): boolean {
    if (options?.quiet === true || problem.code === SIGN_IN_REQUIRED) return false;
    // The offline banner on the screen tells it already. A toast would only cover the page.
    if (problem.status === 0 && this.notice.shown()) return false;
    return !(options?.quietStatus ?? []).includes(problem.status);
  }

  /** A stop without a response also gives a problem. Thus each caller knows only one error shape. */
  private asProblem(failure: unknown): ProblemDetail {
    // The interceptor throws a finished problem. A second parse here makes a
    // known 401 into an unknown error.
    if (isProblemDetail(failure)) return failure;
    if (failure instanceof HttpErrorResponse) {
      if (isProblemDetail(failure.error)) return failure.error;
      const withoutResponse = failure.status === 0;
      return {
        type: 'about:blank',
        title: this.i18n.translate(withoutResponse ? 'state.noConnection' : 'error.internal'),
        status: failure.status,
      };
    }
    return { type: 'about:blank', title: this.i18n.translate('error.internal'), status: 0 };
  }
}

/** Reads an upload event. A step without a percentage is dropped. */
function step<T>(event: HttpEvent<T>): Upload<T> | null {
  if (event.type === HttpEventType.UploadProgress) {
    if (event.total === undefined || event.total === 0) return null;
    return { percent: Math.round((event.loaded / event.total) * 100), body: null };
  }
  if (event.type === HttpEventType.Response) return { percent: 100, body: event.body };
  return null;
}
