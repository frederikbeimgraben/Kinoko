import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { AuthStub, authStubProviders } from '../../testing/auth-stub';
import { SyncService } from './sync.service';

const MARKER = { name: 'Alter Fichtenhang', lat: 48.53, lon: 9.06 };

interface Setup {
  sync: SyncService;
  http: HttpTestingController;
  auth: AuthStub;
}

function build(): Setup {
  const auth = new AuthStub();
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting(), ...authStubProviders(auth)],
  });
  return {
    sync: TestBed.inject(SyncService),
    http: TestBed.inject(HttpTestingController),
    auth,
  };
}

describe('SyncService', () => {
  beforeEach(() => {
    vi.stubGlobal('indexedDB', new IDBFactory());
  });

  it('nimmt einen Auftrag mit einer Kennung vom Gerät an', async () => {
    const { sync } = build();

    const task = await sync.enqueue('marker', 'create', MARKER);

    expect(task?.target).toMatch(/[0-9a-f-]{36}/);
    expect(sync.pendingCount()).toBe(1);
    expect(sync.pendingTargets().has(task?.target ?? '')).toBe(true);
  });

  it('sortiert nach dem Zeitpunkt des Anlegens', async () => {
    const { sync } = build();
    const times = ['2026-09-06T11:00:00.000Z', '2026-09-06T10:00:00.000Z'];
    vi.spyOn(Date.prototype, 'toISOString').mockImplementation(() => times.shift() ?? '');
    await sync.enqueue('marker', 'create', { ...MARKER, name: 'Spaeter' });
    await sync.enqueue('marker', 'create', { ...MARKER, name: 'Frueher' });

    const names = (await sync.read()).map((task) => (task.body as { name: string }).name);

    expect(names).toEqual(['Frueher', 'Spaeter']);
  });

  it('schickt das PUT auf die Kennung, die das Gerät vergeben hat', async () => {
    const { sync, http } = build();
    const task = await sync.enqueue('marker', 'create', MARKER);

    const sent = sync.flush();
    await vi.waitFor(() => {
      http.expectOne(`/api/markers/${task?.target ?? ''}`).flush({ id: task?.target });
    });

    expect(await sent).toBe(1);
    expect(sync.pendingCount()).toBe(0);
  });

  it('löscht mit DELETE', async () => {
    const { sync, http } = build();
    await sync.enqueue('zone', 'delete', null, [], 'zone-eins');

    const sent = sync.flush();
    await vi.waitFor(() => {
      http.expectOne('/api/zones/zone-eins').flush(null);
    });

    expect(await sent).toBe(1);
  });

  it('lässt im Konflikt den Server gewinnen und den Auftrag ausstehend', async () => {
    const { sync, http } = build();
    await sync.enqueue('marker', 'update', MARKER, [], 'marker-eins');

    const sent = sync.flush();
    await vi.waitFor(() => {
      http
        .expectOne('/api/markers/marker-eins')
        .flush({ title: 'Konflikt', status: 409 }, { status: 409, statusText: '' });
    });

    expect(await sent).toBe(0);
    expect(sync.pendingCount()).toBe(1);
    expect((await sync.read())[0].conflict).toBe(true);
  });

  it('bricht beim ersten Netzfehler ab und behält die Aufträge', async () => {
    const { sync, http } = build();
    await sync.enqueue('marker', 'create', { ...MARKER, name: 'Eins' });
    await sync.enqueue('marker', 'create', { ...MARKER, name: 'Zwei' });

    const sent = sync.flush();
    await vi.waitFor(() => {
      http.match(() => true)[0].error(new ProgressEvent('error'));
    });

    expect(await sent).toBe(0);
    expect(sync.pendingCount()).toBe(2);
  });

  it('hängt die Fotos an den gesendeten Fund', async () => {
    const { sync, http } = build();
    const task = await sync.enqueue('find', 'create', { lat: 1, lon: 2 }, [
      new Blob(['bild'], { type: 'image/jpeg' }),
    ]);

    const sent = sync.flush();
    await vi.waitFor(() => {
      http.expectOne(`/api/finds/${task?.target ?? ''}`).flush({ id: task?.target });
    });
    await vi.waitFor(() => {
      http.expectOne('/api/photos').flush({ id: 'photo-eins' });
    });

    expect(await sent).toBe(1);
  });

  it('behält ein Foto, das nicht durchgeht, ohne den Fund doppelt zu senden', async () => {
    const { sync, http } = build();
    const task = await sync.enqueue('find', 'create', { lat: 1, lon: 2 }, [new Blob(['bild'])]);

    const sent = sync.flush();
    await vi.waitFor(() => {
      http.expectOne(`/api/finds/${task?.target ?? ''}`).flush({ id: task?.target });
    });
    await vi.waitFor(() => {
      http.expectOne('/api/photos').flush({ title: 'Weg', status: 500 }, { status: 500, statusText: '' });
    });

    expect(await sent).toBe(0);
    expect((await sync.read())[0].photos).toHaveLength(1);
  });

  it('sendet nichts ohne Konto', async () => {
    const { auth, sync, http } = build();
    auth.user.set(null);
    await sync.enqueue('marker', 'create', MARKER);

    expect(await sync.flush()).toBe(0);
    http.expectNone(() => true);
  });

  it('liest beim Start und sendet, was wartet', async () => {
    const { sync, http } = build();
    await sync.enqueue('marker', 'create', MARKER);

    const started = sync.start();
    await vi.waitFor(() => {
      http.match(() => true)[0].flush({ id: 'egal' });
    });
    await started;

    expect(sync.pendingCount()).toBe(0);
  });

  it('sendet, sobald das Netz wieder da ist', async () => {
    const { sync, http } = build();
    await sync.enqueue('marker', 'create', MARKER);

    dispatchEvent(new Event('offline'));
    expect(sync.online()).toBe(false);
    dispatchEvent(new Event('online'));
    await vi.waitFor(() => {
      http.match(() => true)[0].flush({ id: 'egal' });
    });

    expect(sync.online()).toBe(true);
    await vi.waitFor(() => {
      expect(sync.pendingCount()).toBe(0);
    });
  });

  it('sendet jeden Auftrag genau einmal, auch bei zwei Aufrufen zugleich', async () => {
    const { sync, http } = build();
    await sync.enqueue('marker', 'create', MARKER);

    const first = sync.flush();
    const second = sync.flush();
    await vi.waitFor(() => {
      http.match(() => true)[0].flush({ id: 'marker-eins' });
    });

    expect(await first).toBe(1);
    expect(await second).toBe(1);
    expect(http.match(() => true)).toHaveLength(0);
    expect(sync.pendingCount()).toBe(0);
  });

  it('entfernt einen Auftrag von Hand', async () => {
    const { sync } = build();
    const task = await sync.enqueue('marker', 'create', MARKER);

    await sync.remove(task?.id ?? '');

    expect(sync.pendingCount()).toBe(0);
  });

  describe('ohne IndexedDB', () => {
    beforeEach(() => {
      vi.stubGlobal('indexedDB', undefined);
    });

    it('nimmt keinen Auftrag an', async () => {
      const { sync } = build();

      expect(await sync.enqueue('marker', 'create', MARKER)).toBeNull();
      expect(sync.pendingCount()).toBe(0);
    });
  });
});
