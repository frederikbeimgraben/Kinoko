import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AuthStub, authStubProviders } from '../../testing/auth-stub';
import { SyncStub, syncStubProviders } from '../../testing/sync-double';
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
import { EntriesState } from './entries.state';
import { findWrite, markerWrite, zoneWrite } from './writes';

interface Setup {
  state: EntriesState;
  http: HttpTestingController;
  auth: AuthStub;
  queue: SyncStub;
}

const FINDS = '/api/finds?mine=true&limit=50';
const MARKERS = '/api/markers?limit=50';
const ZONES = '/api/zones?limit=50';

function build(): Setup {
  const auth = new AuthStub();
  const queue = new SyncStub();
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      ...authStubProviders(auth),
      ...syncStubProviders(queue),
    ],
  });
  return {
    state: TestBed.inject(EntriesState),
    http: TestBed.inject(HttpTestingController),
    auth,
    queue,
  };
}

/** Lädt die drei Listen, so wie eine Seite es beim Öffnen tut. */
async function load(setup: Setup): Promise<void> {
  const loaded = setup.state.load();
  await vi.waitFor(() => {
    setup.http.expectOne(FINDS).flush(page([FIND_ENTRY]));
  });
  setup.http.expectOne(MARKERS).flush(page([MARKER_ENTRY]));
  setup.http.expectOne(ZONES).flush(page([ZONE_ENTRY]));
  await loaded;
}

describe('EintraegeZustand', () => {
  it('holt Funde, Marker und Zonen des Kontos', async () => {
    const setup = build();

    await load(setup);

    expect(setup.state.finds()).toEqual([FIND]);
    expect(setup.state.markers()).toEqual([MARKER]);
    expect(setup.state.zones()).toEqual([ZONE]);
    expect(setup.state.reporter()).toBe('Frederik');
  });

  it('holt ohne Konto nichts und leert, was noch dastand', async () => {
    const { state, auth, http } = build();
    auth.user.set(null);

    await state.load();

    http.expectNone(FINDS);
    expect(state.finds()).toEqual([]);
    expect(state.reporter()).toBeNull();
  });

  it('lässt bei einem Ausfall stehen, was schon da war', async () => {
    const setup = build();
    await load(setup);

    const second = setup.state.load();
    await vi.waitFor(() => {
      setup.http.expectOne(FINDS).flush({ title: 'Weg', status: 500 }, { status: 500, statusText: '' });
    });
    setup.http.expectOne(MARKERS).flush(page([]));
    setup.http.expectOne(ZONES).flush(page([]));
    await second;

    expect(setup.state.finds()).toEqual([FIND]);
    expect(setup.state.loading()).toBe(false);
  });

  it('holt geteilte Funde im Ausschnitt und hält sie bei einem Ausfall', async () => {
    const { state, http } = build();

    const loaded = state.loadShared({ west: 9, south: 48, ost: 10, nord: 49 });
    await vi.waitFor(() => {
      http.expectOne('/api/finds?mine=false&bbox=9,48,10,49&limit=50').flush(page([SHARED_FIND_ENTRY]));
    });
    await loaded;
    expect(state.shared()).toEqual([SHARED_FIND]);

    const second = state.loadShared();
    await vi.waitFor(() => {
      http
        .expectOne('/api/finds?mine=false&limit=50')
        .flush({ title: 'Weg', status: 500 }, { status: 500, statusText: '' });
    });
    await second;
    expect(state.shared()).toEqual([SHARED_FIND]);
  });

  it('speichert einen Fund und lädt seine Fotos über /photos hoch', async () => {
    const { state, http } = build();

    const result = state.saveFind(findWrite(FIND), [new File(['b'], 'p.jpg')]);
    await vi.waitFor(() => {
      http.expectOne({ url: '/api/finds', method: 'POST' }).flush(FIND_ENTRY);
    });
    await vi.waitFor(() => {
      const upload = http.expectOne({ url: '/api/photos', method: 'POST' });
      expect((upload.request.body as FormData).get('findId')).toBe(FIND.id);
      upload.flush({ id: 'bild-eins' });
    });

    expect(await result).toBe('gespeichert');
    expect(state.finds()).toEqual([FIND]);
  });

  it('lässt den Fund stehen, wenn ein Foto nicht durchgeht', async () => {
    const { state, http } = build();

    const result = state.saveFind(findWrite(FIND), [new File(['b'], 'p.jpg')]);
    await vi.waitFor(() => {
      http.expectOne({ url: '/api/finds', method: 'POST' }).flush(FIND_ENTRY);
    });
    await vi.waitFor(() => {
      http
        .expectOne({ url: '/api/photos', method: 'POST' })
        .flush({ title: 'Zu groß', status: 413 }, { status: 413, statusText: '' });
    });

    expect(await result).toBe('gespeichert');
    expect(state.finds()).toEqual([FIND]);
  });

  it('hält die Liste frei von einem Stand, den der Leser abweist', async () => {
    const { state, http } = build();

    const find = state.saveFind(findWrite(FIND));
    await vi.waitFor(() => {
      http.expectOne({ url: '/api/finds', method: 'POST' }).flush({ ...FIND_ENTRY, deleted: true });
    });
    expect(await find).toBe('gespeichert');
    expect(state.finds()).toEqual([]);

    const marker = state.saveMarker(markerWrite(MARKER));
    await vi.waitFor(() => {
      http.expectOne({ url: '/api/markers', method: 'POST' }).flush({ ...MARKER_ENTRY, deleted: true });
    });
    expect(await marker).toBe('gespeichert');
    expect(state.markers()).toEqual([]);
  });

  it('stellt einen Fund an, wenn niemand sich anmelden will', async () => {
    const { state, auth, queue, http } = build();
    auth.reply = false;

    expect(await state.saveFind(findWrite(FIND))).toBe('wartet');
    expect(queue.stored[0].kind).toBe('find');
    http.expectNone('/api/finds');
  });

  it('stellt einen Fund an, wenn das Netz fehlt', async () => {
    const { state, queue, http } = build();

    const result = state.saveFind(findWrite(FIND));
    await vi.waitFor(() => {
      http.expectOne({ url: '/api/finds', method: 'POST' }).error(new ProgressEvent('error'));
    });

    expect(await result).toBe('wartet');
    expect(queue.stored).toHaveLength(1);
  });

  it('meldet „verworfen“, wenn auch das Gerät keinen Platz hat', async () => {
    const { state, auth, queue } = build();
    auth.reply = false;
    queue.accepts = false;

    expect(await state.saveFind(findWrite(FIND))).toBe('verworfen');
  });

  it('speichert und stellt Marker und Zonen genauso an', async () => {
    const { state, auth, http, queue } = build();

    const marker = state.saveMarker(markerWrite(MARKER));
    await vi.waitFor(() => {
      http.expectOne({ url: '/api/markers', method: 'POST' }).flush(MARKER_ENTRY);
    });
    expect(await marker).toBe('gespeichert');
    expect(state.markers()).toEqual([MARKER]);

    const zone = state.saveZone(zoneWrite(ZONE));
    await vi.waitFor(() => {
      http.expectOne({ url: '/api/zones', method: 'POST' }).flush(ZONE_ENTRY);
    });
    expect(await zone).toBe('gespeichert');
    expect(state.zones()).toEqual([ZONE]);

    auth.reply = false;
    expect(await state.saveMarker(markerWrite(MARKER))).toBe('wartet');
    expect(await state.saveZone(zoneWrite(ZONE))).toBe('wartet');
    expect(queue.stored.map((entry) => entry.kind)).toEqual(['marker', 'zone']);
  });

  it('stellt Marker und Zone an, wenn das Netz fehlt', async () => {
    const { state, http, queue } = build();

    const marker = state.saveMarker(markerWrite(MARKER));
    await vi.waitFor(() => {
      http.expectOne({ url: '/api/markers', method: 'POST' }).error(new ProgressEvent('error'));
    });
    expect(await marker).toBe('wartet');

    const zone = state.saveZone(zoneWrite(ZONE));
    await vi.waitFor(() => {
      http.expectOne({ url: '/api/zones', method: 'POST' }).error(new ProgressEvent('error'));
    });
    expect(await zone).toBe('wartet');
    expect(queue.stored).toHaveLength(2);
  });

  it('ersetzt jedes Objekt mit PUT und schickt den ganzen Körper', async () => {
    const setup = build();
    await load(setup);
    const { state, http } = setup;

    const find = state.updateFind(FIND, { count: 4 });
    await vi.waitFor(() => {
      const request = http.expectOne({ url: `/api/finds/${FIND.id}`, method: 'PUT' });
      expect(request.request.body).toEqual({ ...findWrite(FIND), count: 4 });
      request.flush({ ...FIND_ENTRY, count: 4 });
    });
    expect(await find).toBe(true);
    expect(state.finds()[0].count).toBe(4);

    const marker = state.updateMarker(MARKER, { name: 'Neu' });
    await vi.waitFor(() => {
      http
        .expectOne({ url: `/api/markers/${MARKER.id}`, method: 'PUT' })
        .flush({ ...MARKER_ENTRY, name: 'Neu' });
    });
    expect(await marker).toBe(true);
    expect(state.markers()[0].name).toBe('Neu');

    const zone = state.updateZone(ZONE, { name: 'Neu' });
    await vi.waitFor(() => {
      http.expectOne({ url: `/api/zones/${ZONE.id}`, method: 'PUT' }).flush({ ...ZONE_ENTRY, name: 'Neu' });
    });
    expect(await zone).toBe(true);
  });

  it('löscht jedes Objekt über seinen Weg', async () => {
    const setup = build();
    await load(setup);
    const { state, http } = setup;

    const away = state.deleteFind(FIND.id);
    await vi.waitFor(() => {
      http.expectOne({ url: `/api/finds/${FIND.id}`, method: 'DELETE' }).flush(null);
    });
    expect(await away).toBe(true);
    expect(state.finds()).toEqual([]);

    const markerGone = state.deleteMarker(MARKER.id);
    await vi.waitFor(() => {
      http.expectOne({ url: `/api/markers/${MARKER.id}`, method: 'DELETE' }).flush(null);
    });
    expect(await markerGone).toBe(true);

    const zoneGone = state.deleteZone(ZONE.id);
    await vi.waitFor(() => {
      http.expectOne({ url: `/api/zones/${ZONE.id}`, method: 'DELETE' }).flush(null);
    });
    expect(await zoneGone).toBe(true);
    expect(state.zones()).toEqual([]);
  });

  it('stellt jede Änderung und jedes Löschen an, wenn das Netz fehlt', async () => {
    const setup = build();
    await load(setup);
    const { state, http, queue } = setup;
    const broken = (): void => {
      http
        .match(() => true)
        .forEach((request) => {
          request.error(new ProgressEvent('error'));
        });
    };

    const calls = [
      state.updateFind(FIND, {}),
      state.updateMarker(MARKER, {}),
      state.updateZone(ZONE, {}),
      state.deleteFind(FIND.id),
      state.deleteMarker(MARKER.id),
      state.deleteZone(ZONE.id),
    ];
    await vi.waitFor(broken);

    expect(await Promise.all(calls)).toEqual([true, true, true, true, true, true]);
    expect(queue.stored.map((task) => task.operation)).toEqual([
      'update',
      'update',
      'update',
      'delete',
      'delete',
      'delete',
    ]);
    expect(queue.stored[0].body).toEqual(findWrite(FIND));
  });

  it('sendet Wartendes nur mit Konto und lädt danach neu', async () => {
    const { state, auth, queue, http } = build();
    auth.user.set(null);
    expect(await state.sendPending()).toBe(0);

    auth.user.set({ sub: 'sub-eins', name: 'Frederik', email: '' });
    queue.sent = 2;
    const sent = state.sendPending();
    await vi.waitFor(() => {
      http.expectOne(FINDS).flush(page([]));
    });
    http.expectOne(MARKERS).flush(page([]));
    http.expectOne(ZONES).flush(page([]));

    expect(await sent).toBe(2);
  });
});
