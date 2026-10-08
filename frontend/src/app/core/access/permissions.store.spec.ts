import { TestBed } from '@angular/core/testing';
import { patchState } from '@ngrx/signals';
import { unprotected } from '@ngrx/signals/testing';
import { AuthStub, authStubProviders } from '../../testing/auth-stub';
import { SessionStore } from '../auth';
import { AccessApiDouble, accessApiProvider } from '../../testing/access-fixture';
import { PermissionsStore } from './permissions.store';

interface Setup {
  rights: PermissionsStore;
  auth: AuthStub;
  api: AccessApiDouble;
  session: SessionStore;
}

function configure(auth: AuthStub, api: AccessApiDouble): PermissionsStore {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [...authStubProviders(auth), accessApiProvider(api)] });
  return TestBed.inject(PermissionsStore);
}

function build(signedIn = true): Setup {
  const auth = new AuthStub();
  if (!signedIn) auth.user.set(null);
  const api = new AccessApiDouble();
  const rights = configure(auth, api);
  const session = TestBed.inject(SessionStore);
  TestBed.tick();
  return { rights, auth, api, session };
}

describe('PermissionsStore', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('keeps the permissions on the device and removes them at sign-out', () => {
    const { auth, session } = build();

    expect(session.memory()?.permissions).toContain('role.manage');

    auth.user.set(null);
    TestBed.tick();

    expect(session.memory()).toBeNull();
  });

  it('uses the state from the device before the server answers', () => {
    localStorage.setItem(
      'pilzkarte.session.v1',
      JSON.stringify({ name: 'Frederik', permissions: ['text.edit'] }),
    );
    const auth = new AuthStub();
    auth.user.set(null);
    auth.checked.set(false);
    const api = new AccessApiDouble();
    const rights = configure(auth, api);

    expect(rights.can('text.edit')).toBe(true);
    expect(rights.settled()).toBe(true);
    expect(api.mineCalls).toBe(0);
  });

  it('reads the own permissions when a person is signed in', () => {
    const { rights, api } = build();

    expect(api.mineCalls).toBe(1);
    expect(rights.can('role.manage')).toBe(true);
    expect(rights.canAny(['role.assign'])).toBe(true);
    expect(rights.settled()).toBe(true);
  });

  it('does not ask without a sign-in and has no permission', () => {
    const { rights, api } = build(false);

    expect(api.mineCalls).toBe(0);
    expect(rights.permissions()).toBeNull();
    expect(rights.can('role.manage')).toBe(false);
    // A guest who waits for nothing has the answer.
    expect(rights.settled()).toBe(true);
  });

  it('waits while the session is open', () => {
    const { rights, auth } = build(false);
    auth.checked.set(false);
    auth.settled.set(false);
    TestBed.tick();

    expect(rights.settled()).toBe(false);
  });

  it('removes the permissions at sign-out', () => {
    const { rights, auth } = build();
    auth.user.set(null);
    TestBed.tick();

    expect(rights.permissions()).toBeNull();
    expect(rights.can('text.edit')).toBe(false);
  });

  it('has no permission after a failure and does not show a button', () => {
    const auth = new AuthStub();
    const api = new AccessApiDouble();
    api.mineFails = true;
    const rights = configure(auth, api);
    TestBed.tick();

    expect(rights.can('role.manage')).toBe(false);
    // The answer is known: empty. Else the guard waits for ever.
    expect(rights.settled()).toBe(true);
  });

  it('derives the checks from patched permissions', () => {
    const { rights } = build(false);

    patchState(unprotected(rights), { permissions: ['text.edit'] });

    expect(rights.can('text.edit')).toBe(true);
    expect(rights.canAny(['role.manage', 'text.edit'])).toBe(true);
    expect(rights.canAny(['role.manage'])).toBe(false);
  });
});
