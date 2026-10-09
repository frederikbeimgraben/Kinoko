import { provideHttpClient } from '@angular/common/http';
import { NOW } from '../../core/tiles/now';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import type { EnvironmentProviders, Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { MAP_ADAPTER } from '../../map/map.tokens';
import { noViolations } from '../../testing/axe';
import { FIND, ZONE, ZONE_ENTRY } from '../../testing/entries-fixture';
import { patchState } from '@ngrx/signals';
import { unprotected } from '@ngrx/signals/testing';
import { EntriesStore } from '../entries/entries.store';
import { Router } from '@angular/router';
import { MapAdapterDouble, RAW_MANIFEST } from '../../testing/map-doubles';
import { toastSpy, type ToastSpy } from '../../testing/toast-spy';
import { DrawerDouble, rawMap, drawerProviders } from '../../testing/drawer-double';
import { ObjectSheetStore } from './object-sheet.store';
import { ZoneSheetComponent } from './zone-sheet.component';

function provider(map: MapAdapterDouble, drawer: DrawerDouble): (EnvironmentProviders | Provider)[] {
  return [
    provideHttpClient(),
    provideHttpClientTesting(),
    { provide: MAP_ADAPTER, useValue: map },
    ...drawerProviders(drawer),
    // A fixed date for today. The map shows the current calendar week.
    // The fixtures have only the weeks of the fixed year.
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
  /** The step bar of the object sheet calls these methods. */
  sheet: ZoneSheetComponent;
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
    sheet: fixture.componentInstance,
    get closed() {
      return closed;
    },
  };
}

/** Goes through the form to the corner drag mode. */
async function startCorners(setup: Setup): Promise<void> {
  await userEvent.click(screen.getByRole('button', { name: 'Bearbeiten' }));
  setup.refresh();
  await userEvent.click(screen.getByRole('button', { name: 'Umriss ändern' }));
  setup.refresh();
}

describe('ZoneBlattComponent', () => {
  it('zeigt Name, Fläche, Sichtbarkeit und Notiz im Rumpf', async () => {
    const setup = await build();

    expect(screen.getByText('Schönbuch Nord')).toBeInTheDocument();
    expect(screen.getByText('Zone · 42 ha · privat')).toBeInTheDocument();
    expect(screen.getByText('Nordhang, alte Fichten, ab Mitte September.')).toBeInTheDocument();
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
    const fakeLocation = { href: '' } as unknown as Location;
    vi.spyOn(window, 'location', 'get').mockReturnValue(fakeLocation);

    await userEvent.click(screen.getByRole('button', { name: 'In Karten-App öffnen' }));

    expect(fakeLocation.href).toMatch(/^geo:/);
  });

  it('speichert Farbe und Notiz und zeigt die Fläche im Formular', async () => {
    const setup = await build();

    await userEvent.click(screen.getByRole('button', { name: 'Bearbeiten' }));
    setup.refresh();
    expect(screen.getByLabelText('Name')).toHaveValue('Schönbuch Nord');
    expect(screen.getByText('Fläche')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Gelb' }));
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    const request = await vi.waitFor(() => setup.http.expectOne(`/api/zones/${ZONE.id}`));
    expect(request.request.body).toMatchObject({ colour: 'yellow', visibility: ZONE.visibility });
    request.flush(ZONE_ENTRY);

    await vi.waitFor(() => {
      expect(setup.toasts.success).toEqual(['Die Zone ist gespeichert.']);
    });
  });

  it('schließt beim Löschen sofort und meldet es danach', async () => {
    const setup = await build();

    await userEvent.click(screen.getByRole('button', { name: 'Löschen' }));
    setup.refresh();
    await userEvent.click(screen.getAllByRole('button', { name: 'Löschen' })[1]);
    expect(setup.closed).toBe(1);
    await vi.waitFor(() => {
      setup.http.expectOne(`/api/zones/${ZONE.id}`).flush(null);
    });

    await vi.waitFor(() => {
      expect(setup.toasts.success).toEqual(['Die Zone ist gelöscht.']);
    });
  });

  it('zählt die eigenen Funde in der Zone und öffnet sie in den Einträgen', async () => {
    const setup = await build();
    const ring = ZONE.polygon.coordinates[0];
    const inside = { ...FIND, lon: (ring[0][0] + ring[2][0]) / 2, lat: (ring[0][1] + ring[2][1]) / 2 };
    patchState(unprotected(TestBed.inject(EntriesStore)), {
      finds: [inside, { ...FIND, id: 'weit', lon: 0, lat: 0 }],
    });
    setup.refresh();

    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const back = vi.spyOn(history, 'back');
    const leave = vi.spyOn(TestBed.inject(ObjectSheetStore), 'leave');
    const row = screen.getByRole('button', { name: /Funde in der Zone/ });
    expect(row).toHaveTextContent('1');
    await userEvent.click(row);

    // A history step back would stop the navigation, so the list replaces the entry of the sheet.
    expect(navigate).toHaveBeenCalledWith(['/eintraege'], { replaceUrl: true });
    expect(leave).toHaveBeenCalledTimes(1);
    expect(back).not.toHaveBeenCalled();
    expect(TestBed.inject(EntriesStore).filter().zoneId).toBe(ZONE.id);
    expect(setup.closed).toBe(0);
  });

  it('bleibt stehen, wenn die Karte für Terra Draw fehlt', async () => {
    const setup = await build();

    await startCorners(setup);

    expect(screen.getByRole('button', { name: 'Umriss ändern' })).toBeInTheDocument();
    expect(setup.drawer.rings).toHaveLength(0);
  });

  it('gibt die Eckpunkte an Terra Draw und speichert sie mit den Eingaben des Formulars', async () => {
    const setup = await build(true);

    await userEvent.click(screen.getByRole('button', { name: 'Bearbeiten' }));
    setup.refresh();
    const name = screen.getByRole('textbox', { name: 'Name' });
    await userEvent.clear(name);
    await userEvent.type(name, 'Schönbuch Süd');
    await userEvent.click(screen.getByRole('button', { name: 'Umriss ändern' }));
    setup.refresh();
    await vi.waitFor(() => {
      expect(setup.drawer.rings).toHaveLength(1);
    });
    // The ring goes out without the duplicate end point.
    expect(setup.drawer.rings[0]).toHaveLength(4);
    expect(setup.sheet.cornerNote()).toBe('4 Eckpunkte · 42 ha');

    setup.drawer.drag([
      [9, 48.5],
      [9.2, 48.5],
      [9.2, 48.7],
    ]);
    expect(setup.sheet.cornerNote()).toMatch(/^3 Eckpunkte · /);
    setup.sheet.applyCorners();
    setup.refresh();
    // Per `MapZoneEdit`, the outline step goes back to the form with its input kept.
    setup.http.expectNone(`/api/zones/${ZONE.id}`);
    expect(setup.drawer.stopped).toBe(1);
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Schönbuch Süd');
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    const request = await vi.waitFor(() => setup.http.expectOne(`/api/zones/${ZONE.id}`));
    const body = request.request.body as { name: string; polygon: { coordinates: number[][][] } };
    expect(body.name).toBe('Schönbuch Süd');
    expect(body.polygon.coordinates[0]).toHaveLength(4);
    request.flush(ZONE_ENTRY);

    await vi.waitFor(() => {
      expect(setup.toasts.success).toEqual(['Die Zone ist gespeichert.']);
    });
    expect(setup.drawer.stopped).toBe(1);
  });

  it('bricht das Bearbeiten der Eckpunkte ab, ohne zu speichern', async () => {
    const setup = await build(true);

    await startCorners(setup);
    await vi.waitFor(() => {
      expect(setup.drawer.rings).toHaveLength(1);
    });
    setup.sheet.cancelCorners();
    setup.refresh();

    setup.http.expectNone(`/api/zones/${ZONE.id}`);
    expect(setup.drawer.stopped).toBe(1);
  });

  it('speichert keine Eckpunkte, wenn niemand etwas gezogen hat', async () => {
    const setup = await build(true);

    await startCorners(setup);
    await vi.waitFor(() => {
      expect(setup.drawer.rings).toHaveLength(1);
    });
    setup.sheet.applyCorners();
    setup.refresh();

    setup.http.expectNone(`/api/zones/${ZONE.id}`);
  });
});
