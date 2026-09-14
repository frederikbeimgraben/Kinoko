import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { SPECIES_LIST, STEINPILZ } from '../../testing/species-fixture';
import { speciesImage } from '../../testing/species-images-fixture';
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { OfflineStore } from '../../core/offline/offline-store';
import { SpeciesState } from './species.state';

function build(): { state: SpeciesState; http: HttpTestingController } {
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  return { state: TestBed.inject(SpeciesState), http: TestBed.inject(HttpTestingController) };
}

const BUNDLE = { items: [], standardColours: [], facets: { species: 0, groups: [] } };

describe('ArtenZustand · Katalog vom Gerät', () => {
  beforeEach(() => {
    vi.stubGlobal('indexedDB', new IDBFactory());
  });

  it('legt den Katalog mit seinem ETag ab', async () => {
    const { state, http } = build();

    const loaded = state.loadBundle();
    await vi.waitFor(() => {
      http.expectOne('/api/species/bundle').flush(BUNDLE, { headers: { ETag: 'W/"eins"' } });
    });
    await loaded;

    expect(state.bundle()).toEqual(BUNDLE);
    expect(await TestBed.inject(OfflineStore).get('catalog', 'etag')).toBe('W/"eins"');
  });

  it('zeigt den Stand vom Gerät und behält ihn bei 304', async () => {
    const { state, http } = build();
    const offline = TestBed.inject(OfflineStore);
    await offline.put('catalog', 'bundle', BUNDLE);
    await offline.put('catalog', 'etag', 'W/"eins"');

    const loaded = state.loadBundle();
    await vi.waitFor(() => {
      const request = http.expectOne('/api/species/bundle');
      expect(request.request.headers.get('If-None-Match')).toBe('W/"eins"');
      request.flush(null, { status: 304, statusText: 'Not Modified' });
    });
    await loaded;

    expect(state.bundle()).toEqual(BUNDLE);
  });

  it('bleibt ohne Netz beim Stand des Geräts', async () => {
    const { state, http } = build();
    await TestBed.inject(OfflineStore).put('catalog', 'bundle', BUNDLE);

    const loaded = state.loadBundle();
    await vi.waitFor(() => {
      http.expectOne('/api/species/bundle').error(new ProgressEvent('error'));
    });
    await loaded;

    expect(state.bundle()).toEqual(BUNDLE);
  });
});

describe('ArtenZustand', () => {
  it('holt die Liste einmal und behält sie', () => {
    const { state, http } = build();

    state.loadCatalogue();
    state.loadCatalogue();
    http.expectOne('/api/arten').flush(SPECIES_LIST);
    state.loadCatalogue();

    expect(state.catalogue()?.arten).toHaveLength(5);
    http.verify();
  });

  it('lässt eine gescheiterte Liste einen zweiten Versuch zu', () => {
    const { state, http } = build();

    state.loadCatalogue();
    http.expectOne('/api/arten').flush('', { status: 503, statusText: 'Service Unavailable' });
    state.loadCatalogue();
    http.expectOne('/api/arten').flush(SPECIES_LIST);

    expect(state.catalogue()).not.toBeNull();
  });

  it('merkt sich ein Profil je Slug', () => {
    const { state, http } = build();

    state.loadProfile('steinpilz');
    state.loadProfile('steinpilz');
    http.expectOne('/api/arten/steinpilz').flush(STEINPILZ);
    state.loadProfile('steinpilz');

    expect(state.profile().get('steinpilz')?.name).toBe('Steinpilz');
    http.verify();
  });

  it('merkt einen unbekannten Slug und fragt nicht noch einmal', () => {
    const { state, http } = build();

    state.loadProfile('gibtsnicht');
    http
      .expectOne('/api/arten/gibtsnicht')
      .flush(
        { type: 'about:blank', title: 'Nicht gefunden', status: 404 },
        { status: 404, statusText: 'Not Found' },
      );
    state.loadProfile('gibtsnicht');

    expect(state.unknown().has('gibtsnicht')).toBe(true);
    expect(state.profile().has('gibtsnicht')).toBe(false);
    http.verify();
  });

  it('führt die aktive Art', () => {
    const { state } = build();

    expect(state.activeSpecies()).toBeNull();
    state.select('steinpilz');

    expect(state.activeSpecies()).toBe('steinpilz');
  });

  it('holt die Bilder einer Art einmal und behält sie', () => {
    const { state, http } = build();

    state.loadImages('steinpilz');
    state.loadImages('steinpilz');
    http.expectOne('/api/species-images?species=steinpilz').flush([speciesImage()]);
    state.loadImages('steinpilz');

    expect(state.images().get('steinpilz')).toHaveLength(1);
    http.verify();
  });

  it('merkt sich auch eine Art ganz ohne Bild', () => {
    const { state, http } = build();

    state.loadImages('parasol');
    http.expectOne('/api/species-images?species=parasol').flush([]);
    state.loadImages('parasol');

    expect(state.images().get('parasol')).toEqual([]);
    http.verify();
  });

  it('lässt einen gescheiterten Bildabruf einen zweiten Versuch zu', () => {
    const { state, http } = build();

    state.loadImages('steinpilz');
    http
      .expectOne('/api/species-images?species=steinpilz')
      .flush('', { status: 503, statusText: 'Service Unavailable' });
    state.loadImages('steinpilz');
    http.expectOne('/api/species-images?species=steinpilz').flush([speciesImage()]);

    expect(state.images().get('steinpilz')).toHaveLength(1);
  });
});
