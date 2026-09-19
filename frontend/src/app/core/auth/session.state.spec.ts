import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AuthStub, authStubProviders } from '../../testing/auth-stub';
import { SessionState } from './session.state';
import { SessionStore } from './session.store';

interface Setup {
  session: SessionState;
  store: SessionStore;
  auth: AuthStub;
  tick: () => void;
}

function build(): Setup {
  TestBed.resetTestingModule();
  const auth = new AuthStub();
  auth.user.set(null);
  auth.checked.set(false);
  auth.settled.set(false);
  TestBed.configureTestingModule({ providers: authStubProviders(auth) });
  const session = TestBed.inject(SessionState);
  const tick = (): void => {
    TestBed.inject(ApplicationRef).tick();
  };
  tick();
  return { session, store: TestBed.inject(SessionStore), auth, tick };
}

describe('SessionState', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('steht vor der Antwort auf unbekannt, nicht auf Gast', () => {
    const { session } = build();

    expect(session.status()).toBe('unknown');
    expect(session.name()).toBeNull();
  });

  it('meldet Gast, sobald die Prüfung ohne Konto geantwortet hat', () => {
    const { session, auth, tick } = build();

    auth.checked.set(true);
    auth.settled.set(true);
    tick();

    expect(session.status()).toBe('guest');
    expect(session.name()).toBeNull();
  });

  it('zeigt den Stand aus dem Gerät sofort', () => {
    localStorage.setItem(
      'pilzkarte.session.v1',
      JSON.stringify({ name: 'Frederik', permissions: ['text.edit'] }),
    );
    const { session } = build();

    expect(session.status()).toBe('signedIn');
    expect(session.name()).toBe('Frederik');
  });

  it('bestätigt den Stand aus dem Gerät ohne Wechsel', () => {
    localStorage.setItem('pilzkarte.session.v1', JSON.stringify({ name: 'Frederik', permissions: [] }));
    const { session, auth, tick } = build();

    auth.user.set({ sub: 'sub-eins', name: 'Frederik', email: 'f@example.org' });
    auth.checked.set(true);
    auth.settled.set(true);
    tick();

    expect(session.status()).toBe('signedIn');
    expect(session.name()).toBe('Frederik');
  });

  it('korrigiert einen Stand, den die Prüfung nicht bestätigt', () => {
    localStorage.setItem('pilzkarte.session.v1', JSON.stringify({ name: 'Frederik', permissions: [] }));
    const { session, store, auth, tick } = build();

    auth.checked.set(true);
    auth.settled.set(true);
    tick();

    expect(session.status()).toBe('guest');
    expect(store.memory()).toBeNull();
    expect(localStorage.getItem('pilzkarte.session.v1')).toBeNull();
  });

  it('legt den Namen der neuen Sitzung im Gerät ab', () => {
    const { store, auth, tick } = build();

    auth.user.set({ sub: 'sub-eins', name: 'Frederik', email: 'f@example.org' });
    auth.checked.set(true);
    auth.settled.set(true);
    tick();

    expect(store.memory()).toEqual({ name: 'Frederik', permissions: [] });
  });

  it('räumt den Stand beim Abmelden weg', () => {
    const { store, auth, tick } = build();
    auth.user.set({ sub: 'sub-eins', name: 'Frederik', email: 'f@example.org' });
    auth.checked.set(true);
    auth.settled.set(true);
    tick();

    auth.user.set(null);
    tick();

    expect(store.memory()).toBeNull();
  });

  it('verwirft einen unbrauchbaren Stand im Gerät', () => {
    localStorage.setItem('pilzkarte.session.v1', '{kein json');
    const { session } = build();

    expect(session.status()).toBe('unknown');
  });
});

describe('SessionStore', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('ergänzt die Rechte, ohne den Namen zu verlieren', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: authStubProviders(new AuthStub()) });
    const store = TestBed.inject(SessionStore);

    store.keep({ name: 'Frederik' });
    store.keep({ permissions: ['text.edit'] });

    expect(store.memory()).toEqual({ name: 'Frederik', permissions: ['text.edit'] });
  });

  it('legt ohne Namen nichts ab', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: authStubProviders(new AuthStub()) });
    const store = TestBed.inject(SessionStore);

    store.keep({ permissions: ['text.edit'] });

    expect(store.memory()).toBeNull();
  });
});
