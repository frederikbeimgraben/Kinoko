import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import type { Map as MapLibreMap } from 'maplibre-gl';
import userEvent from '@testing-library/user-event';
import { MAP_ADAPTER } from '../../map/map.tokens';
import { SPECIES_BUNDLE } from '../../testing/species-fixture';
import { AuthStub, authStubProviders } from '../../testing/auth-stub';
import { noViolations } from '../../testing/axe';
import { ME } from '../../testing/access-fixture';
import {
  FIND,
  FIND_ENTRY,
  MARKER,
  MARKER_ENTRY,
  ZONE,
  ZONE_ENTRY,
  page,
} from '../../testing/entries-fixture';
import { MapAdapterDouble, RAW_MANIFEST } from '../../testing/map-doubles';
import { SpeciesStore } from '../species/species.store';
import { EntriesStore } from '../entries/entries.store';
import { MapStore } from '../map/map.store';
import { ObjectSheetComponent } from './object-sheet.component';
import { ObjectSheetStore } from './object-sheet.store';

interface Setup {
  container: Element;
  map: MapAdapterDouble;
  state: MapStore;
  router: Router;
  http: HttpTestingController;
  refresh: () => void;
}

async function build(findEntry = FIND_ENTRY): Promise<Setup> {
  vi.stubGlobal('fetch', () =>
    Promise.resolve({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: () => Promise.resolve(RAW_MANIFEST),
    }),
  );
  const map = new MapAdapterDouble();
  const { container, detectChanges } = await render(ObjectSheetComponent, {
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([]),
      { provide: MAP_ADAPTER, useValue: map },
      ...authStubProviders(new AuthStub()),
    ],
  });
  const http = TestBed.inject(HttpTestingController);
  // Set the catalogue before the sheet. If not, its name comes after the test.
  const katalog = TestBed.inject(SpeciesStore).loadBundle();
  await vi.waitFor(() => {
    http.expectOne('/api/species/bundle').flush(SPECIES_BUNDLE);
  });
  await katalog;
  const eintraege = TestBed.inject(EntriesStore);
  const loaded = eintraege.load();
  await vi.waitFor(() => {
    http.expectOne('/api/finds?mine=true&limit=50').flush(page([findEntry]));
  });
  http.expectOne('/api/markers?limit=50').flush(page([MARKER_ENTRY]));
  http.expectOne('/api/zones?limit=50').flush(page([ZONE_ENTRY]));
  await loaded;
  detectChanges();
  return {
    container,
    map,
    state: TestBed.inject(MapStore),
    router: TestBed.inject(Router),
    http,
    refresh: detectChanges,
  };
}

/** The close button in the head of the sheet, not the scrim below it. */
function sheetClose(container: Element): HTMLElement {
  const close = container.querySelector<HTMLElement>('.overlay-head__close');
  if (close === null) throw new Error('Das Blatt trägt kein X.');
  return close;
}

/** Opens the find of the fixture. The sheet of the find resolves the account. */
async function openFind(setup: Setup, id = FIND.id): Promise<void> {
  setup.state.setObject({ kind: 'find', id });
  setup.refresh();
  await vi.waitFor(() => {
    setup.http.expectOne('/api/me').flush(ME);
  });
  setup.refresh();
}

describe('ObjektBlattComponent', () => {
  it('zeigt nichts, solange kein Objekt in der Adresse steht', async () => {
    const setup = await build();

    expect(setup.container.querySelector('app-sheet')).toBeNull();
  });

  it('öffnet den Fund aus der Adresse und trägt Art, Zeile und Kennzeichen im Rumpf', async () => {
    const setup = await build();

    await openFind(setup);

    expect(screen.getByRole('heading', { name: 'Fund' })).toBeInTheDocument();
    expect(screen.getByText('Steinpilz')).toBeInTheDocument();
    expect(screen.getByText('6. September 2026 · 3 Stück · Frederik')).toBeInTheDocument();
    expect(screen.getByText('geteilt')).toBeInTheDocument();
    await noViolations(setup.container);
  });

  it('lässt die Anzahl in der Zeile weg, wenn der Fund keine trägt', async () => {
    const setup = await build({ ...FIND_ENTRY, count: null });

    await openFind(setup);

    expect(screen.getByText('6. September 2026 · Frederik')).toBeInTheDocument();
  });

  it('nennt den Melder eines geteilten Fundes, wenn eine Gruppe ihn auflöst', async () => {
    const setup = await build({ ...FIND_ENTRY, ownerId: 'konto-zwei' });

    await openFind(setup);

    await vi.waitFor(() => {
      setup.http.expectOne('/api/people/names?ids=konto-zwei').flush([{ id: 'konto-zwei', name: 'Jonas' }]);
    });

    await vi.waitFor(() => {
      setup.refresh();
      expect(screen.getByText('6. September 2026 · 3 Stück · Jonas')).toBeInTheDocument();
    });
  });

  it('lässt den Melder weg, wenn keine Gruppe ihn auflöst', async () => {
    const setup = await build({ ...FIND_ENTRY, ownerId: 'konto-zwei' });

    await openFind(setup);

    await vi.waitFor(() => {
      setup.http.expectOne('/api/people/names?ids=konto-zwei').flush([]);
    });

    await vi.waitFor(() => {
      setup.refresh();
      expect(screen.getByText('6. September 2026 · 3 Stück')).toBeInTheDocument();
    });
  });

  it('öffnet Marker und Zone aus derselben Adresse', async () => {
    const setup = await build();

    setup.state.setObject({ kind: 'marker', id: MARKER.id });
    setup.refresh();
    expect(screen.getByRole('heading', { name: 'Marker' })).toBeInTheDocument();
    expect(screen.getByText('Alter Fichtenhang')).toBeInTheDocument();

    setup.state.setObject({ kind: 'zone', id: ZONE.id });
    setup.refresh();
    expect(screen.getByRole('heading', { name: 'Zone' })).toBeInTheDocument();
    expect(screen.getByText('Schönbuch Nord')).toBeInTheDocument();
    expect(screen.getByText('Zone · 42 ha · privat')).toBeInTheDocument();
  });

  it('nimmt die Höhe seines Inhalts, für jede Art des Objekts', async () => {
    const setup = await build();

    setup.state.setObject({ kind: 'marker', id: MARKER.id });
    setup.refresh();
    expect(setup.container.querySelector<HTMLElement>('.sheet')?.style.blockSize).toBe('auto');

    await openFind(setup);
    expect(setup.container.querySelector<HTMLElement>('.sheet')?.style.blockSize).toBe('auto');

    setup.state.setObject({ kind: 'zone', id: ZONE.id });
    setup.refresh();
    expect(setup.container.querySelector<HTMLElement>('.sheet')?.style.blockSize).toBe('auto');
  });

  it('dunkelt die Karte für das Formular des Fundes ab', async () => {
    const setup = await build();
    await openFind(setup);

    await userEvent.click(screen.getByRole('button', { name: 'Bearbeiten' }));
    setup.refresh();

    expect(setup.container.querySelector('.overlay__scrim--modal')).not.toBeNull();
  });

  it('keeps the map bright and lets taps through to it while zone corners move', async () => {
    const setup = await build();
    setup.state.setObject({ kind: 'zone', id: ZONE.id });
    setup.refresh();
    expect(setup.container.querySelector('.overlay__scrim--modal')).not.toBeNull();

    TestBed.inject(ObjectSheetStore).setEditingCorners(true);
    setup.refresh();

    expect(setup.container.querySelector('.overlay__scrim--modal')).toBeNull();
    expect(setup.container.querySelector('app-overlay-host')).toHaveClass('object--corners');
    const scrim = setup.container.querySelector('.overlay__scrim');
    if (scrim === null) throw new Error('The scrim is missing.');
    expect(getComputedStyle(scrim).pointerEvents).toBe('none');
  });

  it('trägt im Formular den Titel des Formulars und den Ort im Kopf', async () => {
    const setup = await build();
    await openFind(setup);

    await userEvent.click(screen.getByRole('button', { name: 'Bearbeiten' }));
    setup.refresh();

    expect(screen.getByRole('heading', { name: 'Fund bearbeiten' })).toBeInTheDocument();
    expect(screen.getByText('48,5203 · 9,0511')).toBeInTheDocument();
  });

  it('führt das X aus dem Formular zurück zum Objekt und dann erst hinaus', async () => {
    const setup = await build();
    setup.state.setObject({ kind: 'marker', id: MARKER.id });
    setup.refresh();
    await userEvent.click(screen.getByRole('button', { name: 'Bearbeiten' }));
    setup.refresh();

    await userEvent.click(sheetClose(setup.container));
    setup.refresh();

    expect(screen.getByRole('heading', { name: 'Marker' })).toBeInTheDocument();
    expect(screen.getByText('Alter Fichtenhang')).toBeInTheDocument();

    await userEvent.click(sheetClose(setup.container));
    setup.refresh();

    expect(setup.state.object()).toBeNull();
  });

  it('sagt es, wenn den Eintrag niemand mehr kennt', async () => {
    const setup = await build();

    setup.state.setObject({ kind: 'find', id: 'weg' });
    setup.refresh();

    expect(screen.getByText('Diesen Eintrag gibt es nicht mehr.')).toBeInTheDocument();
  });

  it('zoomt die Karte auf das Objekt, sobald es offen ist', async () => {
    const setup = await build();

    setup.state.setObject({ kind: 'marker', id: MARKER.id });
    setup.refresh();

    expect(setup.map.flights).toHaveLength(1);
    expect(setup.map.flights[0].target).toEqual([MARKER.lon, MARKER.lat]);
    expect(setup.map.flights[0].zoom).toBe(14);
  });

  it('zeigt bei einer Zone den ganzen Umriss', async () => {
    const setup = await build();
    const fits: unknown[][] = [];
    setup.map.raw = { fitBounds: (...args: unknown[]) => fits.push(args) } as unknown as MapLibreMap;
    const ring = ZONE.polygon.coordinates[0];

    setup.state.setObject({ kind: 'zone', id: ZONE.id });
    setup.refresh();

    expect(setup.map.flights).toHaveLength(0);
    await vi.waitFor(() => {
      expect(fits).not.toHaveLength(0);
    });
    expect(fits[0][0]).toEqual([
      [Math.min(...ring.map((point) => point[0])), Math.min(...ring.map((point) => point[1]))],
      [Math.max(...ring.map((point) => point[0])), Math.max(...ring.map((point) => point[1]))],
    ]);
  });

  it('lässt die Karte stehen, wenn das Objekt niemand mehr kennt', async () => {
    const setup = await build();

    setup.state.setObject({ kind: 'find', id: 'weg' });
    setup.refresh();

    expect(setup.map.flights).toHaveLength(0);
  });

  it('schließt, wenn ein Objekt gelöscht wurde', async () => {
    const setup = await build();
    setup.state.setObject({ kind: 'marker', id: MARKER.id });
    setup.refresh();

    await userEvent.click(screen.getByRole('button', { name: 'Löschen' }));
    setup.refresh();
    await userEvent.click(screen.getAllByRole('button', { name: 'Löschen' })[1]);
    await vi.waitFor(() => {
      setup.http.expectOne(`/api/markers/${MARKER.id}`).flush(null);
    });

    await vi.waitFor(() => {
      expect(setup.router.url).not.toContain('objekt=');
    });
  });
});
