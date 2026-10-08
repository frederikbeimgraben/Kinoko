import { computed, signal, type Provider } from '@angular/core';
import { AuthService, type SignedInUser } from '../core/auth';

/** An auth service without an SSO. The test sets the person who is signed in and the answer of the sign-in sheet. */
export class AuthStub {
  readonly user = signal<SignedInUser | null>({
    sub: 'sub-eins',
    name: 'Frederik',
    email: 'frederik@beimgraben.net',
  });
  readonly signedIn = computed(() => this.user() !== null);
  /** True while a silent sign-in runs. */
  readonly busy = signal(false);
  /** True after the first answer of the session check. */
  readonly checked = signal(true);
  /** True after an answer of the SSO itself. */
  readonly settled = signal(true);
  /** The answer to `requestSignIn`. */
  reply = true;
  asked = 0;

  requestSignIn(): Promise<boolean> {
    this.asked += 1;
    return Promise.resolve(this.reply);
  }
}

/** Puts the stub in the place of the real service. */
export function authStubProviders(stub: AuthStub): Provider[] {
  return [{ provide: AuthService, useValue: stub }];
}
