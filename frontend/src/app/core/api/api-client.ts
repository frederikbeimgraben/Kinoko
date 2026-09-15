import {
  HttpClient,
  HttpErrorResponse,
  HttpEventType,
  HttpHeaders,
  HttpParams,
  type HttpEvent,
} from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { ToastService } from '@stupa-makers/ui-kit';
import { catchError, filter, map, of, throwError, type Observable } from 'rxjs';
import { I18nService } from '../i18n/i18n.service';
import { API_BASE_URL } from './api.config';
import { SIGN_IN_REQUIRED, isProblemDetail, type ProblemDetail } from './problem';

const NOT_MODIFIED = 304;

/** Abfragewerte einer URL. `undefined` fällt weg, statt als Text zu landen. */
/**
 * Ein Feld darf mehrfach stehen: `?wert=a&wert=b`. Der Filter des Katalogs
 * wählt so mehrere Werte einer Gruppe, und der Dienst liest sie als Liste.
 */
export type Query = Record<string, string | number | boolean | readonly string[] | undefined>;

/** Eine Antwort mit ETag. Zum bekannten Stand bleibt `body` leer. */
export interface Tagged<T> {
  etag: string | null;
  body: T | null;
}

/** Ein Schritt beim Hochladen: der Anteil, am Ende die Antwort. */
export interface Upload<T> {
  percent: number;
  body: T | null;
}

/** Ein Aufruf im Hintergrund meldet sich nicht: `quiet` lässt den Toast weg. */
export interface Silent {
  quiet?: boolean;
  /** Antwortcodes, die ohne Toast bleiben. Der Aufrufer trägt sie selbst. */
  quietStatus?: readonly number[];
}

/**
 * Der einzige Weg zur eigenen API. Jeder Fehler wird zu einem
 * {@link ProblemDetail}, als Toast gezeigt und weitergereicht, damit der
 * Aufrufer selbst entscheiden kann.
 */
@Injectable({ providedIn: 'root' })
export class ApiClient {
  private readonly http = inject(HttpClient);
  private readonly basis = inject(API_BASE_URL);
  private readonly toasts = inject(ToastService);
  private readonly i18n = inject(I18nService);

  get<T>(path: string, query?: Query, options?: Silent): Observable<T> {
    return this.http
      .get<T>(this.url(path), { params: this.params(query) })
      .pipe(catchError((failure: unknown) => this.report(failure, options)));
  }

  /** Holt eine Antwort mit ETag. Zum bekannten Stand bleibt der Körper leer. */
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

  post<T>(path: string, body?: unknown): Observable<T> {
    return this.http
      .post<T>(this.url(path), body ?? {})
      .pipe(catchError((failure: unknown) => this.report(failure)));
  }

  /**
   * Lädt eine Datei als `multipart/form-data`, dazu die Felder, die im selben
   * Formular stehen. Der Kopf `Content-Type` wird nicht gesetzt: nur der
   * Browser kennt die Grenze zwischen den Teilen.
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

  /** Lädt eine Datei und meldet den Anteil. Der letzte Schritt trägt die Antwort. */
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
   * Holt eine Datei. Ein Foto hängt an den Rechten seines Fundes; es geht
   * darum denselben Weg mit Token und nicht über `src` am Bild.
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
    if (this.loud(problem, options)) this.toasts.error(problem.detail ?? problem.title);
    return throwError(() => problem);
  }

  private loud(problem: ProblemDetail, options?: Silent): boolean {
    if (options?.quiet === true || problem.code === SIGN_IN_REQUIRED) return false;
    return !(options?.quietStatus ?? []).includes(problem.status);
  }

  /**
   * Auch ein Abbruch ohne Antwort muss ein Problem ergeben, sonst müsste jeder
   * Aufrufer zwei Fehlerformen kennen.
   */
  private asProblem(failure: unknown): ProblemDetail {
    // Der Interceptor wirft schon ein fertiges Problem. Es hier noch einmal zu
    // deuten machte aus einer bekannten 401 einen unbekannten Fehler.
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

/** Deutet ein Ereignis des Hochladens. Ein Zwischenschritt ohne Anteil fällt weg. */
function step<T>(event: HttpEvent<T>): Upload<T> | null {
  if (event.type === HttpEventType.UploadProgress) {
    if (event.total === undefined || event.total === 0) return null;
    return { percent: Math.round((event.loaded / event.total) * 100), body: null };
  }
  if (event.type === HttpEventType.Response) return { percent: 100, body: event.body };
  return null;
}
