import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { AuthService } from '../../core/auth';
import { SyncService } from '../../core/offline/sync.service';
import type { SyncTask } from '../../core/offline/sync.types';
import { SPECIES_BUNDLE } from '../../testing/species-fixture';
import { AuthStub, authStubProviders } from '../../testing/auth-stub';
import { noViolations } from '../../testing/axe';
import { FIND_ENTRY, MARKER_ENTRY, SHARED_FIND_ENTRY, ZONE_ENTRY, page } from '../../testing/entries-fixture';
import { AddEntryState } from '../add-entry/add-entry.state';
import { MapState } from '../map/map.state';
import { EntriesComponent } from './entries.component';
import { EntriesState } from './entries.state';

const PENDING: SyncTask = {
  id: 'warte-eins',
  kind: 'find',
  operation: 'create',
  target: 'ziel-eins',
  conflict: false,
  body: {
    speciesId: 'maronenroehrling',
    lat: 48.5,
    lon: 9.0,
    foundOn: '2026-09-10',
    count: 2,
    note: 'unter Fichten am Hang',
    visibility: 'private',
    forTraining: false,
  },
  photos: [],
  createdAt: '2026-09-10T08:00:00+02:00',
};

/** Eine Warteschlange mit einem festen Inhalt. */
class QueueStub {
  readonly online = signal(true);

  constructor(private readonly content: readonly SyncTask[]) {}
  tasks = (): readonly SyncTask[] => this.content;
  pendingTargets = (): Set<string> => new Set(this.content.map((task) => task.target));
  pendingCount = (): number => this.content.length;
  read(): Promise<readonly SyncTask[]> {
    return Promise.resolve(this.content);
  }
  flush(): Promise<number> {
    return Promise.resolve(0);
  }
}

interface Options {
  signedIn?: boolean;
  pending?: readonly SyncTask[];
  shared?: readonly (typeof SHARED_FIND_ENTRY)[];
  own?: boolean;
}

interface Setup {
  container: Element;
  auth: AuthStub;
  queue: QueueStub;
  router: Router;
  refresh: () => void;
}

async function build(options: Options = {}): Promise<Setup> {
  const { signedIn = true, pending = [PENDING], shared = [SHARED_FIND_ENTRY], own = true } = options;
  vi.setSystemTime(new Date(2026, 8, 10, 12));
  const auth = new AuthStub();
  if (!signedIn) auth.user.set(null);
  const queue = new QueueStub(pending);
  const { container, detectChanges } = await render(EntriesComponent, {
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      // Ohne Route ginge jede Navigation ins Leere; der Reiter führt auf die Karte.
      provideRouter([{ path: '**', children: [] }]),
      { provide: SyncService, useValue: queue },
      ...authStubProviders(auth),
    ],
  });
  const http = TestBed.inject(HttpTestingController);
  await vi.waitFor(() => {
    http.expectOne('/api/species/bundle').flush(SPECIES_BUNDLE);
  });
  await vi.waitFor(() => {
    http.expectOne('/api/finds?mine=false&limit=50').flush(page(shared));
  });
  if (signedIn) {
    await vi.waitFor(() => {
      http.expectOne('/api/finds?mine=true&limit=50').flush(page(own ? [FIND_ENTRY] : []));
    });
    http.expectOne('/api/markers?limit=50').flush(page(own ? [MARKER_ENTRY] : []));
    http.expectOne('/api/zones?limit=50').flush(page(own ? [ZONE_ENTRY] : []));
  }
  // Erst wenn der Zustand steht, trägt die Liste ihre Zeilen.
  const state = TestBed.inject(EntriesState);
  await vi.waitFor(() => {
    expect(state.shared()).toHaveLength(shared.length);
    expect(state.finds()).toHaveLength(signedIn && own ? 1 : 0);
  });
  detectChanges();
  return { container, auth, queue, router: TestBed.inject(Router), refresh: detectChanges };
}

/** Wechselt das Segment über der Liste. */
async function choose(setup: Setup, segment: string): Promise<void> {
  await userEvent.click(screen.getByRole('tab', { name: segment }));
  setup.refresh();
}

describe('EintraegeComponent', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('zeigt Kopfzeile, drei Segmente und die eigenen Funde', async () => {
    const setup = await build();

    expect(screen.getByRole('heading', { name: 'Einträge' })).toBeInTheDocument();
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent.trim())).toEqual([
      'Funde',
      'Marker',
      'Zonen',
    ]);
    const row = screen.getByRole('button', { name: /Steinpilz/ });
    expect(within(row).getByText('6. Sept. · 3 Stück · Frederik')).toBeInTheDocument();
    await noViolations(setup.container);
  });

  it('stellt einen wartenden Fund mit seinem Kennzeichen nach oben', async () => {
    const setup = await build();

    const rows = setup.container.querySelectorAll('app-entry-row');
    expect(rows[0]).toHaveTextContent('Maronenröhrling');
    expect(rows[0]).toHaveTextContent('Heute · 2 Stück · Frederik');
    expect(rows[0]).toHaveTextContent('Übertragung ausstehend');

    // Ein wartender Eintrag hat noch keine Kennung vom Dienst: er öffnet nichts.
    await userEvent.click(within(rows[0] as HTMLElement).getByRole('button'));

    expect(TestBed.inject(MapState).object()).toBeNull();
  });

  it('führt fremde Funde in derselben Liste wie die eigenen', async () => {
    const setup = await build();

    const rows = [...setup.container.querySelectorAll('app-entry-row')];

    expect(rows.at(-1)).toHaveTextContent('Maronenröhrling');
    expect(rows.at(-1)).toHaveTextContent('4. Sept. · 5 Stück');
  });

  it('wechselt auf Marker und Zonen', async () => {
    const setup = await build();

    await choose(setup, 'Marker');
    expect(screen.getByText('Alter Fichtenhang')).toBeInTheDocument();
    expect(screen.getByText('Nordhang, ab Mitte September. · privat')).toBeInTheDocument();

    await choose(setup, 'Zonen');
    expect(screen.getByText('Schönbuch Nord')).toBeInTheDocument();
    expect(screen.getByText('42 ha · privat')).toBeInTheDocument();
  });

  it('öffnet einen Eintrag über der Karte', async () => {
    await build();

    await userEvent.click(screen.getByRole('button', { name: /Steinpilz/ }));

    await vi.waitFor(() => {
      expect(TestBed.inject(MapState).object()).toEqual({ kind: 'find', id: FIND_ENTRY.id });
    });
  });

  it('führt vom Kopf über die Karte in das Eintragen', async () => {
    const setup = await build();

    await userEvent.click(screen.getByRole('button', { name: 'Eintragen' }));

    await vi.waitFor(() => {
      expect(setup.router.url).toBe('/karte');
    });
    expect(TestBed.inject(AddEntryState).step()).toBe('actions');
  });

  it('meldet eine fehlende Verbindung über der Liste', async () => {
    const setup = await build();
    setup.queue.online.set(false);
    setup.refresh();

    expect(screen.getByRole('status')).toHaveTextContent('Offline');
  });

  it('bittet ohne Konto um eine Anmeldung', async () => {
    const setup = await build({ signedIn: false, pending: [], shared: [] });
    const asked = vi.spyOn(TestBed.inject(AuthService), 'requestSignIn').mockResolvedValue(true);

    expect(screen.getByText('Ohne Anmeldung keine eigenen Einträge')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Anmelden' }));

    expect(asked).toHaveBeenCalledTimes(1);
    await noViolations(setup.container);
  });

  it('sagt mit Konto nur, dass noch nichts dasteht', async () => {
    await build({ pending: [], shared: [], own: false });

    expect(screen.getByText('Noch keine Einträge')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Anmelden' })).not.toBeInTheDocument();
  });
});
