import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal, type Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { ViewportService } from '../../core/layout/viewport.service';
import { MapStore } from '../map/map.store';
import { MAP_ADAPTER } from '../../map/map.tokens';
import { SPECIES_BUNDLE } from '../../testing/species-fixture';
import { AuthStub, authStubProviders } from '../../testing/auth-stub';
import { noViolations } from '../../testing/axe';
import { FIND_ENTRY, MARKER_ENTRY, ZONE_ENTRY } from '../../testing/entries-fixture';
import { MapAdapterDouble } from '../../testing/map-doubles';
import { SyncStub, syncStubProviders } from '../../testing/sync-double';
import { toastSpy, type ToastSpy } from '../../testing/toast-spy';
import { AddEntryComponent } from './add-entry.component';
import { AddEntryStore } from './add-entry.store';

/** The desktop: there the actions are a card at the add button. */
const WIDE: Provider = { provide: ViewportService, useValue: { wide: signal(true) } };

interface Setup {
  container: Element;
  flow: AddEntryStore;
  map: MapAdapterDouble;
  auth: AuthStub;
  queue: SyncStub;
  http: HttpTestingController;
  toasts: ToastSpy;
  refresh: () => void;
  destroy: () => void;
}

async function build(extra: readonly Provider[] = []): Promise<Setup> {
  const map = new MapAdapterDouble();
  const auth = new AuthStub();
  const queue = new SyncStub();
  const { container, detectChanges, fixture } = await render(AddEntryComponent, {
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
    flow: TestBed.inject(AddEntryStore),
    map,
    auth,
    queue,
    http: TestBed.inject(HttpTestingController),
    toasts: toastSpy(),
    refresh: detectChanges,
    destroy: () => {
      fixture.destroy();
    },
  };
}

/** A click on the map, as the adapter reports it. */
function clickMap(setup: Setup, point: readonly [number, number]): void {
  setup.map.clicked?.(point);
  setup.refresh();
}

/** A key, as the step gets it on the desktop. */
function press(key: string): void {
  document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
}

/** Opens the actions sheet and selects a row in it. */
async function start(setup: Setup, row: string): Promise<void> {
  setup.flow.open();
  setup.refresh();
  await userEvent.click(screen.getByRole('button', { name: row }));
  setup.refresh();
}

/** The find goes through the crosshair into the form, which gets the catalogue. */
async function openFindForm(setup: Setup): Promise<void> {
  await start(setup, 'Fund melden');
  await userEvent.click(screen.getByRole('button', { name: 'Bestätigen' }));
  setup.refresh();
  TestBed.inject(MapStore).setSpecies('steinpilz');
  await vi.waitFor(() => {
    setup.http.expectOne('/api/species/bundle').flush(SPECIES_BUNDLE);
  });
  setup.refresh();
}

/** Sets three corners with taps on the map, enough to close an area. */
function drawRing(setup: Setup): void {
  for (const location of [
    [9.0, 48.5],
    [9.02, 48.5],
    [9.02, 48.52],
  ] as const) {
    clickMap(setup, location);
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

    expect(screen.getByRole('group', { name: 'Fundort festlegen' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Fundort festlegen' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Bestätigen' }));
    setup.refresh();

    expect(setup.flow.location()).toEqual([9.05, 48.52]);
    expect(screen.getByRole('heading', { name: 'Fund melden' })).toBeInTheDocument();
  });

  it('nimmt den Ort unter dem Fadenkreuz, nicht die Mitte der Karte', async () => {
    const setup = await build();
    setup.map.pointPoint = [9.11, 48.61];
    await start(setup, 'Fund melden');

    await userEvent.click(screen.getByRole('button', { name: 'Bestätigen' }));
    setup.refresh();

    expect(setup.flow.location()).toEqual([9.11, 48.61]);
    expect(setup.map.asked).not.toBeNull();
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

    await userEvent.click(screen.getByRole('button', { name: 'Bestätigen' }));

    expect(setup.toasts.failure).toEqual(['Die Karte steht noch nicht.']);
    expect(setup.flow.step()).toBe('findLocation');
  });

  it('speichert einen Marker mit Name, Farbe und Sichtbarkeit', async () => {
    const setup = await build();
    await start(setup, 'Marker setzen');

    expect(screen.getByRole('group', { name: 'Marker setzen' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Bestätigen' }));
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
    await userEvent.click(screen.getByRole('button', { name: 'Bestätigen' }));
    setup.refresh();

    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    expect(setup.toasts.failure).toEqual(['Gib dem Marker einen Namen.']);
    setup.http.expectNone('/api/markers');
  });

  it('zählt Eckpunkte und Fläche mit, während die Zone entsteht', async () => {
    const setup = await build();
    await start(setup, 'Zone zeichnen');

    expect(screen.getByRole('group', { name: 'Zone zeichnen' })).toBeInTheDocument();
    expect(screen.getByText('0 Eckpunkte · 0,0 ha')).toBeInTheDocument();

    clickMap(setup, [9.0, 48.5]);
    await vi.waitFor(() => {
      setup.refresh();
      expect(screen.getByText('1 Eckpunkt · 0,0 ha')).toBeInTheDocument();
    });
    setup.flow.removeLastCorner();
    drawRing(setup);
    setup.refresh();

    await vi.waitFor(() => {
      setup.refresh();
      expect(screen.getByText(/^3 Eckpunkte · \d/)).toBeInTheDocument();
    });
  });

  it('nimmt den letzten Eckpunkt wieder weg', async () => {
    const setup = await build();
    await start(setup, 'Zone zeichnen');
    drawRing(setup);
    setup.refresh();

    await userEvent.click(screen.getByRole('button', { name: 'Punkt entfernen' }));

    await vi.waitFor(() => {
      setup.refresh();
      expect(screen.getByText(/^2 Eckpunkte · /)).toBeInTheDocument();
    });
  });

  it('schließt eine Zone erst ab drei Eckpunkten', async () => {
    const setup = await build();
    await start(setup, 'Zone zeichnen');

    await userEvent.click(screen.getByRole('button', { name: 'Fertig' }));

    expect(setup.toasts.failure).toEqual(['Eine Zone braucht mindestens drei Eckpunkte.']);
  });

  it('speichert eine Zone mit ihrer Fläche', async () => {
    const setup = await build();
    await start(setup, 'Zone zeichnen');
    drawRing(setup);
    await userEvent.click(screen.getByRole('button', { name: 'Fertig' }));
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

  it('legt einen Fund ohne Anmeldung in die Warteschlange, bevor die Anmeldung fragt', async () => {
    const setup = await build();
    setup.auth.reply = false;
    await openFindForm(setup);
    setup.auth.user.set(null);

    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    await vi.waitFor(() => {
      expect(setup.queue.stored.map((task) => task.kind)).toEqual(['find']);
    });
    expect(setup.toasts.info).toEqual(['Der Fund wartet auf die Übertragung.']);
    expect(setup.toasts.success).toEqual([]);
  });

  it('bricht ab und lässt nichts stehen', async () => {
    const setup = await build();
    await start(setup, 'Fund melden');

    await userEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));

    expect(setup.flow.step()).toBeNull();
  });

  it('verlässt das Zeichnen einer Zone auch ohne Eckpunkt', async () => {
    const setup = await build();
    await start(setup, 'Zone zeichnen');

    await userEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));

    expect(setup.flow.step()).toBeNull();
    expect(setup.flow.ring()).toEqual([]);
  });

  it('verlässt das Zeichnen einer Zone mit halb gesetzten Ecken', async () => {
    const setup = await build();
    await start(setup, 'Zone zeichnen');
    clickMap(setup, [9.0, 48.5]);

    await userEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));

    expect(setup.flow.step()).toBeNull();
    expect(setup.flow.ring()).toEqual([]);
  });

  it('bringt das Fadenkreuz am Telefon mit "Punkt entfernen" an den Anfang des Schritts zurück', async () => {
    const setup = await build();
    const pans: (readonly [number, number])[] = [];
    // The earlier point is at pixel (100, 200). The crosshair is at the origin of the test page.
    setup.map.raw = {
      getCanvas: () => document.createElement('canvas'),
      project: () => ({ x: 100, y: 200 }),
      panBy: (offset: readonly [number, number]) => pans.push(offset),
      // The step paints the earlier point as its mark.
      getSource: () => ({ setData: () => undefined }),
      getLayer: () => undefined,
      removeLayer: () => undefined,
      removeSource: () => undefined,
      getContainer: () => document.body,
    } as unknown as MapLibreMap;
    setup.flow.open();
    setup.flow.startMarker();
    setup.flow.adoptLocation([9.05, 48.52]);
    setup.flow.editMarkerLocation({ name: 'Parkplatz', colour: 'green', note: null, visibility: 'private', groupId: null });
    setup.refresh();

    // The step starts with the earlier point below the crosshair.
    await vi.waitFor(() => {
      setup.refresh();
      expect(pans).toHaveLength(1);
    });
    await userEvent.click(screen.getByRole('button', { name: 'Punkt entfernen' }));

    expect(pans).toHaveLength(2);
    expect(pans[1]).toEqual(pans[0]);
  });

  describe('am Rechner', () => {
    it('nimmt mit "Punkt entfernen" den geklickten Ort weg, auch aus der Statuszeile', async () => {
      const setup = await build([WIDE]);
      await start(setup, 'Fund melden');
      clickMap(setup, [9.05, 48.52]);
      expect(screen.getByText(/^48,52.* · 9,05/)).toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: 'Punkt entfernen' }));
      setup.refresh();

      expect(setup.flow.location()).toBeNull();
      expect(screen.queryByText(/^48,52.* · 9,05/)).toBeNull();
    });

    it('setzt den Fundort mit einem Klick auf die Karte und verschiebt ihn', async () => {
      const setup = await build([WIDE]);
      await start(setup, 'Fund melden');

      clickMap(setup, [9.05, 48.52]);
      expect(setup.flow.location()).toEqual([9.05, 48.52]);

      clickMap(setup, [9.06, 48.53]);

      expect(setup.flow.location()).toEqual([9.06, 48.53]);
      expect(setup.flow.step()).toBe('findLocation');
      expect(setup.map.cursors).toContain('crosshair');
    });

    it('setzt jede Ecke der Zone mit einem Klick', async () => {
      const setup = await build([WIDE]);
      await start(setup, 'Zone zeichnen');

      clickMap(setup, [9.0, 48.5]);
      clickMap(setup, [9.1, 48.5]);
      clickMap(setup, [9.1, 48.6]);

      expect(setup.flow.ring()).toHaveLength(3);
    });

    it('schließt die Zone mit einem Klick auf die erste Ecke', async () => {
      const setup = await build([WIDE]);
      await start(setup, 'Zone zeichnen');
      for (const point of [
        [9.0, 48.5],
        [9.1, 48.5],
        [9.1, 48.6],
      ] as const) {
        clickMap(setup, point);
      }

      clickMap(setup, [9.0, 48.5]);

      expect(setup.flow.step()).toBe('zoneForm');
    });

    it('nimmt mit der Rücktaste die letzte Ecke weg', async () => {
      const setup = await build([WIDE]);
      await start(setup, 'Zone zeichnen');
      clickMap(setup, [9.0, 48.5]);
      clickMap(setup, [9.1, 48.5]);

      press('Backspace');
      setup.refresh();

      expect(setup.flow.ring()).toHaveLength(1);
    });

    it('schließt die Zone mit der Eingabetaste', async () => {
      const setup = await build([WIDE]);
      await start(setup, 'Zone zeichnen');
      for (const point of [
        [9.0, 48.5],
        [9.1, 48.5],
        [9.1, 48.6],
      ] as const) {
        clickMap(setup, point);
      }

      press('Enter');
      setup.refresh();

      expect(setup.flow.step()).toBe('zoneForm');
    });

    it('übernimmt den Ort mit der Eingabetaste', async () => {
      const setup = await build([WIDE]);
      await start(setup, 'Marker setzen');
      clickMap(setup, [9.05, 48.52]);

      press('Enter');
      setup.refresh();

      expect(setup.flow.step()).toBe('markerForm');
    });

    it('bricht den Schritt mit Esc ab', async () => {
      const setup = await build([WIDE]);
      await start(setup, 'Zone zeichnen');

      press('Escape');
      setup.refresh();

      expect(setup.flow.running()).toBe(false);
    });

    it('lässt die Tasten am Telefon liegen', async () => {
      const setup = await build();
      await start(setup, 'Zone zeichnen');

      press('Escape');
      setup.refresh();

      expect(setup.flow.running()).toBe(true);
    });
  });

  it('aims again with the crosshair on the phone and keeps the form choices on a return to the location', async () => {
    const setup = await build();
    setup.map.pointPoint = [9.11, 48.61];
    await openFindForm(setup);
    await userEvent.type(screen.getByLabelText('Notiz'), 'Unter Fichten');

    await userEvent.click(screen.getByRole('button', { name: /^Ort/ }));
    setup.refresh();
    expect(setup.flow.step()).toBe('findLocation');
    expect(setup.flow.location()).toBeNull();

    setup.map.pointPoint = [9.2, 48.7];
    await userEvent.click(screen.getByRole('button', { name: 'Bestätigen' }));
    setup.refresh();

    expect(setup.flow.location()).toEqual([9.2, 48.7]);
    expect(screen.getByLabelText('Notiz')).toHaveValue('Unter Fichten');
  });

  it('räumt den Ablauf weg, wenn der Reiter Karte schließt, ohne die Geschichte zu bewegen', async () => {
    const setup = await build();
    await start(setup, 'Fund melden');

    setup.destroy();

    expect(setup.flow.running()).toBe(false);
    expect(setup.flow.location()).toBeNull();
  });
});
