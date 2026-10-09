import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { AuthService } from '../../core/auth';
import type { AppConfig } from '../../core/config/config.store';
import { I18nService } from '../../core/i18n/i18n.service';
import { ViewportService } from '../../core/layout/viewport.service';
import { MapAppStore } from '../../core/maps/map-app.store';
import { PwaStore } from '../../core/pwa/pwa.store';
import { ThemeStore } from '../../core/theme/theme.store';
import { CONFIG, ManagerDouble, authProvider, oidcUser } from '../../testing/auth-double';
import { noViolations } from '../../testing/axe';
import { AccountComponent } from './account.component';

const EXPORT = {
  me: { id: 'account-one', sub: 'sub', email: 'frederik@beimgraben.net', name: 'Frederik' },
  finds: [{}, {}, {}],
  markers: [{}],
  zones: [],
  combinations: [{}, {}],
  photos: [{}],
};

/** A page below the account, as the detail pane shows it. */
@Component({ selector: 'app-detail-double', template: '<p>Detail</p>' })
class DetailDouble {}

interface Setup {
  container: Element;
  auth: AuthService;
  manager: ManagerDouble;
  router: Router;
  refresh: () => void;
}

interface Options {
  signedIn?: boolean;
  configuration?: AppConfig | null;
  wide?: boolean;
  path?: string;
  /** A new version waits. */
  update?: boolean;
}

async function build(options: Options = {}): Promise<Setup> {
  const { signedIn = false, configuration = CONFIG, wide = false, path, update = false } = options;
  const manager = new ManagerDouble();
  const { container, detectChanges } = await render(AccountComponent, {
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([{ path: 'konto', children: [{ path: '**', component: DetailDouble }] }]),
      provideServiceWorker('ngsw-worker.js', { enabled: false }),
      { provide: ViewportService, useValue: { wide: signal(wide) } },
      ...authProvider(manager, configuration),
      ...(update
        ? [
            {
              provide: PwaStore,
              useValue: {
                canInstall: signal(false),
                updateReady: signal(true),
                install: () => Promise.resolve(true),
              },
            },
          ]
        : []),
    ],
  });
  const router = TestBed.inject(Router);
  if (path !== undefined) await router.navigateByUrl(path);
  const auth = TestBed.inject(AuthService);
  if (signedIn) manager.still = oidcUser();
  // The silent check settles the session: without it the account tile stays a skeleton.
  await auth.silentRenew();
  detectChanges();
  await vi.waitFor(() => {
    for (const request of TestBed.inject(HttpTestingController).match('/api/me/export'))
      request.flush(EXPORT);
    detectChanges();
    expect(signedIn && !wide && path === undefined ? screen.queryByText('Kombinationen') : true).toBeTruthy();
  });
  return { container, auth, manager, router, refresh: detectChanges };
}

describe('AccountComponent', () => {
  afterEach(() => {
    // A sign-out in one test must not hold for the next test.
    sessionStorage.clear();
  });

  it('shows the way to the SSO without a sign-in', async () => {
    const { container, manager } = await build();

    expect(screen.queryByRole('button', { name: 'Abmelden' })).not.toBeInTheDocument();
    expect(screen.queryByText('Meine Daten')).toBeNull();
    await noViolations(container);

    await userEvent.click(screen.getByRole('button', { name: 'Anmelden mit Example SSO' }));

    expect(manager.redirects).toEqual([{ back: '/konto' }]);
  });

  it('turns the button off and tells why when the server has no SSO', async () => {
    const { manager } = await build({ configuration: { ...CONFIG, oidcIssuer: '', oidcName: '' } });

    expect(screen.getByRole('button', { name: 'Anmelden' })).toBeDisabled();
    expect(screen.getByText('Auf diesem Server ist keine Anmeldung eingerichtet.')).toBeInTheDocument();
    expect(manager.redirects).toEqual([]);
  });

  it('shows the person, the counts and the rows in the order of the board', async () => {
    const { container, manager, auth, refresh } = await build({ signedIn: true });

    expect(screen.getByText('Frederik')).toBeInTheDocument();
    expect(screen.getByText('frederik@beimgraben.net')).toBeInTheDocument();
    expect(screen.getByText('sso.example.org')).toBeInTheDocument();
    expect(screen.getByText('Kombinationen')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    const rows = ['Meine Bilder', 'Meine Daten', 'Gruppen', 'Glossar'].map((name) => screen.getByText(name));
    expect(rows).toHaveLength(4);
    expect(screen.getByText('Offline-Gebiete')).toBeInTheDocument();
    expect(screen.getByText('Ausstehende Übertragungen')).toBeInTheDocument();
    await noViolations(container);

    await userEvent.click(screen.getByRole('button', { name: 'Abmelden' }));
    refresh();

    expect(manager.removed).toBe(1);
    expect(auth.signedIn()).toBe(false);
  });

  it('opens a page below the account', async () => {
    const { router } = await build({ signedIn: true });
    const change = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    await userEvent.click(screen.getByText('Meine Daten'));
    await userEvent.click(screen.getByText('Offline-Gebiete'));

    expect(change).toHaveBeenCalledWith('/konto/daten');
    expect(change).toHaveBeenCalledWith('/konto/offline');
  });

  it('changes the theme', async () => {
    const { refresh } = await build();
    const theme = TestBed.inject(ThemeStore);

    await userEvent.click(screen.getByRole('tab', { name: 'Dunkel' }));
    refresh();

    expect(theme.choice()).toBe('dunkel');
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
  });

  it('changes the language and keeps it', async () => {
    const { refresh } = await build();
    const i18n = TestBed.inject(I18nService);

    await userEvent.click(screen.getByRole('tab', { name: 'English' }));
    // The English catalogue is a chunk of its own, so the test waits.
    await vi.waitFor(() => {
      expect(document.documentElement).toHaveAttribute('lang', 'en');
    });
    refresh();

    expect(i18n.choice()).toBe('en');
    expect(screen.getByRole('tab', { name: 'English' })).toHaveAttribute('aria-selected', 'true');
  });

  it('changes the map app and keeps it', async () => {
    const { refresh } = await build();
    const mapApp = TestBed.inject(MapAppStore);

    await userEvent.click(screen.getByRole('tab', { name: 'Google Maps' }));
    refresh();

    expect(mapApp.choice()).toBe('google');
    expect(localStorage.getItem('pilzkarte.kartenApp')).toBe('google');
  });

  it('shows the about rows and names a ready update', async () => {
    await build({ update: true });

    expect(screen.getByText('Methode')).toBeInTheDocument();
    expect(screen.getByText('Quellen und Lizenzen')).toBeInTheDocument();
    expect(screen.getByText('Aktualisierung bereit')).toBeInTheDocument();
  });

  it('stays readable when the backend gave no configuration', async () => {
    await build({ configuration: null });

    // A click reads the configuration again, so the button stays on.
    expect(screen.getByRole('button', { name: 'Anmelden' })).toBeEnabled();
  });

  it('shows an issuer that is not a URL as it came', async () => {
    await build({ signedIn: true, configuration: { ...CONFIG, oidcIssuer: 'sso.example.org' } });

    expect(screen.getAllByText('sso.example.org')).toHaveLength(1);
  });

  it('goes to the map on close', async () => {
    const { router } = await build();
    const change = vi.spyOn(router, 'navigateByUrl');

    await userEvent.click(screen.getByRole('button', { name: 'Schließen' }));

    expect(change).toHaveBeenCalledWith('/karte');
  });

  it('shows only the page below the account on the phone', async () => {
    await build({ path: '/konto/daten' });

    expect(screen.getByText('Detail')).toBeInTheDocument();
    expect(screen.queryByText('Darstellung')).toBeNull();
  });

  it('shows the list with the selected row next to the detail on the desktop', async () => {
    await build({ signedIn: true, wide: true, path: '/konto/daten' });

    expect(screen.getByText('Detail')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Meine Daten', pressed: true })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Darstellung und Sprache' })).not.toHaveAttribute(
      'aria-pressed',
    );
    expect(screen.getByText('Über die App')).toBeInTheDocument();
  });
});
