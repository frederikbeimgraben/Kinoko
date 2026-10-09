import { inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { Router, type ActivatedRouteSnapshot, type CanActivateFn, type UrlTree } from '@angular/router';
import { filter, map, pairwise, take, type Observable } from 'rxjs';
import { AuthService } from './auth.service';
import { SessionStore } from './session.store';

/** Gives the page that a guest sees in place of the page of the route. */
export type GuestTarget = (route: ActivatedRouteSnapshot) => string;

const ACCOUNT: GuestTarget = () => '/konto';

/** Opens a route only with an account. A guest goes to `target`, by default the account page. */
export function requiresSignIn(target: GuestTarget = ACCOUNT): CanActivateFn {
  return (route): Observable<boolean | UrlTree> => {
    const auth = inject(AuthService);
    const session = inject(SessionStore);
    const router = inject(Router);
    // The memory of the device can show a session that the SSO does not have. Only the answer of the check is sure.
    return toObservable(auth.checked).pipe(
      filter(Boolean),
      take(1),
      map(() => session.status() === 'signedIn' || router.parseUrl(target(route))),
    );
  };
}

/** When the session ends, the guards of the open route run again, so a page with an account closes. */
export function leaveSignedInPages(): void {
  const session = inject(SessionStore);
  const router = inject(Router);
  toObservable(session.status)
    .pipe(
      pairwise(),
      filter(([before, now]) => before === 'signedIn' && now === 'guest'),
    )
    .subscribe(() => {
      void router.navigateByUrl(router.url, { onSameUrlNavigation: 'reload', replaceUrl: true });
    });
}
