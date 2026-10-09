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
import { EntriesStore } from './entries.store';
import { findWrite, markerWrite, zoneWrite } from './writes';

interface Setup {
  state: EntriesStore;
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
    state: TestBed.inject(EntriesStore),
    http: TestBed.inject(HttpTestingController),
    auth,
    queue,
  };
}

/** Loads the three lists, as a page does when it opens. */
async function load(setup: Setup): Promise<void> {
  const loaded = setup.state.load();
  await vi.waitFor(() => {
    setup.http.expectOne(FINDS).flush(page([FIND_ENTRY]));
  });
  setup.http.expectOne(MARKERS).flush(page([MARKER_ENTRY]));
  setup.http.expectOne(ZONES).flush(page([ZONE_ENTRY]));
  await loaded;
}

describe('EntriesStore', () => {
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

  it('legt einen Fund ohne Anmeldung zuerst in die Warteschlange und fragt dann nach der Anmeldung', async () => {
    const { state, auth, queue, http } = build();
    auth.user.set(null);
    auth.reply = false;

    expect(await state.saveFind(findWrite(FIND))).toBe('wartet');
    expect(queue.stored[0].kind).toBe('find');
    expect(auth.asked).toBe(1);
    http.expectNone('/api/finds');
  });

  it('keeps the find on the device one time when the sheet goes to the SSO', async () => {
    const { state, auth, queue, http } = build();
    auth.reply = false;
    auth.goesToSso = true;

    expect(await state.saveFind(findWrite(FIND))).toBe('wartet');
    expect(queue.stored).toHaveLength(1);
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
    auth.user.set(null);
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

    auth.user.set(null);
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

  it('stellt einen Körper, den der Dienst abweist, nie an', async () => {
    const { state, http, queue } = build();
    const refused = { type: 'about:blank', title: 'Eingabe ungültig', status: 422, code: 'group' };

    const find = state.saveFind({ ...findWrite(FIND), groupId: null });
    await vi.waitFor(() => {
      http.expectOne({ url: '/api/finds', method: 'POST' }).flush(refused, { status: 422, statusText: '' });
    });
    const marker = state.saveMarker(markerWrite(MARKER));
    await vi.waitFor(() => {
      http.expectOne({ url: '/api/markers', method: 'POST' }).flush(refused, { status: 422, statusText: '' });
    });

    expect(await find).toBe('abgelehnt');
    expect(await marker).toBe('abgelehnt');
    expect(queue.stored).toEqual([]);
  });

  it('stellt einen Fund nicht ein zweites Mal an, wenn nur sein Foto scheitert', async () => {
    const { state, http, queue } = build();

    const result = state.saveFind(findWrite(FIND), [new File(['b'], 'p.jpg')]);
    await vi.waitFor(() => {
      http.expectOne({ url: '/api/finds', method: 'POST' }).flush(FIND_ENTRY);
    });
    await vi.waitFor(() => {
      http.expectOne({ url: '/api/photos', method: 'POST' }).error(new ProgressEvent('error'));
    });

    expect(await result).toBe('gespeichert');
    expect(queue.stored).toEqual([]);
  });

  it('hält eine abgewiesene Änderung aus Liste und Warteschlange', async () => {
    const setup = build();
    await load(setup);
    const { state, http, queue } = setup;

    const changed = state.updateMarker(MARKER, { name: 'Neu' });
    await vi.waitFor(() => {
      http
        .expectOne({ url: `/api/markers/${MARKER.id}`, method: 'PUT' })
        .flush({ title: 'Eingabe ungültig', status: 422 }, { status: 422, statusText: '' });
    });

    expect(await changed).toBe(false);
    expect(state.markers()).toEqual([MARKER]);
    expect(queue.stored).toEqual([]);
  });

  it('nimmt ein Löschen zurück, das der Dienst abweist, und nimmt 404 als gelöscht', async () => {
    const setup = build();
    await load(setup);
    const { state, http, queue } = setup;

    const refused = state.deleteMarker(MARKER.id);
    await vi.waitFor(() => {
      http
        .expectOne({ url: `/api/markers/${MARKER.id}`, method: 'DELETE' })
        .flush({ title: 'Verboten', status: 403 }, { status: 403, statusText: '' });
    });
    expect(await refused).toBe(false);
    expect(state.markers()).toEqual([MARKER]);

    const gone = state.deleteZone(ZONE.id);
    await vi.waitFor(() => {
      http
        .expectOne({ url: `/api/zones/${ZONE.id}`, method: 'DELETE' })
        .flush({ title: 'Nicht gefunden', status: 404 }, { status: 404, statusText: '' });
    });
    expect(await gone).toBe(true);
    expect(state.zones()).toEqual([]);
    expect(queue.stored).toEqual([]);
  });

  it('schickt die Gruppe eines geteilten Objekts beim Ändern mit', async () => {
    const setup = build();
    await load(setup);
    const { state, http } = setup;
    const grouped = { ...FIND, groupId: 'gruppe-eins' };

    const changed = state.updateFind(grouped, { count: 2 });
    await vi.waitFor(() => {
      const request = http.expectOne({ url: `/api/finds/${FIND.id}`, method: 'PUT' });
      expect(request.request.body).toMatchObject({ visibility: 'shared', groupId: 'gruppe-eins' });
      request.flush(FIND_ENTRY);
    });
    await changed;
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
