import type { Page } from '@playwright/test';

/** Ein SSO, das nur im Test steht. Kein Netzweg verlässt die Seite. */
export const ISSUER = 'https://sso.test.invalid';
export const CLIENT_ID = 'pilzkarte-e2e';
export const PERSON = { sub: 'sub-eins', name: 'Frederik', email: 'frederik@beimgraben.net' };

/** Die Konfiguration, die das Backend liefert, damit die App ein SSO kennt. */
export function authConfig(origin: string): Record<string, unknown> {
  return { oidcIssuer: ISSUER, oidcClientId: CLIENT_ID, origin, version: 'e2e' };
}

function base64url(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

/** Ein Token, das `oidc-client-ts` lesen kann. Es prüft keine Signatur. */
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

/**
 * Legt ein SSO auf die Seite. Die stille Erneuerung läuft danach durch, und
 * die App ist angemeldet.
 */
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

/** Ein SSO ohne Sitzung: die stille Erneuerung endet mit `login_required`. */
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

/** Ein SSO, das nicht antwortet. Die Sitzung bleibt offen: Zustand `unknown`. */
export async function mockSignInPending(page: Page): Promise<void> {
  await page.route(`${ISSUER}/.well-known/openid-configuration`, () => undefined);
}
