import { TestBed } from '@angular/core/testing';
import { USER_MANAGER_FACTORY } from './oidc';

/** The WebStorageStateStore adds the prefix `oidc.` to each key. */
function oidcSchluessel(cache: Storage): string[] {
  return Object.keys(cache).filter((schluessel) => schluessel.startsWith('oidc.'));
}

describe('USER_MANAGER_FABRIK', () => {
  afterEach(() => {
    sessionStorage.clear();
  });

  it('hält Token nur im Speicher und den PKCE-Wert in der Sitzung', async () => {
    TestBed.resetTestingModule();
    const factory = TestBed.inject(USER_MANAGER_FACTORY);

    const manager = await factory({
      authority: 'https://sso.beimgraben.net/application/o/pilze/',
      client_id: 'pilze',
      redirect_uri: 'http://localhost:4200/anmeldung',
    });

    // A token must not survive a reload. The user store is in memory and
    // writes to neither localStorage nor sessionStorage.
    await manager.settings.userStore.set('nutzer', 'token');
    expect(await manager.settings.userStore.get('nutzer')).toBe('token');
    expect(oidcSchluessel(localStorage)).toEqual([]);
    expect(oidcSchluessel(sessionStorage)).toEqual([]);

    // The PKCE verifier must survive the redirect to the SSO. It is in the
    // sessionStorage of the tab, not in localStorage.
    await manager.settings.stateStore.set('zustand', 'pruefwert');
    expect(oidcSchluessel(sessionStorage)).toEqual(['oidc.zustand']);
    expect(oidcSchluessel(localStorage)).toEqual([]);
  });
});
