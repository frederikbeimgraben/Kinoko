import { TestBed } from '@angular/core/testing';
import { patchState } from '@ngrx/signals';
import { unprotected } from '@ngrx/signals/testing';
import { AuthStub, authStubProviders } from '../../testing/auth-stub';
import { SessionStore, mergeMemory, readMemory } from './session.store';

const KEY = 'pilzkarte.session.v1';

interface Setup {
  session: SessionStore;
  auth: AuthStub;
}

function build(): Setup {
  TestBed.resetTestingModule();
  const auth = new AuthStub();
  auth.user.set(null);
  auth.checked.set(false);
  auth.settled.set(false);
  TestBed.configureTestingModule({ providers: authStubProviders(auth) });
  const session = TestBed.inject(SessionStore);
  TestBed.tick();
  return { session, auth };
}

function answer(auth: AuthStub, signedIn: boolean): void {
  auth.user.set(signedIn ? { sub: 'sub-one', name: 'Frederik', email: 'f@example.org' } : null);
  auth.checked.set(true);
  auth.settled.set(true);
  TestBed.tick();
}

describe('readMemory', () => {
  it('accepts a name with permissions and drops values that are not text', () => {
    expect(readMemory({ name: 'Frederik', permissions: ['text.edit', 3] })).toEqual({
      name: 'Frederik',
      permissions: ['text.edit'],
    });
  });

  it('refuses a value without a name', () => {
    expect(readMemory({ name: '', permissions: [] })).toBeNull();
    expect(readMemory('Frederik')).toBeNull();
    expect(readMemory(null)).toBeNull();
  });
});

describe('mergeMemory', () => {
  it('adds the permissions and keeps the name', () => {
    const named = mergeMemory(null, { name: 'Frederik' });

    expect(mergeMemory(named, { permissions: ['text.edit'] })).toEqual({
      name: 'Frederik',
      permissions: ['text.edit'],
    });
  });

  it('keeps nothing without a name', () => {
    expect(mergeMemory(null, { permissions: ['text.edit'] })).toBeNull();
  });
});

describe('SessionStore', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('is unknown before the answer, not guest', () => {
    const { session } = build();

    expect(session.status()).toBe('unknown');
    expect(session.name()).toBeNull();
  });

  it('reports guest when the check answered without an account', () => {
    const { session, auth } = build();

    answer(auth, false);

    expect(session.status()).toBe('guest');
    expect(session.name()).toBeNull();
  });

  it('shows the state from the device at once', () => {
    localStorage.setItem(KEY, JSON.stringify({ name: 'Frederik', permissions: ['text.edit'] }));
    const { session } = build();

    expect(session.status()).toBe('signedIn');
    expect(session.name()).toBe('Frederik');
  });

  it('confirms the state from the device without a change', () => {
    localStorage.setItem(KEY, JSON.stringify({ name: 'Frederik', permissions: [] }));
    const { session, auth } = build();

    answer(auth, true);

    expect(session.status()).toBe('signedIn');
    expect(session.name()).toBe('Frederik');
  });

  it('corrects a state that the check does not confirm', () => {
    localStorage.setItem(KEY, JSON.stringify({ name: 'Frederik', permissions: [] }));
    const { session, auth } = build();

    answer(auth, false);

    expect(session.status()).toBe('guest');
    expect(session.memory()).toBeNull();
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('keeps the name of a new session on the device', () => {
    const { session, auth } = build();

    answer(auth, true);

    expect(session.memory()).toEqual({ name: 'Frederik', permissions: [] });
    expect(JSON.parse(localStorage.getItem(KEY) ?? 'null')).toEqual({ name: 'Frederik', permissions: [] });
  });

  it('removes the state at sign-out', () => {
    const { session, auth } = build();
    answer(auth, true);

    auth.user.set(null);
    TestBed.tick();

    expect(session.memory()).toBeNull();
  });

  it('ignores a bad state on the device', () => {
    localStorage.setItem(KEY, '{no json');
    const { session } = build();

    expect(session.status()).toBe('unknown');
  });

  it('adds the permissions and keeps the name', () => {
    const { session } = build();

    session.keep({ name: 'Frederik' });
    session.keep({ permissions: ['text.edit'] });

    expect(session.memory()).toEqual({ name: 'Frederik', permissions: ['text.edit'] });
  });

  it('keeps nothing without a name', () => {
    const { session } = build();

    session.keep({ permissions: ['text.edit'] });

    expect(session.memory()).toBeNull();
  });

  it('derives the name from a patched memory', () => {
    const { session } = build();

    patchState(unprotected(session), { memory: { name: 'Anna', permissions: [] } });

    expect(session.status()).toBe('signedIn');
    expect(session.name()).toBe('Anna');
  });
});
