import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import type { User, UserManager } from 'oidc-client-ts';
import { from, of, type Observable } from 'rxjs';
import { ConfigStore } from '../config/config.store';
import { I18nService } from '../i18n/i18n.service';
import type { TranslationKey } from '../i18n/translations';
import { ToastService } from '../../ui/toast/toast.service';
import { USER_MANAGER_FACTORY } from './oidc';
import { ViewRetry, finalAnswer } from './renewal';
import {
  NOTHING_TO_KEEP,
  SIGN_IN_PATH,
  managerSettings,
  personOf,
  targetFrom,
  type SignInState,
  type SignedInUser,
  type Waiting,
} from './sign-in';
import { rememberSignOut, signedOutHere } from './signed-out';

/** The sign-in: authorization code with PKCE. A person reads without an account and signs in to save. */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly config = inject(ConfigStore);
  private readonly factory = inject(USER_MANAGER_FACTORY);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);
  private readonly toasts = inject(ToastService);

  private manager: Promise<UserManager | null> | null = null;
  private renewal: Promise<string | null> | null = null;
  private waiting: readonly Waiting[] = [];
  private readonly retry = new ViewRetry();
  // Without session storage, the sign-out applies to this page only.
  private signedOutOnPage = false;
  private markChecked: () => void = () => undefined;
  private readonly checkDone = new Promise<void>((resolve) => {
    this.markChecked = resolve;
  });

  private readonly _user = signal<SignedInUser | null>(null);
  // A synchronous token lets the interceptor work without a network step for each request.
  private readonly _token = signal<string | null>(null);
  private readonly _busy = signal(false);
  private readonly _signingIn = signal(false);
  private readonly _sheetOpen = signal(false);
  private readonly _checked = signal(false);
  private readonly _settled = signal(false);

  readonly user = this._user.asReadonly();
  /** True while a sign-in or a renewal runs. */
  readonly busy = this._busy.asReadonly();
  /** True from the click on "Sign in" until the page goes to the SSO, or until it fails. */
  readonly signingIn = this._signingIn.asReadonly();
  /** True after the first answer of the session check. */
  readonly checked = this._checked.asReadonly();
  /** True after an answer of the SSO itself. A network failure does not count. */
  readonly settled = this._settled.asReadonly();
  /** True while the sign-in sheet is on the map. */
  readonly sheetOpen = this._sheetOpen.asReadonly();
  readonly signedIn = computed(() => this._user() !== null);

  constructor() {
    // The back button of the browser can show this page again from its cache, with the busy button.
    addEventListener('pageshow', (event) => {
      if (event.persisted) this._signingIn.set(false);
    });
  }

  /** Resolves after the first answer of the session check. Authenticated requests wait for it. */
  whenChecked(): Promise<void> {
    return this.checkDone;
  }

  /** The access token of the current session, without a network step. */
  token(): string | null {
    return this._token();
  }

  /** Gets back a session that the SSO still has. A failure only means that nobody is signed in. */
  async restoreSession(): Promise<void> {
    // On the return from the SSO the route does the work.
    // A second silent request uses the same state again and fails.
    if (location.pathname.startsWith(SIGN_IN_PATH)) return;
    if (this.isSignedOut()) {
      this.settle();
      return;
    }
    try {
      await this.silentRenew();
    } finally {
      this.check();
    }
  }

  /** Goes to the SSO, back on {@link SIGN_IN_PATH} and then on `back`. A failure shows a toast. */
  signIn(back = this.router.url): Promise<void> {
    return this.redirect(back, NOTHING_TO_KEEP);
  }

  /** The "Sign in" of the sheet. The page leaves the app, so the open entries go on the device first. */
  async signInFromSheet(): Promise<void> {
    const waiting = this.waiting;
    await this.redirect(this.router.url, async () => {
      await Promise.all(waiting.map((one) => one.keep()));
      this.answer(false);
    });
    if (!this._signingIn()) this._sheetOpen.set(false);
  }

  /** Completes the return from the SSO. Gives the route on which the sign-in started. */
  async completeSignIn(): Promise<string> {
    const manager = await this.getManager();
    if (manager === null) return '/';
    this._busy.set(true);
    try {
      const user = await manager.signinRedirectCallback();
      this.adopt(user);
      return targetFrom(user.state);
    } finally {
      this._busy.set(false);
      this.settle();
    }
  }

  /** Renews the token silently. All callers share one attempt, else each 401 opens its own iframe. */
  async silentRenew(): Promise<string | null> {
    this.renewal ??= this.renew();
    try {
      return await this.renewal;
    } finally {
      this.renewal = null;
    }
  }

  /** Emits after a running session check, at once without one. A store waits, so its first request has the token. */
  sessionReady(): Observable<unknown> {
    return this.renewal === null ? of(null) : from(this.renewal.catch(() => null));
  }

  /** Signs out locally. The blueprint of Authentik has no sign-out URL, so the SSO session stays. */
  async signOut(): Promise<void> {
    const manager = await this.getManager();
    await manager?.removeUser();
    // The mark stops the silent renewal from a return of the session.
    this.markSignedOut(true);
    this.settle();
    this.adopt(null);
  }

  /** Asks for a sign-in before a save, `true` at once with an account. `keep` saves the entry on the device. */
  async requestSignIn(keep: () => Promise<unknown> = NOTHING_TO_KEEP): Promise<boolean> {
    if (this.signedIn()) return true;
    this._sheetOpen.set(true);
    return new Promise<boolean>((answer) => {
      this.waiting = [...this.waiting, { answer, keep }];
    });
  }

  /** The sign-in sheet: "Sign in later, keep the entry on the device". */
  later(): void {
    this._sheetOpen.set(false);
    this.answer(false);
  }

  private async redirect(back: string, before: () => Promise<unknown>): Promise<void> {
    if (this._signingIn()) return;
    this._signingIn.set(true);
    const wasSignedOut = this.isSignedOut();
    try {
      await before();
      const manager = await this.getManager();
      if (manager === null) {
        // Without a configuration, the read of the configuration already showed its toast.
        this.failSignIn(this.config.ssoMissing() ? 'account.signInUnavailable' : null);
        return;
      }
      this.markSignedOut(false);
      const state: SignInState = { back };
      await manager.signinRedirect({ state });
    } catch {
      this.markSignedOut(wasSignedOut);
      this.failSignIn('account.signInFailed');
    }
  }

  private async renew(): Promise<string | null> {
    // The state is open from the first tick.
    // Else a deep link into the admin area decides before the session is back.
    this._busy.set(true);
    try {
      const manager = this.isSignedOut() ? null : await this.getManager();
      if (manager === null) {
        this.settle();
        return null;
      }
      const user = await manager.signinSilent();
      this.settle();
      this.adopt(user);
      return this._token();
    } catch (failure) {
      if (finalAnswer(failure)) {
        this.settle();
        this.adopt(null);
        return null;
      }
      // A network failure tells nothing about the session.
      // The state stays, and the next change of visibility asks again.
      this.retryWhenVisible();
      return null;
    } finally {
      this._busy.set(false);
    }
  }

  /** Records that the SSO answered. */
  private settle(): void {
    this.check();
    this._settled.set(true);
  }

  private check(): void {
    this._checked.set(true);
    this.markChecked();
  }

  /** Starts a second attempt when the app becomes visible again. */
  private retryWhenVisible(): void {
    this.check();
    this.retry.schedule(() => void this.silentRenew());
  }

  private isSignedOut(): boolean {
    return this.signedOutOnPage || signedOutHere();
  }

  private markSignedOut(signedOut: boolean): void {
    this.signedOutOnPage = signedOut;
    rememberSignOut(signedOut);
  }

  private failSignIn(message: TranslationKey | null): void {
    this._signingIn.set(false);
    if (message !== null) this.toasts.error(this.i18n.translate(message));
  }

  /** Keeps a manager, but not a missing one: the configuration or the SSO can come back. */
  private getManager(): Promise<UserManager | null> {
    this.manager ??= this.create().then(
      (made) => {
        if (made === null) this.manager = null;
        return made;
      },
      (failure: unknown) => {
        this.manager = null;
        throw failure;
      },
    );
    return this.manager;
  }

  /** Without a configuration there is no issuer and no sign-in. The map works without it. */
  private async create(): Promise<UserManager | null> {
    await this.config.load();
    const config = this.config.configuration();
    if (config === null || config.oidcIssuer === '') return null;
    const manager = await this.factory(managerSettings(config));
    manager.events.addUserLoaded((user: User) => {
      this.adopt(user);
    });
    manager.events.addUserUnloaded(() => {
      this.adopt(null);
    });
    // The library renews by itself. When it fails, the session stays
    // and the next change of visibility asks again.
    manager.events.addSilentRenewError(() => {
      this.retryWhenVisible();
    });
    manager.events.addAccessTokenExpired(() => {
      void this.silentRenew();
    });
    return manager;
  }

  /** An expired token counts as no token: the next step renews it. */
  private adopt(user: User | null): void {
    if (user === null || user.expired === true) {
      this._user.set(null);
      this._token.set(null);
      return;
    }
    this._user.set(personOf(user));
    this._token.set(user.access_token);
    this._sheetOpen.set(false);
    this.answer(true);
  }

  private answer(signedIn: boolean): void {
    const waiting = this.waiting;
    this.waiting = [];
    for (const one of waiting) one.answer(signedIn);
  }
}
