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
  /** True while the way to the SSO starts. */
  readonly signingIn = signal(false);
  /** The `back` routes of the calls to `signIn`. */
  readonly signIns: string[] = [];
  /** True after the first answer of the session check. */
  readonly checked = signal(true);
  /** True after an answer of the SSO itself. */
  readonly settled = signal(true);
  /** The answer to `requestSignIn`. */
  reply = true;
  asked = 0;

  /** True: the person goes to the SSO from the sheet, so the sheet keeps the entry first. */
  goesToSso = false;

  async requestSignIn(keep: () => Promise<unknown> = () => Promise.resolve()): Promise<boolean> {
    this.asked += 1;
    if (this.goesToSso) await keep();
    return this.reply;
  }

  signIn(back = '/'): Promise<void> {
    this.signIns.push(back);
    return Promise.resolve();
  }
}

/** Puts the stub in the place of the real service. */
export function authStubProviders(stub: AuthStub): Provider[] {
  return [{ provide: AuthService, useValue: stub }];
}
