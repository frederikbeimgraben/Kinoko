import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
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
import { SpeciesState } from '../species/species.state';
import { EntriesState } from '../entries/entries.state';
import { MapState } from '../map/map.state';
import { ObjectSheetComponent } from './object-sheet.component';

interface Setup {
  container: Element;
  map: MapAdapterDouble;
  state: MapState;
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
  // Der Katalog steht vor dem Blatt: sonst käme sein Name erst nach dem Test.
  const katalog = TestBed.inject(SpeciesState).loadBundle();
  await vi.waitFor(() => {
    http.expectOne('/api/species/bundle').flush(SPECIES_BUNDLE);
  });
  await katalog;
  // Das Konto löst sich mit dem Katalog auf; `konto-eins` besitzt den Fund der Vorlage.
  await vi.waitFor(() => {
    http.expectOne('/api/me').flush(ME);
  });
  const eintraege = TestBed.inject(EntriesState);
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
    state: TestBed.inject(MapState),
    router: TestBed.inject(Router),
    http,
    refresh: detectChanges,
  };
}

/** Das X im Kopf des Blatts, nicht das der Abdunkelung darunter. */
function sheetClose(container: Element): HTMLElement {
  const close = container.querySelector<HTMLElement>('.sheet__close');
  if (close === null) throw new Error('Das Blatt trägt kein X.');
  return close;
}

describe('ObjektBlattComponent', () => {
  it('zeigt nichts, solange kein Objekt in der Adresse steht', async () => {
    const setup = await build();

    expect(setup.container.querySelector('app-sheet')).toBeNull();
  });

  it('öffnet den Fund aus der Adresse und trägt Art, Zeile und Kennzeichen im Kopf', async () => {
    const setup = await build();

    setup.state.object.set({ kind: 'find', id: FIND.id });
    setup.refresh();

    expect(screen.getByRole('heading', { name: 'Steinpilz' })).toBeInTheDocument();
    expect(screen.getByText('6. September 2026 · 3 Stück · Frederik')).toBeInTheDocument();
    expect(screen.getByText('geteilt')).toBeInTheDocument();
    await noViolations(setup.container);
  });

  it('lässt die Anzahl in der Zeile weg, wenn der Fund keine trägt', async () => {
    const setup = await build({ ...FIND_ENTRY, count: null });

    setup.state.object.set({ kind: 'find', id: FIND.id });
    setup.refresh();

    expect(screen.getByText('6. September 2026 · Frederik')).toBeInTheDocument();
  });

  it('nennt den Melder eines geteilten Fundes, wenn eine Gruppe ihn auflöst', async () => {
    const setup = await build({ ...FIND_ENTRY, ownerId: 'konto-zwei' });

    setup.state.object.set({ kind: 'find', id: FIND.id });
    setup.refresh();

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

    setup.state.object.set({ kind: 'find', id: FIND.id });
    setup.refresh();

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

    setup.state.object.set({ kind: 'marker', id: MARKER.id });
    setup.refresh();
    expect(screen.getByRole('heading', { name: 'Alter Fichtenhang' })).toBeInTheDocument();
    expect(setup.container.querySelector('.object__dot')).not.toBeNull();

    setup.state.object.set({ kind: 'zone', id: ZONE.id });
    setup.refresh();
    expect(screen.getByRole('heading', { name: 'Schönbuch Nord' })).toBeInTheDocument();
    expect(screen.getByText('Zone · 42 ha · privat')).toBeInTheDocument();
  });

  it('nimmt die Höhe des Bretts, die zur Art des Objekts gehört', async () => {
    const setup = await build();

    setup.state.object.set({ kind: 'marker', id: MARKER.id });
    setup.refresh();
    expect(setup.container.querySelector<HTMLElement>('.sheet')?.style.blockSize).toBe('444px');

    setup.state.object.set({ kind: 'find', id: FIND.id });
    setup.refresh();
    expect(setup.container.querySelector<HTMLElement>('.sheet')?.style.blockSize).toBe('594px');

    setup.state.object.set({ kind: 'zone', id: ZONE.id });
    setup.refresh();
    expect(setup.container.querySelector<HTMLElement>('.sheet')?.style.blockSize).toBe('444px');
  });

  it('stellt das Formular höher und dunkelt die Karte für den Fund ab', async () => {
    const setup = await build();
    setup.state.object.set({ kind: 'find', id: FIND.id });
    setup.refresh();

    await userEvent.click(screen.getByRole('button', { name: 'Bearbeiten' }));
    setup.refresh();

    expect(setup.container.querySelector<HTMLElement>('.sheet')?.style.blockSize).toBe('694px');
    expect(setup.container.querySelector('.overlay__scrim--modal')).not.toBeNull();
  });

  it('trägt im Formular den Titel des Formulars und den Ort im Kopf', async () => {
    const setup = await build();
    setup.state.object.set({ kind: 'find', id: FIND.id });
    setup.refresh();

    await userEvent.click(screen.getByRole('button', { name: 'Bearbeiten' }));
    setup.refresh();

    expect(screen.getByRole('heading', { name: 'Fund bearbeiten' })).toBeInTheDocument();
    expect(screen.getByText('48,5203 · 9,0511')).toBeInTheDocument();
    expect(setup.container.querySelector('.object__dot')).toBeNull();
  });

  it('führt das X aus dem Formular zurück zum Objekt und dann erst hinaus', async () => {
    const setup = await build();
    setup.state.object.set({ kind: 'marker', id: MARKER.id });
    setup.refresh();
    await userEvent.click(screen.getByRole('button', { name: 'Bearbeiten' }));
    setup.refresh();

    await userEvent.click(sheetClose(setup.container));
    setup.refresh();

    expect(screen.getByRole('heading', { name: 'Alter Fichtenhang' })).toBeInTheDocument();

    await userEvent.click(sheetClose(setup.container));
    setup.refresh();

    expect(setup.state.object()).toBeNull();
  });

  it('sagt es, wenn den Eintrag niemand mehr kennt', async () => {
    const setup = await build();

    setup.state.object.set({ kind: 'find', id: 'weg' });
    setup.refresh();

    expect(screen.getByText('Diesen Eintrag gibt es nicht mehr.')).toBeInTheDocument();
  });

  it('zoomt die Karte auf das Objekt, sobald es offen ist', async () => {
    const setup = await build();

    setup.state.object.set({ kind: 'marker', id: MARKER.id });
    setup.refresh();

    expect(setup.map.flights).toHaveLength(1);
    expect(setup.map.flights[0].target).toEqual([MARKER.lon, MARKER.lat]);
    expect(setup.map.flights[0].zoom).toBe(14);
  });

  it('zoomt bei einer Zone auf den Mittelpunkt ihrer Ecken', async () => {
    const setup = await build();
    const ring = ZONE.polygon.coordinates[0];
    const middle = ring.reduce((sum, point) => [sum[0] + point[0], sum[1] + point[1]], [0, 0]);

    setup.state.object.set({ kind: 'zone', id: ZONE.id });
    setup.refresh();

    expect(setup.map.flights[0].target).toEqual([middle[0] / ring.length, middle[1] / ring.length]);
  });

  it('lässt die Karte stehen, wenn das Objekt niemand mehr kennt', async () => {
    const setup = await build();

    setup.state.object.set({ kind: 'find', id: 'weg' });
    setup.refresh();

    expect(setup.map.flights).toHaveLength(0);
  });

  it('schließt, wenn ein Objekt gelöscht wurde', async () => {
    const setup = await build();
    setup.state.object.set({ kind: 'marker', id: MARKER.id });
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
