import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AuthStub, authStubProviders } from '../../testing/auth-stub';
import { AccessApiDouble, accessApiProvider, ME } from '../../testing/access-fixture';
import { AccountService } from './account.service';

interface Setup {
  account: AccountService;
  auth: AuthStub;
  api: AccessApiDouble;
  tick: () => void;
}

function build(signedIn = true): Setup {
  const auth = new AuthStub();
  if (!signedIn) auth.user.set(null);
  const api = new AccessApiDouble();
  TestBed.configureTestingModule({ providers: [...authStubProviders(auth), accessApiProvider(api)] });
  const account = TestBed.inject(AccountService);
  const tick = (): void => {
    TestBed.inject(ApplicationRef).tick();
  };
  tick();
  return { account, auth, api, tick };
}

describe('AccountService', () => {
  it('holt das eigene Konto, sobald jemand angemeldet ist', () => {
    const { account, api } = build();

    expect(api.meCalls).toBe(1);
    expect(account.owns(ME.id)).toBe(true);
    expect(account.owns('ein-fremdes-konto')).toBe(false);
  });

  it('fragt ohne Anmeldung nicht und kennt kein Konto', () => {
    const { account, api } = build(false);

    expect(api.meCalls).toBe(0);
    expect(account.owns(ME.id)).toBe(false);
  });

  it('räumt das Konto beim Abmelden weg', () => {
    const { account, auth, tick } = build();
    auth.user.set(null);
    tick();

    expect(account.owns(ME.id)).toBe(false);
  });

  it('gilt nach einem Ausfall als niemandes Eigentum', () => {
    const auth = new AuthStub();
    const api = new AccessApiDouble();
    api.meFails = true;
    TestBed.configureTestingModule({ providers: [...authStubProviders(auth), accessApiProvider(api)] });
    const account = TestBed.inject(AccountService);
    TestBed.inject(ApplicationRef).tick();

    expect(account.owns(ME.id)).toBe(false);
  });
});
