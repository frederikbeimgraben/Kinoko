import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { AuthService } from '../../core/auth';
import { I18nService } from '../../core/i18n/i18n.service';
import { MapAppService } from '../../core/maps/map-app.service';
import { ThemeService } from '../../core/theme/theme.service';
import { APP_VERSION } from '../../core/version.generated';
import { CONFIG, ManagerDouble, authProvider, oidcUser } from '../../testing/auth-double';
import { noViolations } from '../../testing/axe';
import { PwaService } from '../../core/pwa/pwa.service';
import { AccountComponent } from './account.component';
import type { AppConfig } from '../../core/config/config.service';

interface Setup {
  container: Element;
  auth: AuthService;
  manager: ManagerDouble;
  router: Router;
  refresh: () => void;
}

async function build(signedIn = false, configuration: AppConfig | null = CONFIG): Promise<Setup> {
  const manager = new ManagerDouble();
  const { container, detectChanges } = await render(AccountComponent, {
    providers: [
      provideRouter([]),
      provideServiceWorker('ngsw-worker.js', { enabled: false }),
      ...authProvider(manager, configuration),
    ],
  });
  const auth = TestBed.inject(AuthService);
  if (signedIn) {
    manager.still = oidcUser();
    await auth.silentRenew();
    detectChanges();
  }
  return { container, auth, manager, router: TestBed.inject(Router), refresh: detectChanges };
}

/** Ein Browser, der die Installation anbietet und eine Fassung bereithält. */
function pwaProvider(): { provide: unknown; useValue: unknown } {
  const ready = signal(true);
  return {
    provide: PwaService,
    useValue: { canInstall: ready, updateReady: ready, install: () => Promise.resolve(true) },
  };
}

describe('KontoComponent', () => {
  it('bietet die Installation an und nennt die bereitstehende Fassung', async () => {
    await render(AccountComponent, {
      providers: [provideRouter([]), ...authProvider(new ManagerDouble()), pwaProvider()],
    });

    expect(screen.getByText('Als App installieren')).toBeInTheDocument();
    expect(screen.getByText('Aktualisierung bereit')).toBeInTheDocument();
  });

  it('zeigt die Zeile zum Installieren nicht, wenn der Browser nicht fragt', async () => {
    await build();

    expect(screen.queryByText('Als App installieren')).toBeNull();
    expect(screen.queryByText('Aktualisierung bereit')).toBeNull();
  });

  it('zeigt ohne Anmeldung den Weg zum SSO', async () => {
    const { container, manager } = await build();

    expect(screen.getByText('Nicht angemeldet')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Abmelden' })).not.toBeInTheDocument();
    await noViolations(container);

    await userEvent.click(screen.getByRole('button', { name: 'Anmelden' }));

    expect(manager.redirects).toEqual([{ back: '/konto' }]);
  });

  it('zeigt Name, E-Mail und Aussteller der angemeldeten Person', async () => {
    const { container, manager, auth, refresh } = await build(true);

    expect(screen.getByText('Frederik')).toBeInTheDocument();
    expect(screen.getByText('frederik@beimgraben.net')).toBeInTheDocument();
    expect(screen.getByText('sso.beimgraben.net')).toBeInTheDocument();
    await noViolations(container);

    await userEvent.click(screen.getByRole('button', { name: 'Abmelden' }));
    refresh();

    expect(manager.removed).toBe(1);
    expect(auth.signedIn()).toBe(false);
    expect(screen.getByText('Nicht angemeldet')).toBeInTheDocument();
  });

  it('schaltet die Darstellung um', async () => {
    const { refresh } = await build();
    const theme = TestBed.inject(ThemeService);

    await userEvent.click(screen.getByRole('tab', { name: 'Dunkel' }));
    refresh();

    expect(theme.choice()).toBe('dunkel');
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    expect(screen.getByRole('tab', { name: 'Dunkel' })).toHaveAttribute('aria-selected', 'true');
  });

  it('schaltet die Sprache um und merkt sie sich', async () => {
    const { refresh } = await build();
    const i18n = TestBed.inject(I18nService);

    await userEvent.click(screen.getByRole('tab', { name: 'English' }));
    // Der englische Rückfall kommt als eigener Brocken, darum das Warten.
    await vi.waitFor(() => {
      expect(document.documentElement).toHaveAttribute('lang', 'en');
    });
    refresh();

    expect(i18n.choice()).toBe('en');
    expect(localStorage.getItem('pilzkarte.sprache')).toBe('en');
    expect(screen.getByRole('tab', { name: 'English' })).toHaveAttribute('aria-selected', 'true');
  });

  it('lässt die Sprache dem Browser folgen', async () => {
    const { refresh } = await build();
    const i18n = TestBed.inject(I18nService);

    await userEvent.click(screen.getAllByRole('tab', { name: 'System' })[1]);
    refresh();

    expect(i18n.choice()).toBe('system');
  });

  it('schaltet die Karten-App um und merkt sie sich', async () => {
    const { refresh } = await build();
    const mapApp = TestBed.inject(MapAppService);

    await userEvent.click(screen.getByRole('tab', { name: 'Google Maps' }));
    refresh();

    expect(mapApp.choice()).toBe('google');
    expect(localStorage.getItem('pilzkarte.kartenApp')).toBe('google');
    expect(screen.getByRole('tab', { name: 'Google Maps' })).toHaveAttribute('aria-selected', 'true');
  });

  it('zeigt Über mit den Werten, die heute feststehen', async () => {
    await build();

    expect(screen.getByText('Methode')).toBeInTheDocument();
    expect(screen.getByText('Quellen und Lizenzen')).toBeInTheDocument();
    expect(screen.getByText(APP_VERSION)).toBeInTheDocument();
  });

  it('bleibt lesbar, wenn das Backend keine Konfiguration geliefert hat', async () => {
    await build(false, null);

    expect(screen.getByText('Nicht angemeldet')).toBeInTheDocument();
  });

  it('führt zur Methode und zu Quellen und Lizenzen', async () => {
    const { router } = await build();
    const change = vi.spyOn(router, 'navigateByUrl');

    await userEvent.click(screen.getByText('Methode'));
    await userEvent.click(screen.getByText('Quellen und Lizenzen'));

    expect(change).toHaveBeenCalledWith('/konto/methode');
    expect(change).toHaveBeenCalledWith('/konto/lizenzen');
  });

  it('zeigt Meine Daten nur angemeldet und führt dorthin', async () => {
    const { router } = await build(true);
    const change = vi.spyOn(router, 'navigateByUrl');

    await userEvent.click(screen.getByText('Meine Daten'));

    expect(change).toHaveBeenCalledWith('/konto/daten');
  });

  it('zeigt Meine Daten nicht ohne Anmeldung', async () => {
    await build();

    expect(screen.queryByText('Meine Daten')).toBeNull();
  });

  it('zeigt einen Issuer ohne URL-Form so, wie er kommt', async () => {
    await build(true, { ...CONFIG, oidcIssuer: 'sso.beimgraben.net' });

    expect(screen.getByText('frederik@beimgraben.net')).toBeInTheDocument();
    expect(screen.getAllByText('sso.beimgraben.net')).toHaveLength(1);
  });

  it('führt über Schließen auf die Karte', async () => {
    const { router } = await build();
    const change = vi.spyOn(router, 'navigateByUrl');

    await userEvent.click(screen.getByRole('button', { name: 'Schließen' }));

    expect(change).toHaveBeenCalledWith('/karte');
  });
});
