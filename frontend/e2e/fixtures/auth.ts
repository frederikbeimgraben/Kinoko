import type { Page } from '@playwright/test';

/** An SSO that exists only in the test. No network request leaves the page. */
export const ISSUER = 'https://sso.test.invalid';
export const CLIENT_ID = 'pilzkarte-e2e';
export const PERSON = { sub: 'sub-eins', name: 'Frederik', email: 'frederik@beimgraben.net' };

/** The backend configuration that tells the app the SSO. */
export function authConfig(origin: string): Record<string, unknown> {
  return { oidcIssuer: ISSUER, oidcClientId: CLIENT_ID, origin, version: 'e2e' };
}

function base64url(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

/** A token that `oidc-client-ts` can read. It has no signature check. */
function idToken(nonce: string): string {
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    iss: ISSUER,
    aud: CLIENT_ID,
    sub: PERSON.sub,
    name: PERSON.name,
    email: PERSON.email,
    nonce,
    iat: now,
    exp: now + 3600,
  };
  return `${base64url({ alg: 'none', typ: 'JWT' })}.${base64url(claims)}.`;
}

const METADATA = {
  issuer: ISSUER,
  authorization_endpoint: `${ISSUER}/authorize`,
  token_endpoint: `${ISSUER}/token`,
  end_session_endpoint: `${ISSUER}/logout`,
  response_types_supported: ['code'],
  subject_types_supported: ['public'],
  id_token_signing_alg_values_supported: ['RS256'],
};

/** Puts an SSO on the page. The silent renewal then succeeds, and the app is signed in. */
export async function mockSignIn(page: Page, delayMs = 0): Promise<void> {
  let nonce = '';
  await page.route(`${ISSUER}/.well-known/openid-configuration`, async (route) => {
    if (delayMs > 0) await new Promise((done) => setTimeout(done, delayMs));
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(METADATA) });
  });
  await page.route(`${ISSUER}/authorize*`, async (route) => {
    const asked = new URL(route.request().url());
    nonce = asked.searchParams.get('nonce') ?? '';
    const back = new URL(asked.searchParams.get('redirect_uri') ?? '');
    back.searchParams.set('code', 'code-eins');
    back.searchParams.set('state', asked.searchParams.get('state') ?? '');
    await route.fulfill({ status: 302, headers: { location: back.toString() } });
  });
  await page.route(`${ISSUER}/token`, (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        access_token: 'token-eins',
        id_token: idToken(nonce),
        token_type: 'Bearer',
        expires_in: 3600,
        scope: 'openid profile email',
      }),
    }),
  );
}

/** An SSO without a session: the silent renewal ends with `login_required`. */
export async function mockSignedOut(page: Page): Promise<void> {
  await page.route(`${ISSUER}/.well-known/openid-configuration`, (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify(METADATA) }),
  );
  await page.route(`${ISSUER}/authorize*`, async (route) => {
    const asked = new URL(route.request().url());
    const back = new URL(asked.searchParams.get('redirect_uri') ?? '');
    back.searchParams.set('error', 'login_required');
    back.searchParams.set('state', asked.searchParams.get('state') ?? '');
    await route.fulfill({ status: 302, headers: { location: back.toString() } });
  });
}

/** An SSO that gives no answer. The session stays open: state `unknown`. */
export async function mockSignInPending(page: Page): Promise<void> {
  await page.route(`${ISSUER}/.well-known/openid-configuration`, () => undefined);
}
