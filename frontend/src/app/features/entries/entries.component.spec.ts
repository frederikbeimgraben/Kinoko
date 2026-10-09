import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { ViewportService } from '../../core/layout/viewport.service';
import { SyncStore } from '../../core/offline/sync.store';
import type { SyncTask } from '../../core/offline/sync.types';
import { photo } from '../../testing/photos-fixture';
import { SPECIES_BUNDLE } from '../../testing/species-fixture';
import { MyImagesStore } from '../account/my-images.store';
import { AuthStub, authStubProviders } from '../../testing/auth-stub';
import { noViolations } from '../../testing/axe';
import { FIND_ENTRY, MARKER_ENTRY, SHARED_FIND_ENTRY, ZONE_ENTRY, page } from '../../testing/entries-fixture';
import { AddEntryStore } from '../add-entry/add-entry.store';
import { MapStore } from '../map/map.store';
import { EntriesComponent } from './entries.component';
import { EntriesStore } from './entries.store';

const PENDING: SyncTask = {
  id: 'task-one',
  kind: 'find',
  operation: 'create',
  target: 'target-one',
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

/** A queue with a fixed content. */
class QueueStub {
  readonly online = signal(true);
  sent = 0;

  constructor(private readonly content: readonly SyncTask[]) {}
  tasks = (): readonly SyncTask[] => this.content;
  pendingTargets = (): Set<string> => new Set(this.content.map((task) => task.target));
  pendingCount = (): number => this.content.length;
  read(): Promise<readonly SyncTask[]> {
    return Promise.resolve(this.content);
  }
  flush(): Promise<number> {
    this.sent += 1;
    return Promise.resolve(0);
  }
}

interface Options {
  signedIn?: boolean;
  pending?: readonly SyncTask[];
  shared?: readonly (typeof SHARED_FIND_ENTRY)[];
  own?: boolean;
  wide?: boolean;
}

interface Setup {
  container: Element;
  auth: AuthStub;
  queue: QueueStub;
  router: Router;
  refresh: () => void;
}

async function build(options: Options = {}): Promise<Setup> {
  const {
    signedIn = true,
    pending = [PENDING],
    shared = [SHARED_FIND_ENTRY],
    own = true,
    wide = false,
  } = options;
  vi.setSystemTime(new Date(2026, 8, 10, 12));
  const auth = new AuthStub();
  if (!signedIn) auth.user.set(null);
  const queue = new QueueStub(pending);
  const { container, detectChanges } = await render(EntriesComponent, {
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      // Without a route each navigation goes nowhere; the tab leads to the map.
      provideRouter([{ path: '**', children: [] }]),
      { provide: SyncStore, useValue: queue },
      { provide: ViewportService, useValue: { wide: signal(wide) } },
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
  // The list has its rows only when the store has its state.
  const store = TestBed.inject(EntriesStore);
  await vi.waitFor(() => {
    expect(store.shared()).toHaveLength(shared.length);
    expect(store.finds()).toHaveLength(signedIn && own ? 1 : 0);
    expect(store.loading()).toBe(false);
  });
  detectChanges();
  return { container, auth, queue, router: TestBed.inject(Router), refresh: detectChanges };
}

/** Selects a list with a chip above it. */
async function choose(setup: Setup, segment: string): Promise<void> {
  await userEvent.click(screen.getByRole('button', { name: segment }));
  setup.refresh();
}

describe('EntriesComponent', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the head, the three chips and the own finds grouped by day', async () => {
    const setup = await build();

    expect(screen.getByRole('heading', { name: 'Einträge' })).toBeInTheDocument();
    const chips = within(screen.getByRole('group', { name: 'Einträge' })).getAllByRole('button');
    expect(chips.map((chip) => chip.textContent.trim())).toEqual(['Funde', 'Marker', 'Zonen']);
    expect(chips[0]).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('September')).toBeInTheDocument();
    const row = screen.getByRole('button', { name: /Steinpilz/ });
    expect(within(row).getByText('6. Sept. · 3 Stück · Frederik')).toBeInTheDocument();
    await noViolations(setup.container);
  });

  it('puts a pending find on top with its mark and opens nothing for it', async () => {
    const setup = await build();

    const rows = setup.container.querySelectorAll('app-entry-row');
    expect(screen.getByText('Heute')).toBeInTheDocument();
    expect(rows[0]).toHaveTextContent('Maronenröhrling');
    expect(rows[0]).toHaveTextContent('2 Stück · Frederik');
    expect(rows[0].querySelector('[role="img"]')).toHaveAttribute('aria-label', 'Übertragung ausstehend');

    await userEvent.click(within(rows[0] as HTMLElement).getByRole('button'));

    expect(TestBed.inject(MapStore).object()).toBeNull();
  });

  it('shows the finds of other people in the same list', async () => {
    const setup = await build();

    const rows = [...setup.container.querySelectorAll('app-entry-row')];

    expect(rows.at(-1)).toHaveTextContent('Maronenröhrling');
    expect(rows.at(-1)).toHaveTextContent('4. Sept. · 5 Stück');
  });

  it('changes to markers and zones', async () => {
    const setup = await build();

    await choose(setup, 'Marker');
    expect(screen.getByText('Alter Fichtenhang')).toBeInTheDocument();
    expect(screen.getByText('1. Sept. · privat')).toBeInTheDocument();

    await choose(setup, 'Zonen');
    expect(screen.getByText('Schönbuch Nord')).toBeInTheDocument();
    expect(screen.getByText('42 ha · privat')).toBeInTheDocument();
  });

  it('opens an entry over the map', async () => {
    await build();

    await userEvent.click(screen.getByRole('button', { name: /Steinpilz/ }));

    await vi.waitFor(() => {
      expect(TestBed.inject(MapStore).object()).toEqual({ kind: 'find', id: FIND_ENTRY.id });
    });
  });

  it('leads from the floating button over the map into a new entry', async () => {
    const setup = await build();

    await userEvent.click(screen.getByRole('button', { name: 'Eintragen' }));

    await vi.waitFor(() => {
      expect(setup.router.url).toBe('/karte');
    });
    expect(TestBed.inject(AddEntryStore).step()).toBe('actions');
  });

  it('has no floating button on the desktop', async () => {
    await build({ wide: true });

    expect(screen.queryByRole('button', { name: 'Eintragen' })).not.toBeInTheDocument();
  });

  it('counts the pending transfers in the banner and sends them on a tap', async () => {
    const setup = await build();

    const banner = screen.getByRole('button', { name: 'Jetzt senden' });
    expect(banner).toHaveTextContent('1 Übertragung ausstehend');
    // The page already sent once after the load of the own entries.
    const before = setup.queue.sent;
    await userEvent.click(banner);

    expect(setup.queue.sent).toBe(before + 1);
  });

  it('tells about a missing connection with the count of the pending transfers', async () => {
    const setup = await build();
    setup.queue.online.set(false);
    setup.refresh();

    expect(screen.getByText('Keine Verbindung')).toBeInTheDocument();
    expect(screen.getByText('1 ausstehend')).toBeInTheDocument();
  });

  it('goes to the SSO in one tap without an account (board EntriesGuest)', async () => {
    const setup = await build({ signedIn: false, pending: [], shared: [] });

    expect(screen.getByText('Nicht angemeldet')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Filter' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Anmelden' }));

    expect(setup.auth.signIns).toEqual(['/eintraege']);
    expect(setup.auth.asked).toBe(0);
    await noViolations(setup.container);
  });

  it('reads no groups without an account', async () => {
    await build({ signedIn: false, pending: [], shared: [] });

    TestBed.inject(HttpTestingController).expectNone('/api/groups');
  });

  it('says only that nothing is there with an account', async () => {
    await build({ pending: [], shared: [], own: false });

    expect(screen.getByText('Noch keine Einträge')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Anmelden' })).not.toBeInTheDocument();
  });

  it('limits the finds with the filter and shows the zone as a chip', async () => {
    const setup = await build();
    const store = TestBed.inject(EntriesStore);

    const rows = (): number => setup.container.querySelectorAll('app-entry-row').length;
    expect(rows()).toBe(3);

    store.setFilter({ ...store.filter(), zoneId: ZONE_ENTRY.id });
    setup.refresh();

    // The find of the other person is outside the zone. The pending find always stays.
    expect(screen.getByText('Schönbuch Nord')).toBeInTheDocument();
    expect(rows()).toBe(2);

    await userEvent.click(screen.getByRole('button', { name: 'Entfernen' }));
    setup.refresh();

    expect(rows()).toBe(3);
  });

  it('reads all pages of the own photos each time the photo filter goes on', async () => {
    const setup = await build();
    const http = TestBed.inject(HttpTestingController);
    const photos =
      (cursor: string | null) => (call: { url: string; params: { get: (name: string) => string | null } }) =>
        call.url === '/api/photos' &&
        call.params.get('mine') === 'true' &&
        call.params.get('cursor') === cursor;
    // The list reads the own photos once at the start, for the thumbs of the finds.
    for (const call of http.match(photos(null))) call.flush({ items: [], nextCursor: null });

    await userEvent.click(screen.getByRole('button', { name: 'Filter' }));
    setup.refresh();
    await userEvent.click(screen.getByRole('switch', { name: 'nur mit Foto' }));

    http.expectOne(photos(null)).flush({ items: [photo({ id: 'p1', findId: null })], nextCursor: 'c2' });
    http
      .expectOne(photos('c2'))
      .flush({ items: [photo({ id: 'p2', findId: FIND_ENTRY.id })], nextCursor: null });

    expect([...TestBed.inject(MyImagesStore).findIds()]).toEqual([FIND_ENTRY.id]);
    expect(TestBed.inject(EntriesStore).filter().withPhoto).toBe(true);
  });

  it('shows the own photo of a find as the thumb of its row', async () => {
    const setup = await build({ pending: [] });
    const http = TestBed.inject(HttpTestingController);
    http
      .expectOne((call) => call.url === '/api/photos' && call.params.get('mine') === 'true')
      .flush({ items: [photo({ id: 'p9', findId: FIND_ENTRY.id, speciesId: null })], nextCursor: null });
    setup.refresh();

    await vi.waitFor(() => {
      http.expectOne('/api/photos/p9/list');
    });
  });

  it('toggles the photo filter also with a tap on the row text', async () => {
    const setup = await build();
    await userEvent.click(screen.getByRole('button', { name: 'Filter' }));
    setup.refresh();
    await userEvent.click(screen.getByRole('button', { name: 'nur mit Foto' }));

    expect(TestBed.inject(EntriesStore).filter().withPhoto).toBe(true);
  });
});
