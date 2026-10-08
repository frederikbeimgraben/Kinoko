import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { DeferBlockBehavior, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';
import { render, screen } from '@testing-library/angular';
import { AuthService } from '../core/auth';
import { PwaStore } from '../core/pwa/pwa.store';
import { ViewportService } from '../core/layout/viewport.service';
import { MapRouteComponent } from '../features/map/map-route.component';
import { SyncStub, syncStubProviders } from '../testing/sync-double';
import { ManagerDouble, authProvider, oidcUser } from '../testing/auth-double';
import { mapWithDoubles, answerManifest, type MapAdapterDouble } from '../testing/map-doubles';
import { noViolations } from '../testing/axe';
import { ShellComponent } from './shell.component';

@Component({
  selector: 'app-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<h1>Seite</h1>',
})
class PageComponent {}

const ROUTES = [
  { path: 'anmeldung', component: PageComponent },
  { path: 'bausteine', component: PageComponent },
  { path: 'karte', component: PageComponent },
  { path: 'arten', component: PageComponent },
  { path: 'arten/:slug', component: PageComponent },
  { path: 'arten/:slug/bilder/:id', component: PageComponent },
  { path: 'eintraege', component: PageComponent },
  { path: 'konto', component: PageComponent },
  { path: 'verwaltung/bilder', component: PageComponent },
  { path: '', pathMatch: 'full' as const, redirectTo: 'karte' },
];

/** A new double for each test, so a sign-in does not go into the next test. */
async function shell(updateReady = false) {
  const manager = new ManagerDouble();
  const sync = new SyncStub();
  const result = await render(ShellComponent, {
    providers: [
      provideRouter(ROUTES),
      provideServiceWorker('ngsw-worker.js', { enabled: false }),
      ...authProvider(manager),
      ...syncStubProviders(sync),
      {
        provide: PwaStore,
        useValue: { updateReady: signal(updateReady), activate: () => Promise.resolve() },
      },
    ],
  });
  return { ...result, manager, sync };
}

describe('ShellComponent', () => {
  it('hides the nav on the workshop page', async () => {
    const { navigate } = await shell();

    await navigate('/bausteine');

    expect(screen.queryByRole('navigation', { name: 'Hauptbereiche' })).toBeNull();
  });

  it('hides the nav on an image page', async () => {
    const { navigate } = await shell();

    await navigate('/arten/boletus-edulis/bilder/eins');

    expect(screen.queryByRole('navigation', { name: 'Hauptbereiche' })).toBeNull();
  });

  it('hides the nav in the review queue', async () => {
    const { navigate } = await shell();

    await navigate('/verwaltung/bilder');

    expect(screen.queryByRole('navigation', { name: 'Hauptbereiche' })).toBeNull();
  });

  it('hides the nav on the species page', async () => {
    const { navigate } = await shell();

    await navigate('/arten/boletus-edulis');

    expect(screen.queryByRole('navigation', { name: 'Hauptbereiche' })).toBeNull();
  });

  it('keeps the nav on the return from SSO and after it', async () => {
    const { navigate } = await shell();

    await navigate('/anmeldung?code=eins&state=zwei');
    expect(screen.getByRole('navigation', { name: 'Hauptbereiche' })).toBeInTheDocument();

    await navigate('/karte');
    expect(screen.getByRole('navigation', { name: 'Hauptbereiche' })).toBeInTheDocument();
  });

  it('hides the nav on the settings root', async () => {
    const { navigate } = await shell();

    await navigate('/konto');

    expect(screen.queryByRole('navigation', { name: 'Hauptbereiche' })).toBeNull();
  });

  it('keeps the nav on the species tab', async () => {
    const { navigate } = await shell();

    await navigate('/arten');

    expect(screen.getByRole('navigation', { name: 'Hauptbereiche' })).toBeInTheDocument();
  });

  it('shows the three tabs and the avatar over the map', async () => {
    const { container, navigate } = await shell();
    await navigate('/karte');

    expect(screen.getByRole('navigation', { name: 'Hauptbereiche' })).toBeInTheDocument();
    for (const name of ['Karte', 'Arten', 'Einträge']) {
      expect(screen.getByRole('link', { name })).toBeInTheDocument();
    }
    expect(screen.getByRole('link', { name: 'Karte' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Konto' })).toBeInTheDocument();
    await noViolations(container);
  });

  it('floats the update banner over the map and moves the avatar down', async () => {
    const { container, navigate } = await shell(true);
    await navigate('/karte');

    expect(screen.getByRole('button', { name: 'Neu laden' })).toHaveTextContent('Neue Version');
    expect(container.querySelector('app-banner')).toHaveClass('shell__banner--float');
    expect(container.querySelector('.shell')).toHaveStyle({
      '--top-bar-height': 'calc(48px + env(safe-area-inset-top, 0px))',
    });
  });

  it('puts the update banner above the nav outside the map, with no offset', async () => {
    const { container, navigate } = await shell(true);
    await navigate('/arten');

    const banner = container.querySelector('app-banner');
    expect(banner).toHaveClass('shell__banner');
    expect(banner).not.toHaveClass('shell__banner--float');
    expect(container.querySelector('.shell')).toHaveStyle({ '--top-bar-height': '0px' });
  });

  it('shows no banner without a new version', async () => {
    await shell(false);

    expect(screen.queryByRole('status')).toBeNull();
  });

  it('moves the avatar down for the offline banner of the map', async () => {
    const { container, navigate, sync, detectChanges } = await shell();
    await navigate('/karte');
    sync.online.set(false);
    detectChanges();

    expect(container.querySelector('.shell')).toHaveStyle({
      '--top-bar-height': 'calc(48px + env(safe-area-inset-top, 0px))',
    });
    expect(screen.getByRole('button', { name: 'Konto' })).toBeInTheDocument();
  });

  it('gives no offset on another tab when the map is offline', async () => {
    const { container, navigate, sync, detectChanges } = await shell();
    await navigate('/arten');
    sync.online.set(false);
    detectChanges();

    expect(container.querySelector('.shell')).toHaveStyle({ '--top-bar-height': '0px' });
  });

  it('marks the tab for an address with a query', async () => {
    const { navigate } = await shell();

    await navigate('/karte?art=pfifferling&kw=2025-40');

    expect(screen.getByRole('link', { name: 'Karte' })).toHaveAttribute('aria-current', 'page');
  });

  it('shows the avatar only over the map', async () => {
    const { navigate } = await shell();

    await navigate('/arten');

    expect(screen.getByRole('link', { name: 'Arten' })).toHaveAttribute('aria-current', 'page');
    expect(screen.queryByRole('button', { name: 'Konto' })).not.toBeInTheDocument();
  });

  it('shows the first letter of the name on the avatar when signed in', async () => {
    const { navigate, detectChanges, manager } = await shell();
    await navigate('/karte');
    manager.still = oidcUser();

    await TestBed.inject(AuthService).silentRenew();
    detectChanges();

    expect(screen.getByRole('button', { name: 'Konto von Frederik' })).toHaveTextContent('F');
  });

  it('opens the account from the avatar', async () => {
    const { navigate, fixture } = await shell();
    await navigate('/karte');

    screen.getByRole('button', { name: 'Konto' }).click();
    await fixture.whenStable();

    expect(screen.queryByRole('button', { name: 'Konto' })).not.toBeInTheDocument();
  });
});

/** On the desktop the map is in the shell; the route gives no content there. */
const WIDE_ROUTES = [
  { path: 'karte', component: MapRouteComponent },
  { path: 'arten', component: PageComponent },
  { path: 'eintraege', component: PageComponent },
  { path: '', pathMatch: 'full' as const, redirectTo: 'karte' },
];

async function wideShell(): Promise<{
  double: MapAdapterDouble;
  navigate: (path: string) => Promise<boolean>;
  detectChanges: () => void;
  container: Element;
}> {
  answerManifest();
  const { map: double } = mapWithDoubles();
  const { navigate, detectChanges, container, fixture } = await render(ShellComponent, {
    // The map is in a `@defer` block, so it is not in the first phone bundle.
    // The test runs the block as the browser does.
    deferBlockBehavior: DeferBlockBehavior.Playthrough,
    providers: [
      provideRouter(WIDE_ROUTES),
      provideServiceWorker('ngsw-worker.js', { enabled: false }),
      ...authProvider(new ManagerDouble()),
      { provide: ViewportService, useValue: { wide: signal(true) } },
    ],
  });
  await navigate('/karte');
  await fixture.whenStable();
  detectChanges();
  return { double, navigate, detectChanges, container };
}

describe('ShellComponent on the desktop', () => {
  it('puts the map next to the column and keeps it when the tab changes', async () => {
    const { double, navigate, detectChanges, container } = await wideShell();

    expect(double.started).toBe(1);
    expect(container.querySelector('.map__column')).not.toBeNull();

    await navigate('/arten');
    detectChanges();
    await navigate('/eintraege');
    detectChanges();

    // No second start means no new tile load and no second adapter.
    expect(double.started).toBe(1);
    expect(double.destroyed).toBe(false);
    expect(screen.getByRole('region', { name: 'Karte von Deutschland' })).toBeInTheDocument();
  });

  it('gives each section the width of its kit pane', async () => {
    const { navigate, detectChanges, container } = await wideShell();
    const frame = container.querySelector('.shell');
    const content = container.querySelector('.shell__content');
    const column = (): string => document.documentElement.style.getPropertyValue('--size-column');

    expect(frame).toHaveAttribute('data-pane', 'panel');
    expect(column()).toBe('var(--w-pane-panel)');

    await navigate('/arten');
    detectChanges();
    expect(frame).toHaveAttribute('data-pane', 'middle');
    expect(content).toHaveClass('shell__content--full');
    expect(column()).toBe('var(--w-pane-middle)');

    await navigate('/eintraege');
    detectChanges();
    expect(frame).toHaveAttribute('data-pane', 'list');
    expect(content).not.toHaveClass('shell__content--full');
    expect(column()).toBe('var(--w-pane-list)');
    document.documentElement.style.removeProperty('--size-column');
  });

  it('shows no floating avatar, because the rail holds it', async () => {
    const { container } = await wideShell();

    expect(container.querySelector('.shell__avatar')).toBeNull();
    expect(container.querySelector('.shell__nav app-avatar-button')).not.toBeNull();
  });

  it('shows the sheet only on the map tab and the map buttons always', async () => {
    const { navigate, detectChanges, container } = await wideShell();

    await navigate('/arten');
    detectChanges();

    // On another tab the column belongs to that tab: a hidden sheet stays in the tab order.
    // The buttons belong to the map, which stays open on the right.
    expect(container.querySelector('.map__sheet')).toBeNull();
    expect(container.querySelector('.map__buttons')).not.toBeNull();
  });
});

/** On the phone the map is in the shell as on the desktop; the route gives no content there. */
const PHONE_ROUTES = [
  { path: 'karte', component: MapRouteComponent },
  { path: 'arten', component: PageComponent },
  { path: '', pathMatch: 'full' as const, redirectTo: 'karte' },
];

async function phoneShell(): Promise<{
  double: MapAdapterDouble;
  navigate: (path: string) => Promise<boolean>;
  detectChanges: () => void;
  container: Element;
  stable: () => Promise<void>;
}> {
  answerManifest();
  const { map: double } = mapWithDoubles();
  const { navigate, detectChanges, container, fixture } = await render(ShellComponent, {
    deferBlockBehavior: DeferBlockBehavior.Playthrough,
    providers: [
      provideRouter(PHONE_ROUTES),
      provideServiceWorker('ngsw-worker.js', { enabled: false }),
      ...authProvider(new ManagerDouble()),
      { provide: ViewportService, useValue: { wide: signal(false) } },
    ],
  });
  const stable = async (): Promise<void> => {
    await fixture.whenStable();
    detectChanges();
  };
  return { double, navigate, detectChanges, container, stable };
}

describe('ShellComponent on the phone', () => {
  it('keeps the map in memory from map to species to map', async () => {
    const { navigate, detectChanges, container, stable } = await phoneShell();

    await navigate('/karte');
    await stable();
    const map = container.querySelector('app-map');
    expect(map).not.toBeNull();
    expect(screen.getByRole('region', { name: 'Karte von Deutschland' })).toBeInTheDocument();

    await navigate('/arten');
    detectChanges();
    // The same element means no new tile load and no second map.
    expect(container.querySelector('app-map')).toBe(map);
    expect(screen.queryByRole('region', { name: 'Karte von Deutschland' })).not.toBeInTheDocument();
    expect(map).toHaveClass('shell__map--hidden');

    await navigate('/karte');
    detectChanges();
    expect(container.querySelector('app-map')).toBe(map);
    expect(screen.getByRole('region', { name: 'Karte von Deutschland' })).toBeInTheDocument();
  });

  it('does not load the map when species is the first tab', async () => {
    const { double, navigate } = await phoneShell();

    await navigate('/arten');

    expect(double.started).toBe(0);
    expect(screen.queryByRole('region', { name: 'Karte von Deutschland' })).not.toBeInTheDocument();
  });
});
