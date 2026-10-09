import { HttpTestingController } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { render } from '@testing-library/angular';
import { MAP_ADAPTER } from '../../map/map.tokens';
import { AuthStub, authStubProviders } from '../../testing/auth-stub';
import { catalogueProviders, catalogueReady } from '../../testing/catalogue-double';
import {
  FIND,
  FIND_ENTRY,
  MARKER,
  MARKER_ENTRY,
  SHARED_FIND,
  SHARED_FIND_ENTRY,
  ZONE,
  ZONE_ENTRY,
  page,
} from '../../testing/entries-fixture';
import { MapAdapterDouble } from '../../testing/map-doubles';
import { speciesBundle, speciesEntry, PENNY_BUN } from '../../testing/species-fixture';
import { EntriesStore } from '../entries/entries.store';
import { MapStore } from '../map/map.store';
import { AddEntryStore } from '../add-entry/add-entry.store';
import { MapObjectsDirective } from './map-objects.directive';
import { ObjectSheetStore } from './object-sheet.store';

@Component({
  imports: [MapObjectsDirective],
  template: `<div appMapObjects (objectHeld)="held = $event"></div>`,
})
class HostComponent {
  held: { x: number; y: number } | null = null;
}

interface Setup {
  map: MapAdapterDouble;
  state: MapStore;
  router: Router;
  refresh: () => void;
  host: HostComponent;
  surface: HTMLElement;
}

/** The location of this species is rounded: the map shows a pale area for it. */
const PROTECTED = speciesEntry({
  slug: 'maronenroehrling',
  name: 'Maronenröhrling',
  scientificName: 'Imleria badia',
  protection: 'strict',
});

let locationQueried = false;

/** A device with geolocation and the given permission. Gives the callbacks of the watchers. */
function stubLocation(state: PermissionState): PositionCallback[] {
  const watchers: PositionCallback[] = [];
  locationQueried = false;
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: {
      watchPosition: (ok: PositionCallback) => watchers.push(ok),
      clearWatch: () => undefined,
    },
  });
  Object.defineProperty(navigator, 'permissions', {
    configurable: true,
    value: {
      query: () => {
        locationQueried = true;
        return Promise.resolve({ state, addEventListener: () => undefined });
      },
    },
  });
  return watchers;
}

async function build(): Promise<Setup> {
  const map = new MapAdapterDouble();
  const { detectChanges, fixture, container } = await render(HostComponent, {
    providers: [
      ...catalogueProviders(speciesBundle([PENNY_BUN, PROTECTED])),
      provideRouter([]),
      { provide: MAP_ADAPTER, useValue: map },
      ...authStubProviders(new AuthStub()),
    ],
  });
  await catalogueReady();
  const http = TestBed.inject(HttpTestingController);
  const eintraege = TestBed.inject(EntriesStore);
  const loaded = eintraege.load();
  await vi.waitFor(() => {
    http.expectOne('/api/finds?mine=true&limit=50').flush(page([FIND_ENTRY]));
  });
  http.expectOne('/api/markers?limit=50').flush(page([MARKER_ENTRY]));
  http.expectOne('/api/zones?limit=50').flush(page([ZONE_ENTRY]));
  await loaded;
  const geteilt = eintraege.loadShared();
  await vi.waitFor(() => {
    http.expectOne('/api/finds?mine=false&limit=50').flush(page([SHARED_FIND_ENTRY]));
  });
  await geteilt;
  detectChanges();
  return {
    map,
    state: TestBed.inject(MapStore),
    router: TestBed.inject(Router),
    refresh: detectChanges,
    host: fixture.componentInstance,
    surface: container.querySelector('div') as HTMLElement,
  };
}

describe('MapObjectsDirective', () => {
  afterEach(() => {
    Reflect.deleteProperty(navigator, 'permissions');
  });

  it('meldet ein Objekt erst nach einem halben Sekundenschlag', async () => {
    vi.useFakeTimers();
    const setup = await build();
    setup.map.hit = { layer: 'funde', id: FIND.id, point: [9.1, 48.7] };

    setup.surface.dispatchEvent(new PointerEvent('pointerdown', { clientX: 40, clientY: 60 }));
    await vi.advanceTimersByTimeAsync(400);
    expect(setup.host.held).toBeNull();

    await vi.advanceTimersByTimeAsync(200);
    expect(setup.host.held).toEqual({ x: 40, y: 60 });
    vi.useRealTimers();
  });

  it('lässt ein Objekt in Ruhe, wenn der Finger vorher geht', async () => {
    vi.useFakeTimers();
    const setup = await build();
    setup.map.hit = { layer: 'funde', id: FIND.id, point: [9.1, 48.7] };

    setup.surface.dispatchEvent(new PointerEvent('pointerdown', { clientX: 40, clientY: 60 }));
    await vi.advanceTimersByTimeAsync(300);
    setup.surface.dispatchEvent(new PointerEvent('pointerup'));
    await vi.advanceTimersByTimeAsync(400);

    expect(setup.host.held).toBeNull();
    vi.useRealTimers();
  });

  it('meldet nichts, wo kein Objekt liegt', async () => {
    vi.useFakeTimers();
    const setup = await build();
    setup.map.hit = null;

    setup.surface.dispatchEvent(new PointerEvent('pointerdown', { clientX: 5, clientY: 5 }));
    await vi.advanceTimersByTimeAsync(600);

    expect(setup.host.held).toBeNull();
    vi.useRealTimers();
  });

  it('legt Zonen, Marker und Funde in ihrer Farbe auf die Karte', async () => {
    const setup = await build();

    expect(setup.map.layers.get('zonen')?.features[0].properties?.['farbe']).toBe('#4f8a3c');
    expect(setup.map.layers.get('marker')?.features[0].properties?.['farbe']).toBe('#7d3a78');
    expect(setup.map.layers.get('funde')?.features[0].geometry).toEqual({
      type: 'Point',
      coordinates: [FIND.lon, FIND.lat],
    });
  });

  it('zeichnet den Fund einer geschützten Art als gerundet', async () => {
    const setup = await build();

    const geteilt = setup.map.layers.get('geteilteFunde');
    expect(geteilt?.features).toHaveLength(1);
    expect(geteilt?.features[0].properties?.['gerundet']).toBe(true);
  });

  it('nimmt eine Ebene weg, sobald der Ebenen-Knopf sie abschaltet', async () => {
    const setup = await build();

    setup.state.setShowZones(false);
    setup.state.setShowMarkers(false);
    setup.state.setShowSharedFinds(false);
    setup.refresh();

    expect(setup.map.layers.has('zonen')).toBe(false);
    expect(setup.map.layers.has('marker')).toBe(false);
    expect(setup.map.layers.has('geteilteFunde')).toBe(false);
    expect(setup.map.layers.has('funde')).toBe(true);
  });

  it('öffnet auf einen Tipp das Objekt-Blatt', async () => {
    const setup = await build();

    setup.map.chosen?.('funde', FIND.id);
    await vi.waitFor(() => {
      expect(TestBed.inject(MapStore).object()).toEqual({ kind: 'find', id: FIND.id });
    });

    setup.map.chosen?.('marker', MARKER.id);
    await vi.waitFor(() => {
      expect(TestBed.inject(MapStore).object()).toEqual({ kind: 'marker', id: MARKER.id });
    });

    setup.map.chosen?.('zonen', ZONE.id);
    await vi.waitFor(() => {
      expect(TestBed.inject(MapStore).object()).toEqual({ kind: 'zone', id: ZONE.id });
    });
  });

  it('gibt jeden Tipp an den Schritt, solange eine Zone entsteht oder ein Punkt wandert', async () => {
    const setup = await build();
    const flow = TestBed.inject(AddEntryStore);
    flow.startZone();

    setup.map.chosen?.('zonen', ZONE.id);
    expect(TestBed.inject(MapStore).object()).toBeNull();
    flow.stop();

    const sheet = TestBed.inject(ObjectSheetStore);
    sheet.show('marker', MARKER.id);
    sheet.startRelocating();
    setup.map.chosen?.('funde', FIND.id);
    expect(TestBed.inject(MapStore).object()).toEqual({ kind: 'marker', id: MARKER.id });
  });

  it('legt um den offenen Fund oder Marker den Ring von MapPin', async () => {
    const setup = await build();

    TestBed.inject(ObjectSheetStore).show('marker', MARKER.id);
    setup.refresh();

    expect(setup.map.layers.get('marker')?.features[0].properties?.['selected']).toBe(true);
    expect(setup.map.layers.get('funde')?.features[0].properties?.['selected']).toBe(false);
  });

  it('zeigt bei einer Zone im Formular den neuen Umriss, beim Ziehen gar keinen', async () => {
    const setup = await build();
    const sheet = TestBed.inject(ObjectSheetStore);
    sheet.show('zone', ZONE.id);
    sheet.setEditing(true);
    const outline = {
      type: 'Polygon' as const,
      coordinates: [
        [
          [9, 48],
          [9.1, 48],
          [9.1, 48.1],
          [9, 48],
        ],
      ],
    };

    sheet.startCorners();
    setup.refresh();
    expect(setup.map.layers.get('zonen')?.features).toHaveLength(0);

    sheet.endCorners(outline);
    setup.refresh();
    expect(setup.map.layers.get('zonen')?.features[0].geometry).toEqual(outline);
  });

  it('öffnet für einen fremden geteilten Fund kein Blatt', async () => {
    const setup = await build();

    setup.map.chosen?.('geteilteFunde', SHARED_FIND.id);

    expect(TestBed.inject(MapStore).object()).toBeNull();
  });

  it('fragt beim Aufbau der Karte nicht nach dem Standort', async () => {
    const watchers = stubLocation('prompt');
    await build();

    await vi.waitFor(() => {
      TestBed.tick();
      expect(locationQueried).toBe(true);
    });
    expect(watchers).toHaveLength(0);
  });

  it('legt den eigenen Standort als Punkt mit Genauigkeitskreis auf die Karte', async () => {
    const watchers = stubLocation('granted');
    const setup = await build();

    expect(setup.map.layers.has('location')).toBe(false);
    await vi.waitFor(() => {
      TestBed.tick();
      expect(watchers).toHaveLength(1);
    });

    watchers[0]({ coords: { longitude: 9.1, latitude: 48.8, accuracy: 40 } } as GeolocationPosition);
    setup.refresh();

    const features = setup.map.layers.get('location')?.features ?? [];
    expect(features.map((feature) => feature.geometry.type)).toEqual(['Polygon', 'Point']);
    const dot = features[1].geometry;
    expect(dot.type === 'Point' && dot.coordinates).toEqual([9.1, 48.8]);
    const ring = features[0].geometry;
    // North is a quarter of the ring further: 40 m are 40 / 111320 degrees.
    expect(ring.type === 'Polygon' && ring.coordinates[0][12][1]).toBeCloseTo(48.8 + 40 / 111320, 6);
  });
});
