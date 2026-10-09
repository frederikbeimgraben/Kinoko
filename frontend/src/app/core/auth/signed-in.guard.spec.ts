import { ApplicationRef, signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  Router,
  UrlTree,
  provideRouter,
  type ActivatedRouteSnapshot,
  type RouterStateSnapshot,
} from '@angular/router';
import { firstValueFrom, isObservable } from 'rxjs';
import { AuthService } from './auth.service';
import { SessionStore, type SessionStatus } from './session.store';
import { leaveSignedInPages, requiresSignIn, type GuestTarget } from './signed-in.guard';

interface Doubles {
  checked: WritableSignal<boolean>;
  status: WritableSignal<SessionStatus>;
}

function setUp(status: SessionStatus, checked = true): Doubles {
  const doubles: Doubles = { checked: signal(checked), status: signal(status) };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([
        {
          path: 'konto/daten',
          children: [],
          canActivate: [requiresSignIn()],
          runGuardsAndResolvers: 'always',
        },
        { path: '**', children: [] },
      ]),
      { provide: AuthService, useValue: { checked: doubles.checked } },
      { provide: SessionStore, useValue: { status: doubles.status } },
    ],
  });
  return doubles;
}

/** Runs the guard and gives its result: `true` or a redirect path. */
async function decide(target?: GuestTarget, route = {} as ActivatedRouteSnapshot): Promise<boolean | string> {
  const router = TestBed.inject(Router);
  const answer = TestBed.runInInjectionContext(() =>
    requiresSignIn(target)(route, {} as RouterStateSnapshot),
  );
  const settled = isObservable(answer) ? await firstValueFrom(answer) : await answer;
  return settled instanceof UrlTree ? router.serializeUrl(settled) : settled === true;
}

describe('requiresSignIn', () => {
  it('lässt mit Konto durch', async () => {
    setUp('signedIn');
    await expect(decide()).resolves.toBe(true);
  });

  it('schickt einen Gast auf das Konto', async () => {
    setUp('guest');
    await expect(decide()).resolves.toBe('/konto');
  });

  it('schickt einen Gast auf die Seite, die die Route nennt', async () => {
    setUp('guest');
    const route = { paramMap: new Map([['slug', 'steinpilz']]) } as unknown as ActivatedRouteSnapshot;
    const target: GuestTarget = (snapshot) => `/arten/${snapshot.paramMap.get('slug') ?? ''}`;
    await expect(decide(target, route)).resolves.toBe('/arten/steinpilz');
  });

  it('wartet auf die Antwort der Sitzungsprüfung, auch mit einer gemerkten Sitzung', async () => {
    const doubles = setUp('signedIn', false);
    let result: boolean | string | null = null;
    const pending = decide().then((value) => (result = value));
    TestBed.tick();
    await Promise.resolve();
    expect(result).toBeNull();

    doubles.status.set('guest');
    doubles.checked.set(true);
    TestBed.tick();
    await pending;

    expect(result).toBe('/konto');
  });
});

describe('leaveSignedInPages', () => {
  it('verlässt eine Seite mit Konto, sobald die Sitzung endet', async () => {
    const doubles = setUp('signedIn');
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/konto/daten');
    TestBed.runInInjectionContext(leaveSignedInPages);
    TestBed.tick();

    doubles.status.set('guest');
    TestBed.inject(ApplicationRef).tick();
    await TestBed.inject(ApplicationRef).whenStable();

    expect(router.url).toBe('/konto');
  });

  it('bleibt, solange die Sitzung nur noch nicht bekannt ist', async () => {
    const doubles = setUp('unknown');
    const router = TestBed.inject(Router);
    TestBed.runInInjectionContext(leaveSignedInPages);
    TestBed.tick();
    doubles.status.set('guest');
    TestBed.tick();
    await TestBed.inject(ApplicationRef).whenStable();

    expect(router.url).toBe('/');
  });
});
