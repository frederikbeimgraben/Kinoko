import { HttpErrorResponse, type HttpInterceptorFn, type HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { I18nService } from '../i18n/i18n.service';
import { SIGN_IN_REQUIRED, type ProblemDetail } from '../api/problem';
import { AuthService } from './auth.service';

/** Only the app API gets the token. The issuer and the tiles never get it. */
function ownApi(url: string): boolean {
  const target = new URL(url, location.origin);
  return target.origin === location.origin && target.pathname.startsWith('/api/');
}

function withToken<T>(request: HttpRequest<T>, token: string): HttpRequest<T> {
  return request.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
}

const UNAUTHORIZED = 401;

/** The ApiClient passes this problem on silently, because the sign-in sheet is already open. */
function signInRequired(i18n: I18nService): ProblemDetail {
  return {
    type: 'about:blank',
    title: i18n.translate('state.notSignedIn'),
    status: UNAUTHORIZED,
    code: SIGN_IN_REQUIRED,
  };
}

// Adds `Authorization: Bearer` to each app API request. A 401 causes one silent renewal and one retry.
// If the retry fails, the sign-in sheet opens, and the caller gets a problem that shows no toast.
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
