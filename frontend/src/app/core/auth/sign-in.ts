import type { User, UserManagerSettings } from 'oidc-client-ts';
import type { AppConfig } from '../config/config.store';

/** The return path from the SSO. `docs/sso-authentik.md` lists it as a redirect URI. */
export const SIGN_IN_PATH = '/anmeldung';

/** The return path of the silent renewal, in an iframe. */
export const SILENT_PATH = '/anmeldung/still';

/** Without `offline_access` there is no refresh token and no silent renewal. */
const SCOPE = 'openid email profile offline_access';

/** The person who is signed in, as the ID token tells. */
export interface SignedInUser {
  sub: string;
  name: string;
  email: string;
}

/** A caller that waits for the answer of the sign-in sheet. */
export interface Waiting {
  readonly answer: (signedIn: boolean) => void;
  /** Puts the open entry on the device. The page then can go to the SSO without a loss. */
  readonly keep: () => Promise<unknown>;
}

export const NOTHING_TO_KEEP = (): Promise<void> => Promise.resolve();

/** The person from the ID token. The name falls back to the user name, the email, then the subject. */
export function personOf(user: User): SignedInUser {
  const profile = user.profile;
  return {
    sub: profile.sub,
    name: profile.name ?? profile.preferred_username ?? profile.email ?? profile.sub,
    email: profile.email ?? '',
  };
}

/** The data that goes in the OIDC `state` to the SSO and back. */
export interface SignInState {
  back: string;
}

/** The settings of the `UserManager` for the SSO of the backend configuration. */
export function managerSettings(config: AppConfig): UserManagerSettings {
  return {
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
  };
}

/** The route from the OIDC `state`. Only a path of the app is accepted, and never the callback route. */
export function targetFrom(state: unknown): string {
  if (typeof state !== 'object' || state === null || !('back' in state)) return '/';
  const back = (state as SignInState).back;
  // Another URL leaves the app, and the callback route stays with its error message.
  if (typeof back !== 'string' || !back.startsWith('/') || back.startsWith('//')) return '/';
  const callback =
    back === SIGN_IN_PATH || back.startsWith(`${SIGN_IN_PATH}/`) || back.startsWith(`${SIGN_IN_PATH}?`);
  return callback ? '/' : back;
}
