import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  type TestRequest,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { photo } from '../../testing/photos-fixture';
import { SyncStub, syncStubProviders } from '../../testing/sync-double';
import { ImagesState } from './images.state';

interface Setup {
  state: ImagesState;
  http: HttpTestingController;
  sync: SyncStub;
}

function build(): Setup {
  const sync = new SyncStub();
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting(), ...syncStubProviders(sync)],
  });
  return { state: TestBed.inject(ImagesState), http: TestBed.inject(HttpTestingController), sync };
}

/** Der Aufruf verkleinert nicht wirklich: `OffscreenCanvas` fehlt im Test. */
function stubPrepare(): void {
  vi.stubGlobal('createImageBitmap', () =>
    Promise.resolve({ width: 100, height: 80, close: () => undefined }),
  );
  vi.stubGlobal(
    'OffscreenCanvas',
    class {
      getContext(): unknown {
        return { drawImage: () => undefined };
      }
      convertToBlob(): Promise<Blob> {
        return Promise.resolve(new Blob(['x'], { type: 'image/jpeg' }));
      }
    },
  );
}

describe('ImagesState', () => {
  it('holt die freigegebenen Bilder einer Art', async () => {
    const { state, http } = build();

    state.load({ speciesId: 'art-eins', state: 'approved' });
    http
      .expectOne('/api/photos?speciesId=art-eins&state=approved')
      .flush({ items: [photo()], nextCursor: null });

    expect(state.photos()).toHaveLength(1);
    expect(state.lead()?.id).toBe('bild-eins');
  });

  it('meldet einen Fehler beim Laden', () => {
    const { state, http } = build();

    state.load({ speciesId: 'art-eins' });
    http.expectOne('/api/photos?speciesId=art-eins').error(new ProgressEvent('failed'));

    expect(state.failed()).toBe(true);
  });

  it('lädt hoch und meldet den Anteil', async () => {
    stubPrepare();
    const { state, http } = build();
    const file = new File(['x'], 'pilz.png', { type: 'image/png' });

    const running = state.submit({ photographer: 'Marie', licence: 'own' }, file);
    let request: TestRequest | null = null;
    await vi.waitFor(() => {
      request = http.expectOne('/api/photos');
    });
    (request as unknown as TestRequest).flush(photo({ state: 'submitted' }));
    const done = await running;

    expect(done?.state).toBe('submitted');
    expect(state.percent()).toBeNull();
  });

  it('hängt die Einreichung ohne Netz in die Warteschlange', async () => {
    stubPrepare();
    const { state, sync } = build();
    sync.online.set(false);
    const file = new File(['x'], 'pilz.png', { type: 'image/png' });

    const done = await state.submit({ photographer: 'Marie', licence: 'own' }, file);

    expect(done).toBeNull();
    expect(state.queued()).toBe(true);
    expect(sync.tasks().some((task) => task.kind === 'photo')).toBe(true);
  });

  it('gibt frei und nimmt das Bild aus der Liste', async () => {
    const { state, http } = build();
    state.load({ state: 'submitted' });
    http.expectOne('/api/photos?state=submitted').flush({ items: [photo()], nextCursor: null });

    const running = state.approve('bild-eins');
    http.expectOne('/api/photos/bild-eins/approval').flush(photo({ state: 'approved' }));
    await running;

    expect(state.photos()).toHaveLength(0);
  });

  it('lehnt mit Grund ab', async () => {
    const { state, http } = build();
    state.load({ state: 'submitted' });
    http.expectOne('/api/photos?state=submitted').flush({ items: [photo()], nextCursor: null });

    const running = state.reject('bild-eins', 'Unscharf');
    const request = http.expectOne('/api/photos/bild-eins/rejection');
    expect(request.request.body).toEqual({ reason: 'Unscharf' });
    request.flush(photo({ state: 'rejected' }));
    await running;

    expect(state.photos()).toHaveLength(0);
  });

  it('setzt das Titelbild und merkt es sich in der Liste', async () => {
    const { state, http } = build();
    state.load({ speciesId: 'art-eins' });
    http.expectOne('/api/photos?speciesId=art-eins').flush({
      items: [photo({ id: 'eins', lead: true }), photo({ id: 'zwei', lead: false })],
      nextCursor: null,
    });

    const running = state.setLead('zwei');
    http.expectOne('/api/photos/zwei/lead').flush(photo({ id: 'zwei', lead: true }));
    await running;

    expect(state.lead()?.id).toBe('zwei');
  });

  it('löscht ein Bild', async () => {
    const { state, http } = build();
    state.load({ speciesId: 'art-eins' });
    http.expectOne('/api/photos?speciesId=art-eins').flush({ items: [photo()], nextCursor: null });

    const running = state.remove('bild-eins');
    http.expectOne('/api/photos/bild-eins').flush(null);
    await running;

    expect(state.photos()).toHaveLength(0);
  });
});
