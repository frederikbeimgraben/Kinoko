import { HttpErrorResponse, type HttpInterceptorFn, type HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, from, of, switchMap, throwError, timeout, type Observable } from 'rxjs';
import { I18nService } from '../i18n/i18n.service';
import { SIGN_IN_REQUIRED, type ProblemDetail } from '../api/problem';
import { AuthService } from './auth.service';
import { SessionStore } from './session.store';

/** Only the app API gets the token. The issuer and the tiles never get it. */
function ownApi(url: string): boolean {
  const target = new URL(url, location.origin);
  return target.origin === location.origin && target.pathname.startsWith('/api/');
}

/** The session check itself reads the configuration, so this read cannot wait for the check. */
function configRead(url: string): boolean {
  return new URL(url, location.origin).pathname === '/api/config';
}

function withToken<T>(request: HttpRequest<T>, token: string | null): HttpRequest<T> {
  return token === null ? request : request.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
}

const UNAUTHORIZED = 401;

/** A slow SSO must not stop the app: after this time a held request goes out without a token. */
const CHECK_WAIT_MS = 4000;

/** A read runs in the background. Only a write comes from an action of the person. */
const READS: readonly string[] = ['GET', 'HEAD', 'OPTIONS'];

/** The ApiClient passes this problem on silently. */
function signInRequired(i18n: I18nService): ProblemDetail {
  return {
    type: 'about:blank',
    title: i18n.translate('state.notSignedIn'),
    status: UNAUTHORIZED,
    code: SIGN_IN_REQUIRED,
  };
}

/** Adds `Authorization: Bearer` to each app API request. After a reload, the request of a known session
 * waits for the session check, else it goes out without a token and gets a 401.
 * A 401 causes one silent renewal and one retry. Only a failed write opens the sign-in sheet. */
export const authInterceptor: HttpInterceptorFn = (request, more) => {
  if (!ownApi(request.url)) return more(request);
  const auth = inject(AuthService);
  const session = inject(SessionStore);
  const i18n = inject(I18nService);
  const waits = !auth.checked() && session.memory() !== null && !configRead(request.url);
  const ready: Observable<void> = waits
    ? from(auth.whenChecked()).pipe(timeout({ first: CHECK_WAIT_MS, with: () => of(undefined) }))
    : of(undefined);
  return ready.pipe(
    switchMap(() => {
      const token = auth.token();
      return more(withToken(request, token)).pipe(
        catchError((failure: unknown) => {
          const other = !(failure instanceof HttpErrorResponse) || failure.status !== UNAUTHORIZED;
          if (other) return throwError(() => failure);
          // The SSO already said that there is no session. Another attempt gives the same answer.
          const renewal = token === null && auth.settled() ? Promise.resolve(null) : auth.silentRenew();
          return from(renewal).pipe(
            switchMap((fresh) => {
              if (fresh !== null) return more(withToken(request, fresh));
              if (!READS.includes(request.method)) void auth.requestSignIn();
              return throwError(() => signInRequired(i18n));
            }),
          );
        }),
      );
    }),
  );
};
