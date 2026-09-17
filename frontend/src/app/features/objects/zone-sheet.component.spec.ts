import { provideHttpClient } from '@angular/common/http';
import { NOW } from '../../core/tiles/now';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import type { EnvironmentProviders, Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { MAP_ADAPTER } from '../../map/map.tokens';
import { noViolations } from '../../testing/axe';
import { ZONE, ZONE_ENTRY } from '../../testing/entries-fixture';
import { MapAdapterDouble, RAW_MANIFEST } from '../../testing/map-doubles';
import { toastSpy, type ToastSpy } from '../../testing/toast-spy';
import { DrawerDouble, rawMap, drawerProviders } from '../../testing/drawer-double';
import { ZoneSheetComponent } from './zone-sheet.component';

function provider(map: MapAdapterDouble, drawer: DrawerDouble): (EnvironmentProviders | Provider)[] {
  return [
    provideHttpClient(),
    provideHttpClientTesting(),
    { provide: MAP_ADAPTER, useValue: map },
    ...drawerProviders(drawer),
    // Ein festes Heute: die Karte steht auf der laufenden Kalenderwoche, und
    // die Fixtures kennen nur die Wochen von 2025.
    { provide: NOW, useValue: () => new Date('2025-10-02T12:00:00Z') },
  ];
}

interface Setup {
  container: Element;
  http: HttpTestingController;
  toasts: ToastSpy;
  drawer: DrawerDouble;
  closed: number;
  refresh: () => void;
}

async function build(withMap = false): Promise<Setup> {
  vi.stubGlobal('fetch', () =>
    Promise.resolve({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: () => Promise.resolve(RAW_MANIFEST),
    }),
  );
  const map = new MapAdapterDouble();
  if (withMap) map.raw = rawMap();
  const drawer = new DrawerDouble();
  const { container, detectChanges, fixture } = await render(ZoneSheetComponent, {
    inputs: { zone: ZONE },
    providers: provider(map, drawer),
  });
  const http = TestBed.inject(HttpTestingController);
  detectChanges();
  let closed = 0;
  fixture.componentInstance.closed.subscribe(() => (closed += 1));
  return {
    container,
    http,
    toasts: toastSpy(),
    drawer,
    refresh: detectChanges,
    get closed() {
      return closed;
    },
  };
}

/** Geht über das Formular zum Ziehen der Ecken. */
async function startCorners(setup: Setup): Promise<void> {
  await userEvent.click(screen.getByRole('button', { name: 'Bearbeiten' }));
  setup.refresh();
  await userEvent.click(screen.getByRole('button', { name: 'Umriss ändern' }));
  setup.refresh();
}

describe('ZoneBlattComponent', () => {
  it('zeigt Namen, Fläche und Sichtbarkeit', async () => {
    const setup = await build();

    expect(screen.getByRole('heading', { name: 'Schönbuch Nord' })).toBeInTheDocument();
    expect(screen.getByText('Zone · 42 ha · privat')).toBeInTheDocument();
    await noViolations(setup.container);
  });

  it('lässt die Notiz weg, wenn die Zone keine trägt', async () => {
    const map = new MapAdapterDouble();
    const drawer = new DrawerDouble();
    const { container } = await render(ZoneSheetComponent, {
      inputs: { zone: { ...ZONE, note: null } },
      providers: provider(map, drawer),
    });

    expect(container.querySelector('.objectsheet__note')).toBeNull();
  });

  it('führt die Zone an die Karten-App weiter', async () => {
    await build();
    const opened = vi.fn();
    vi.stubGlobal('open', opened);

    await userEvent.click(screen.getByRole('button', { name: 'In Karten-App öffnen' }));

    expect(opened).toHaveBeenCalledWith(expect.stringContaining('%2C'), '_blank', 'noopener');
  });

  it('speichert Farbe, Sichtbarkeit und Notiz', async () => {
    const setup = await build();

    await userEvent.click(screen.getByRole('button', { name: 'Bearbeiten' }));
    setup.refresh();
    expect(screen.getByRole('heading', { name: 'Zone bearbeiten' })).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveValue('Schönbuch Nord');

    await userEvent.click(screen.getByRole('tab', { name: 'Geteilt' }));
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    const request = await vi.waitFor(() => setup.http.expectOne(`/api/zones/${ZONE.id}`));
    expect((request.request.body as { visibility: string }).visibility).toBe('shared');
    request.flush(ZONE_ENTRY);

    await vi.waitFor(() => {
      expect(setup.toasts.success).toEqual(['Gespeichert.']);
    });
  });

  it('löscht nach der Rückfrage und schließt', async () => {
    const setup = await build();

    await userEvent.click(screen.getByRole('button', { name: 'Löschen' }));
    setup.refresh();
    await userEvent.click(screen.getAllByRole('button', { name: 'Löschen' })[1]);
    await vi.waitFor(() => {
      setup.http.expectOne(`/api/zones/${ZONE.id}`).flush(null);
    });

    await vi.waitFor(() => {
      expect(setup.closed).toBe(1);
    });
  });

  it('bleibt stehen, wenn die Karte für Terra Draw fehlt', async () => {
    const setup = await build();

    await startCorners(setup);

    expect(screen.getByRole('button', { name: 'Umriss ändern' })).toBeInTheDocument();
    expect(setup.drawer.rings).toHaveLength(0);
  });

  it('gibt die Eckpunkte an Terra Draw und speichert, was gezogen wurde', async () => {
    const setup = await build(true);

    await startCorners(setup);
    await vi.waitFor(() => {
      setup.refresh();
      expect(screen.getByRole('button', { name: 'Eckpunkte übernehmen' })).toBeInTheDocument();
    });
    // Der Ring geht ohne den doppelten Endpunkt hinaus.
    expect(setup.drawer.rings[0]).toHaveLength(4);

    setup.drawer.drag([
      [9, 48.5],
      [9.2, 48.5],
      [9.2, 48.7],
    ]);
    await userEvent.click(screen.getByRole('button', { name: 'Eckpunkte übernehmen' }));
    const request = await vi.waitFor(() => setup.http.expectOne(`/api/zones/${ZONE.id}`));
    expect(
      (request.request.body as { polygon: { coordinates: number[][][] } }).polygon.coordinates[0],
    ).toHaveLength(4);
    request.flush(ZONE_ENTRY);

    await vi.waitFor(() => {
      expect(setup.toasts.success).toEqual(['Gespeichert.']);
    });
    expect(setup.drawer.stopped).toBe(1);
  });

  it('bricht das Bearbeiten der Eckpunkte ab, ohne zu speichern', async () => {
    const setup = await build(true);

    await startCorners(setup);
    await vi.waitFor(() => {
      setup.refresh();
      expect(screen.getByRole('button', { name: 'Abbrechen' })).toBeInTheDocument();
    });
    await userEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));
    setup.refresh();

    setup.http.expectNone(`/api/zones/${ZONE.id}`);
    expect(setup.drawer.stopped).toBe(1);
  });

  it('speichert keine Eckpunkte, wenn niemand etwas gezogen hat', async () => {
    const setup = await build(true);

    await startCorners(setup);
    await vi.waitFor(() => {
      setup.refresh();
      expect(screen.getByRole('button', { name: 'Eckpunkte übernehmen' })).toBeInTheDocument();
    });
    await userEvent.click(screen.getByRole('button', { name: 'Eckpunkte übernehmen' }));
    setup.refresh();

    setup.http.expectNone(`/api/zones/${ZONE.id}`);
  });
});
