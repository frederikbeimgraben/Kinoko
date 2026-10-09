import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import type { User, UserManager } from 'oidc-client-ts';
import { from, of, type Observable } from 'rxjs';
import { ConfigStore } from '../config/config.store';
import { USER_MANAGER_FACTORY } from './oidc';
import { ViewRetry, finalAnswer } from './renewal';
import { rememberSignOut, signedOutHere } from './signed-out';

/** The person who is signed in, as the ID token tells. */
export interface SignedInUser {
  sub: string;
  name: string;
  email: string;
}

/** The return path from the SSO. `docs/sso-authentik.md` lists it as a redirect URI. */
export const SIGN_IN_PATH = '/anmeldung';

/** The return path of the silent renewal, in an iframe. */
export const SILENT_PATH = '/anmeldung/still';

/** Without `offline_access` there is no refresh token and no silent renewal. */
const SCOPE = 'openid email profile offline_access';

/** The data that goes in the OIDC `state` to the SSO and back. */
interface SignInState {
  back: string;
}

/** The sign-in: authorization code with PKCE. A person reads without an account and signs in to save. */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly config = inject(ConfigStore);
  private readonly factory = inject(USER_MANAGER_FACTORY);
  private readonly router = inject(Router);

  private manager: Promise<UserManager | null> | null = null;
  private renewal: Promise<string | null> | null = null;
  /** The callers that wait for the answer of the sign-in sheet. */
  private pendingEntries: ((signedIn: boolean) => void)[] = [];
  private readonly retry = new ViewRetry();

  private readonly _user = signal<SignedInUser | null>(null);
  // A synchronous token lets the interceptor work without a network step for each request.
  private readonly _token = signal<string | null>(null);
  private readonly _busy = signal(false);
  private readonly _sheetOpen = signal(false);
  private readonly _checked = signal(false);
  private readonly _settled = signal(false);

  readonly user = this._user.asReadonly();
  /** True while a sign-in or a renewal runs. */
  readonly busy = this._busy.asReadonly();
  /** True after the first answer of the session check. */
  readonly checked = this._checked.asReadonly();
  /** True after an answer of the SSO itself. A network failure does not count. */
  readonly settled = this._settled.asReadonly();
  /** True while the sign-in sheet is on the map. */
  readonly sheetOpen = this._sheetOpen.asReadonly();
  readonly signedIn = computed(() => this._user() !== null);

  /** The access token of the current session, without a network step. */
  token(): string | null {
    return this._token();
  }

  /** Gets back a session that the SSO still has. A failure only means that nobody is signed in. */
  async restoreSession(): Promise<void> {
    // On the return from the SSO the route does the work.
    // A second silent request uses the same state again and fails.
    if (location.pathname.startsWith(SIGN_IN_PATH)) return;
    if (signedOutHere()) {
      this.settle();
      return;
    }
    try {
      await this.silentRenew();
    } finally {
      this._checked.set(true);
    }
  }

  /** Goes to the SSO. The page comes back on {@link SIGN_IN_PATH}, then on `back`. */
  async signIn(back = this.router.url): Promise<void> {
    const manager = await this.getManager();
    if (manager === null) return;
    rememberSignOut(false);
    this._busy.set(true);
    const state: SignInState = { back };
    try {
      await manager.signinRedirect({ state: state });
    } catch (failure) {
      // When the redirect fails, the app must stay usable and not show a busy state for ever.
      this._busy.set(false);
      throw failure;
    }
  }

  /** Completes the return from the SSO. Gives the route on which the sign-in started. */
  async completeSignIn(): Promise<string> {
    const manager = await this.getManager();
    if (manager === null) return '/';
    this._busy.set(true);
    try {
      const user = await manager.signinRedirectCallback();
      this.adopt(user);
      return this.targetFrom(user.state);
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
    rememberSignOut(true);
    this.settle();
    this.adopt(null);
  }

  /** Asks for a sign-in before a save. Gives `true` at once for a person who is signed in. */
  async requestSignIn(): Promise<boolean> {
    if (this.signedIn()) return true;
    // In the sheet, "Later" gives `false`. The way to the SSO leaves the page.
    this._sheetOpen.set(true);
    return new Promise<boolean>((answer) => this.pendingEntries.push(answer));
  }

  /** The sign-in sheet: "Sign in later, keep the entry on the device". */
  later(): void {
    this._sheetOpen.set(false);
    this.answer(false);
  }

  private async renew(): Promise<string | null> {
    // The state is open from the first tick.
    // Else a deep link into the admin area decides before the session is back.
    this._busy.set(true);
    try {
      const manager = await this.getManager();
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
    this._checked.set(true);
    this._settled.set(true);
  }

  /** Starts a second attempt when the app becomes visible again. */
  private retryWhenVisible(): void {
    this._checked.set(true);
    this.retry.schedule(() => void this.silentRenew());
  }

  private getManager(): Promise<UserManager | null> {
    this.manager ??= this.create();
    return this.manager;
  }

  /** Without a configuration there is no issuer and no sign-in. The map works without it. */
  private async create(): Promise<UserManager | null> {
    await this.config.load();
    const config = this.config.configuration();
    if (config === null || config.oidcIssuer === '') return null;
    const manager = await this.factory({
      authority: config.oidcIssuer,
      client_id: config.oidcClientId,
      redirect_uri: `${config.origin}${SIGN_IN_PATH}`,
      silent_redirect_uri: `${config.origin}${SILENT_PATH}`,
      post_logout_redirect_uri: config.origin,
      response_type: 'code',
      scope: SCOPE,
      automaticSilentRenew: true,
      // Authentik puts the name and the email into the ID token.
      // The UserInfo endpoint gives the same values again.
      loadUserInfo: false,
    });
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
    const profile = user.profile;
    this._user.set({
      sub: profile.sub,
      name: profile.name ?? profile.preferred_username ?? profile.email ?? profile.sub,
      email: profile.email ?? '',
    });
    this._token.set(user.access_token);
    this._sheetOpen.set(false);
    this.answer(true);
  }

  private answer(signedIn: boolean): void {
    const pendingEntries = this.pendingEntries;
    this.pendingEntries = [];
    for (const answer of pendingEntries) answer(signedIn);
  }

  private targetFrom(state: unknown): string {
    if (typeof state === 'object' && state !== null && 'back' in state) {
      const back = (state as SignInState).back;
      // Accept only paths of the app. Another URL leaves the app,
      // and the callback route stays with its error message.
      if (typeof back !== 'string' || !back.startsWith('/') || back.startsWith('//')) return '/';
      if (back === SIGN_IN_PATH || back.startsWith(`${SIGN_IN_PATH}/`) || back.startsWith(`${SIGN_IN_PATH}?`))
        return '/';
      return back;
    }
    return '/';
  }
}
