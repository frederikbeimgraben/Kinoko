import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ManagerDouble, authProvider, oidcUser } from '../../testing/auth-double';
import { SIGN_IN_REQUIRED, type ProblemDetail } from '../api/problem';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from './auth.service';
import { SessionStore } from './session.store';

interface Setup {
  http: HttpClient;
  control: HttpTestingController;
  auth: AuthService;
  manager: ManagerDouble;
}

function build(): Setup {
  TestBed.resetTestingModule();
  const manager = new ManagerDouble();
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(withInterceptors([authInterceptor])),
      provideHttpClientTesting(),
      provideRouter([]),
      ...authProvider(manager),
    ],
  });
  return {
    http: TestBed.inject(HttpClient),
    control: TestBed.inject(HttpTestingController),
    auth: TestBed.inject(AuthService),
    manager,
  };
}

/** Lets the microtasks of the silent renewal run. */
function pass(): Promise<void> {
  return new Promise((done) => setTimeout(done, 0));
}

/** Puts the service in the signed-in state without the SSO. */
async function signedIn(setup: Setup, token = 'token-eins'): Promise<void> {
  setup.manager.still = oidcUser({ token });
  await setup.auth.silentRenew();
}

describe('authInterceptor', () => {
  it('hängt das Token an eine Anfrage der eigenen API', async () => {
    const setup = build();
    await signedIn(setup);

    setup.http.get('/api/ich').subscribe();

    const request = setup.control.expectOne('/api/ich');
    expect(request.request.headers.get('Authorization')).toBe('Bearer token-eins');
    request.flush({});
  });

  it('lässt eine Anfrage ohne Anmeldung unberührt', () => {
    const setup = build();

    setup.http.get('/api/species/bundle').subscribe();

    const request = setup.control.expectOne('/api/species/bundle');
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush([]);
  });

  it('gibt das Token nur an die eigene API', async () => {
    const setup = build();
    await signedIn(setup);

    for (const url of [
      '/assets/karte.json',
      'https://sso.example.org/application/o/pilze/',
      'https://pilze.example.org/api/funde',
    ]) {
      setup.http.get(url).subscribe();
      const request = setup.control.expectOne(url);
      expect(request.request.headers.has('Authorization')).toBe(false);
      request.flush({});
    }
  });

  it('erneuert nach einer 401 still und wiederholt die Anfrage', async () => {
    const setup = build();
    await signedIn(setup, 'token-alt');
    setup.manager.still = oidcUser({ token: 'token-neu' });
    let got: unknown = null;

    setup.http.get('/api/ich').subscribe((value) => (got = value));

    setup.control
      .expectOne('/api/ich')
      .flush({ title: 'Nicht angemeldet' }, { status: 401, statusText: 'Unauthorized' });
    await pass();
    const second = setup.control.expectOne('/api/ich');
    expect(second.request.headers.get('Authorization')).toBe('Bearer token-neu');
    second.flush({ sub: 'sub-eins' });

    expect(got).toEqual({ sub: 'sub-eins' });
  });

  it('öffnet das Anmelde-Blatt, wenn das SSO die Sitzung bei einem Schreiben verneint', async () => {
    const setup = build();
    await signedIn(setup);
    setup.manager.still = Object.assign(new Error('login_required'), { error: 'login_required' });
    let problem: ProblemDetail | null = null;

    setup.http.post('/api/funde', {}).subscribe({ error: (failure: ProblemDetail) => (problem = failure) });
    setup.control.expectOne('/api/funde').flush(null, { status: 401, statusText: 'Unauthorized' });
    await pass();

    expect(problem).toMatchObject({ status: 401, code: SIGN_IN_REQUIRED });
    expect(setup.auth.sheetOpen()).toBe(true);
    setup.control.verify();
  });

  it('never opens the sign-in sheet for a read in the background', async () => {
    const setup = build();
    await signedIn(setup);
    setup.manager.still = Object.assign(new Error('login_required'), { error: 'login_required' });
    let problem: ProblemDetail | null = null;

    setup.http.get('/api/groups').subscribe({ error: (failure: ProblemDetail) => (problem = failure) });
    setup.control.expectOne('/api/groups').flush(null, { status: 401, statusText: 'Unauthorized' });
    await pass();

    expect(problem).toMatchObject({ status: 401, code: SIGN_IN_REQUIRED });
    expect(setup.auth.sheetOpen()).toBe(false);
  });

  it('does not ask the SSO again for a guest that the SSO already knows', async () => {
    const setup = build();
    setup.manager.still = Object.assign(new Error('login_required'), { error: 'login_required' });
    await setup.auth.restoreSession();
    const attempts = setup.manager.silentAttempts;

    setup.http.get('/api/groups').subscribe({ error: () => undefined });
    setup.control.expectOne('/api/groups').flush(null, { status: 401, statusText: 'Unauthorized' });
    await pass();

    expect(setup.manager.silentAttempts).toBe(attempts);
    setup.control.verify();
  });

  it('holds a request of a known session until the session check answers', async () => {
    const setup = build();
    TestBed.inject(SessionStore).keep({ name: 'Frederik', permissions: [] });
    setup.manager.still = oidcUser({ token: 'token-neu' });

    setup.http.get('/api/groups').subscribe();
    setup.http.get('/api/config').subscribe();
    setup.control.expectOne('/api/config').flush({});
    setup.control.expectNone('/api/groups');

    await setup.auth.restoreSession();
    await pass();

    const request = setup.control.expectOne('/api/groups');
    expect(request.request.headers.get('Authorization')).toBe('Bearer token-neu');
    request.flush([]);
  });

  it('fragt nicht nach, wenn nur der Netzweg der Erneuerung scheitert', async () => {
    const setup = build();
    await signedIn(setup);
    setup.manager.still = new Error('kein Netz');

    setup.http.get('/api/funde').subscribe({ error: () => undefined });
    setup.control.expectOne('/api/funde').flush(null, { status: 401, statusText: 'Unauthorized' });
    await pass();

    expect(setup.auth.sheetOpen()).toBe(false);
    expect(setup.auth.signedIn()).toBe(true);
    setup.control.verify();
  });

  it('sends a held request after some seconds when the SSO does not answer', async () => {
    vi.useFakeTimers();
    try {
      const setup = build();
      TestBed.inject(SessionStore).keep({ name: 'Frederik', permissions: [] });

      setup.http.get('/api/species/bundle').subscribe();
      setup.control.expectNone('/api/species/bundle');
      await vi.advanceTimersByTimeAsync(4000);

      setup.control.expectOne('/api/species/bundle').flush([]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('reicht jeden anderen Fehler unverändert weiter', () => {
    const setup = build();
    let status = 0;

    setup.http
      .get('/api/funde')
      .subscribe({ error: (failure: { status: number }) => (status = failure.status) });
    setup.control.expectOne('/api/funde').flush(null, { status: 500, statusText: 'Serverfehler' });

    expect(status).toBe(500);
  });
});
