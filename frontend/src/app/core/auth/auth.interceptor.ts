import { HttpErrorResponse, type HttpInterceptorFn, type HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { I18nService } from '../i18n/i18n.service';
import { SIGN_IN_REQUIRED, type ProblemDetail } from '../api/problem';
import { AuthService } from './auth.service';

/** Nur die eigene API bekommt das Token. Der Issuer und Kacheln nie. */
function ownApi(url: string): boolean {
  const target = new URL(url, location.origin);
  return target.origin === location.origin && target.pathname.startsWith('/api/');
}

function withToken<T>(request: HttpRequest<T>, token: string): HttpRequest<T> {
  return request.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
}

const UNAUTHORIZED = 401;

/** Das Problem, das der ApiClient stumm weiterreicht, weil das Blatt schon fragt. */
function signInRequired(i18n: I18nService): ProblemDetail {
  return {
    type: 'about:blank',
    title: i18n.translate('state.notSignedIn'),
    status: UNAUTHORIZED,
    code: SIGN_IN_REQUIRED,
  };
}

/**
 * Hängt `Authorization: Bearer` an jede Anfrage an die eigene API. Auf eine 401
 * folgt genau ein stiller Erneuerungsversuch und die Wiederholung. Scheitert
 * auch der, fragt das Anmelde-Blatt nach; der Aufrufer bekommt ein Problem, das
 * keinen Toast auslöst.
 */
export const authInterceptor: HttpInterceptorFn = (request, more) => {
  if (!ownApi(request.url)) return more(request);
  const auth = inject(AuthService);
  const i18n = inject(I18nService);
  const token = auth.token();
  return more(token === null ? request : withToken(request, token)).pipe(
    catchError((failure: unknown) => {
      const other = !(failure instanceof HttpErrorResponse) || failure.status !== UNAUTHORIZED;
      if (other) return throwError(() => failure);
      return from(auth.silentRenew()).pipe(
        switchMap((fresh) => {
          if (fresh !== null) return more(withToken(request, fresh));
          void auth.requestSignIn();
          return throwError(() => signInRequired(i18n));
        }),
      );
    }),
  );
};
