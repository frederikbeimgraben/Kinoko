import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { SHARED_FIND, SHARED_FIND_ENTRY, findPage } from '../../testing/entries-fixture';
import { toastSpy, type ToastSpy } from '../../testing/toast-spy';
import { FindsApi } from './finds.api';

interface Setup {
  api: FindsApi;
  http: HttpTestingController;
  toasts: ToastSpy;
}

function build(): Setup {
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  return {
    api: TestBed.inject(FindsApi),
    http: TestBed.inject(HttpTestingController),
    toasts: toastSpy(),
  };
}

const SHARED_URL = '/api/finds?mine=false&limit=50';

describe('FindsApi', () => {
  it('schreibt den Ausschnitt der Karte als bbox', () => {
    const { api, http } = build();

    api.shared({ west: 9, south: 48, ost: 10, nord: 49 }).subscribe();

    const request = http.expectOne('/api/finds?mine=false&bbox=9,48,10,49&limit=50');
    expect(request.request.method).toBe('GET');
    request.flush(findPage([]));
  });

  it('lässt die bbox weg, wenn kein Ausschnitt gefragt ist', () => {
    const { api, http } = build();

    api.shared().subscribe();

    http.expectOne(SHARED_URL).flush(findPage([]));
  });

  it('bildet Art, Ort und Prüfstand des Vertrags ab', () => {
    const { api, http } = build();
    let seen: readonly unknown[] = [];

    api.shared().subscribe((finds) => (seen = finds));
    http.expectOne(SHARED_URL).flush(findPage([SHARED_FIND_ENTRY]));

    expect(seen).toEqual([SHARED_FIND]);
  });

  it('lässt einen Fund ohne Ort weg', () => {
    const { api, http } = build();
    let seen: readonly unknown[] = [];

    api.shared().subscribe((finds) => (seen = finds));
    http
      .expectOne(SHARED_URL)
      .flush(findPage([{ id: 'ohne-ort', updatedAt: '2026-09-04T10:00:00+02:00', deleted: false }]));

    expect(seen).toEqual([]);
  });

  it('meldet einen fehlenden Weg nicht als Toast', () => {
    const { api, http, toasts } = build();

    api.shared().subscribe({ error: () => undefined });
    http.expectOne(SHARED_URL).flush({ code: 'not_found' }, { status: 404, statusText: '' });

    expect(toasts.failure).toEqual([]);
  });

  it('meldet einen Ausfall des Dienstes weiterhin als Toast', () => {
    const { api, http, toasts } = build();

    api.shared().subscribe({ error: () => undefined });
    http.expectOne(SHARED_URL).flush({ code: 'internal' }, { status: 500, statusText: '' });

    expect(toasts.failure).toHaveLength(1);
  });
});
