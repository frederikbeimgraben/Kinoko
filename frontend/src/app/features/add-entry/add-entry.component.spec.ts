import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal, type Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { ViewportService } from '../../core/layout/viewport.service';
import { MapState } from '../map/map.state';
import { MAP_ADAPTER } from '../../map/map.tokens';
import { SPECIES_BUNDLE } from '../../testing/species-fixture';
import { AuthStub, authStubProviders } from '../../testing/auth-stub';
import { noViolations } from '../../testing/axe';
import { FIND_ENTRY, MARKER_ENTRY, ZONE_ENTRY } from '../../testing/entries-fixture';
import { MapAdapterDouble } from '../../testing/map-doubles';
import { SyncStub, syncStubProviders } from '../../testing/sync-double';
import { toastSpy, type ToastSpy } from '../../testing/toast-spy';
import { AddEntryComponent } from './add-entry.component';
import { AddEntryState } from './add-entry.state';

/** Der Rechner: dort hängen die Aktionen als Karte am Plus-Knopf. */
const WIDE: Provider = { provide: ViewportService, useValue: { wide: signal(true) } };

interface Setup {
  container: Element;
  flow: AddEntryState;
  map: MapAdapterDouble;
  auth: AuthStub;
  queue: SyncStub;
  http: HttpTestingController;
  toasts: ToastSpy;
  refresh: () => void;
}

async function build(extra: readonly Provider[] = []): Promise<Setup> {
  const map = new MapAdapterDouble();
  const auth = new AuthStub();
  const queue = new SyncStub();
  const { container, detectChanges } = await render(AddEntryComponent, {
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: MAP_ADAPTER, useValue: map },
      ...syncStubProviders(queue),
      ...authStubProviders(auth),
      ...extra,
    ],
  });
  return {
    container,
    flow: TestBed.inject(AddEntryState),
    map,
    auth,
    queue,
    http: TestBed.inject(HttpTestingController),
    toasts: toastSpy(),
    refresh: detectChanges,
  };
}

/** Das Aktionsblatt öffnen und dort eine Zeile wählen. */
async function start(setup: Setup, row: string): Promise<void> {
  setup.flow.open();
  setup.refresh();
  await userEvent.click(screen.getByRole('button', { name: row }));
  setup.refresh();
}

/** Der Fund geht über das Fadenkreuz ins Formular, das den Katalog holt. */
async function openFindForm(setup: Setup): Promise<void> {
  await start(setup, 'Fund melden');
  await userEvent.click(screen.getByRole('button', { name: 'Fundort übernehmen' }));
  setup.refresh();
  TestBed.inject(MapState).species.set('steinpilz');
  await vi.waitFor(() => {
    setup.http.expectOne('/api/species/bundle').flush(SPECIES_BUNDLE);
  });
  setup.refresh();
}

/** Setzt drei Eckpunkte, mit denen sich eine Fläche schließen lässt. */
async function drawRing(setup: Setup): Promise<void> {
  for (const location of [
    [9.0, 48.5],
    [9.02, 48.5],
    [9.02, 48.52],
  ] as const) {
    setup.map.centerPoint = location;
    await userEvent.click(screen.getByRole('button', { name: 'Eckpunkt setzen' }));
  }
}

describe('EintragenComponent', () => {
  it('zeigt nichts, solange niemand den Plus-Knopf gedrückt hat', async () => {
    const { container } = await build();

    expect(container.querySelector('.addentry')).toBeNull();
  });

  it('zeigt die drei Aktionen des Plus-Menüs', async () => {
    const setup = await build();

    setup.flow.open();
    setup.refresh();

    expect(screen.getByRole('heading', { name: 'Eintragen' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fund melden' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Marker setzen' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Zone zeichnen' })).toBeInTheDocument();
    await noViolations(setup.container);
  });

  it('hängt die Aktionen am Rechner als Karte an den Plus-Knopf', async () => {
    const setup = await build([WIDE]);

    setup.flow.open();
    setup.refresh();

    expect(screen.getByRole('dialog', { name: 'Eintragen' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fund melden' })).toBeInTheDocument();
  });

  it('führt vom Fund über das Fadenkreuz ins Formular', async () => {
    const setup = await build();

    await start(setup, 'Fund melden');

    expect(screen.getByRole('heading', { name: 'Fundort festlegen' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Fundort festlegen' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Fundort übernehmen' }));
    setup.refresh();

    expect(setup.flow.location()).toEqual([9.05, 48.52]);
    expect(screen.getByRole('heading', { name: 'Fund melden' })).toBeInTheDocument();
  });

  it('speichert einen Fund und schließt den Ablauf', async () => {
    const setup = await build();
    await openFindForm(setup);

    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await vi.waitFor(() => {
      setup.http.expectOne('/api/finds').flush(FIND_ENTRY);
    });

    await vi.waitFor(() => {
      expect(setup.flow.step()).toBeNull();
    });
    expect(setup.toasts.success).toEqual(['Der Fund ist gespeichert.']);
  });

  it('meldet, wenn die Karte noch keinen Ort hergibt', async () => {
    const setup = await build();
    setup.map.centerPoint = null;
    await start(setup, 'Fund melden');

    await userEvent.click(screen.getByRole('button', { name: 'Fundort übernehmen' }));

    expect(setup.toasts.failure).toEqual(['Die Karte steht noch nicht.']);
    expect(setup.flow.step()).toBe('findLocation');
  });

  it('speichert einen Marker mit Name, Farbe und Sichtbarkeit', async () => {
    const setup = await build();
    await start(setup, 'Marker setzen');

    expect(screen.getByRole('heading', { name: 'Marker setzen' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Übernehmen' }));
    setup.refresh();

    await userEvent.type(screen.getByLabelText('Name'), 'Alter Fichtenhang');
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await vi.waitFor(() => {
      setup.http.expectOne('/api/markers').flush(MARKER_ENTRY);
    });

    await vi.waitFor(() => {
      expect(setup.toasts.success).toEqual(['Der Marker ist gespeichert.']);
    });
  });

  it('speichert einen Marker nicht ohne Namen', async () => {
    const setup = await build();
    await start(setup, 'Marker setzen');
    await userEvent.click(screen.getByRole('button', { name: 'Übernehmen' }));
    setup.refresh();

    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    expect(setup.toasts.failure).toEqual(['Gib dem Marker einen Namen.']);
    setup.http.expectNone('/api/markers');
  });

  it('zählt Eckpunkte und Fläche mit, während die Zone entsteht', async () => {
    const setup = await build();
    await start(setup, 'Zone zeichnen');

    expect(screen.getByRole('heading', { name: 'Zone zeichnen' })).toBeInTheDocument();
    expect(
      screen.getByText('0 Eckpunkte · 0,0 ha. Fadenkreuz auf den nächsten Eckpunkt setzen.'),
    ).toBeInTheDocument();

    await drawRing(setup);
    setup.refresh();

    await vi.waitFor(() => {
      setup.refresh();
      expect(screen.getByText(/^3 Eckpunkte · \d/)).toBeInTheDocument();
    });
  });

  it('schließt eine Zone erst ab drei Eckpunkten', async () => {
    const setup = await build();
    await start(setup, 'Zone zeichnen');

    await userEvent.click(screen.getByRole('button', { name: 'Zone abschließen' }));

    expect(setup.toasts.failure).toEqual(['Eine Zone braucht mindestens drei Eckpunkte.']);
  });

  it('speichert eine Zone mit ihrer Fläche', async () => {
    const setup = await build();
    await start(setup, 'Zone zeichnen');
    await drawRing(setup);
    await userEvent.click(screen.getByRole('button', { name: 'Zone abschließen' }));
    setup.refresh();

    await userEvent.type(screen.getByLabelText('Name'), 'Schönbuch Nord');
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    const request = await vi.waitFor(() => setup.http.expectOne('/api/zones'));
    expect(
      (request.request.body as { polygon: { coordinates: number[][][] } }).polygon.coordinates[0],
    ).toHaveLength(4);
    request.flush(ZONE_ENTRY);

    await vi.waitFor(() => {
      expect(setup.toasts.success).toEqual(['Die Zone ist gespeichert.']);
    });
  });

  it('stellt einen Fund an, wenn niemand sich anmelden will', async () => {
    const setup = await build();
    setup.auth.reply = false;
    await openFindForm(setup);

    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    await vi.waitFor(() => {
      expect(setup.queue.stored.map((task) => task.kind)).toEqual(['find']);
    });
    expect(setup.toasts.success).toEqual(['Der Fund wartet auf die Übertragung.']);
  });

  it('bricht ab und lässt nichts stehen', async () => {
    const setup = await build();
    await start(setup, 'Fund melden');

    await userEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));

    expect(setup.flow.step()).toBeNull();
  });
});
