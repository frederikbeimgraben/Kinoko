import { TestBed } from '@angular/core/testing';
import { patchState } from '@ngrx/signals';
import { unprotected } from '@ngrx/signals/testing';
import { AuthStub, authStubProviders } from '../../testing/auth-stub';
import { AccessApiDouble, accessApiProvider, ME } from '../../testing/access-fixture';
import { AccountStore } from './account.store';

interface Setup {
  account: AccountStore;
  auth: AuthStub;
  api: AccessApiDouble;
}

function build(signedIn = true, fails = false): Setup {
  const auth = new AuthStub();
  if (!signedIn) auth.user.set(null);
  const api = new AccessApiDouble();
  api.meFails = fails;
  TestBed.configureTestingModule({ providers: [...authStubProviders(auth), accessApiProvider(api)] });
  const account = TestBed.inject(AccountStore);
  TestBed.tick();
  return { account, auth, api };
}

describe('AccountStore', () => {
  it('reads the own account when a person is signed in', () => {
    const { account, api } = build();

    expect(api.meCalls).toBe(1);
    expect(account.userId()).toBe(ME.id);
    expect(account.owns(ME.id)).toBe(true);
    expect(account.owns('another-account')).toBe(false);
  });

  it('does not ask without a sign-in and knows no account', () => {
    const { account, api } = build(false);

    expect(api.meCalls).toBe(0);
    expect(account.owns(ME.id)).toBe(false);
  });

  it('removes the account at sign-out', () => {
    const { account, auth } = build();

    auth.user.set(null);
    TestBed.tick();

    expect(account.owns(ME.id)).toBe(false);
  });

  it('owns nothing after a failure', () => {
    const { account } = build(true, true);

    expect(account.owns(ME.id)).toBe(false);
  });

  it('owns nothing for an empty owner', () => {
    const { account } = build();

    patchState(unprotected(account), { userId: null });

    expect(account.owns(null)).toBe(false);
  });
});
