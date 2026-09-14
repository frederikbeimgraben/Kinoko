import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { SpeciesBundle } from '../../core/api/models';
import { OfflineStoreDouble, offlineProvider } from '../../testing/offline-double';
import { PENNY_BUN, SPECIES_BUNDLE, speciesEntry } from '../../testing/species-fixture';
import { SpeciesState } from './species.state';

const NOT_MODIFIED = 304;
const BUNDLE_PATH = '/api/species/bundle';
const TERMS_PATH = '/api/terms';

const SMELL = { id: 'term-anis', kind: 'smell', slug: 'anis', name: 'Anis', position: 1 } as const;

const LOCAL: SpeciesBundle = {
  items: [speciesEntry({ slug: 'pfifferling', name: 'Pfifferling', scientificName: 'Cantharellus cibarius' })],
};

interface Setup {
  state: SpeciesState;
  http: HttpTestingController;
  offline: OfflineStoreDouble;
}

function build(stored?: { bundle?: SpeciesBundle; etag?: string }): Setup {
  const offline = new OfflineStoreDouble();
  if (stored?.bundle) void offline.put('catalog', 'bundle', stored.bundle);
  if (stored?.etag) void offline.put('catalog', 'etag', stored.etag);
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting(), offlineProvider(offline)],
  });
  return {
    state: TestBed.inject(SpeciesState),
    http: TestBed.inject(HttpTestingController),
    offline,
  };
}

describe('SpeciesState', () => {
  it('lädt und legt Bündel, ETag und Begriffe auf dem Gerät ab', async () => {
    const setup = build();
    const loaded = setup.state.loadBundle();

    await vi.waitFor(() => {
      setup.http.expectOne(BUNDLE_PATH).flush(SPECIES_BUNDLE, { headers: { ETag: 'w/"eins"' } });
    });
    await vi.waitFor(() => {
      setup.http.expectOne(TERMS_PATH).flush({ items: [SMELL] });
    });
    await loaded;

    expect(setup.state.species()).toHaveLength(3);
    expect(setup.state.loading()).toBe(false);
    expect(setup.offline.values.get('catalog/etag')).toBe('w/"eins"');
    expect(setup.offline.values.get('catalog/bundle')).toEqual(SPECIES_BUNDLE);
    expect(setup.offline.values.get('catalog/terms')).toEqual([SMELL]);
  });

  it('zeigt zuerst den lokalen Stand und gleicht ihn danach mit ETag ab', async () => {
    const setup = build({ bundle: LOCAL, etag: 'w/"alt"' });
    void setup.state.loadBundle();

    await vi.waitFor(() => {
      expect(setup.state.species().map((one) => one.slug)).toEqual(['pfifferling']);
    });
    const request = await vi.waitFor(() => setup.http.expectOne(BUNDLE_PATH));
    expect(request.request.headers.get('If-None-Match')).toBe('w/"alt"');
    request.flush(SPECIES_BUNDLE, { headers: { ETag: 'w/"neu"' } });

    await vi.waitFor(() => {
      expect(setup.state.species()).toHaveLength(3);
    });
  });

  it('lässt den Stand stehen, wenn der Dienst 304 meldet', async () => {
    const setup = build({ bundle: LOCAL, etag: 'w/"alt"' });
    void setup.state.loadBundle();

    await vi.waitFor(() => {
      setup.http
        .expectOne(BUNDLE_PATH)
        .flush(null, { status: NOT_MODIFIED, statusText: 'Not Modified' });
    });
    await vi.waitFor(() => {
      setup.http.expectOne(TERMS_PATH).flush({ items: [] });
    });

    expect(setup.state.species().map((one) => one.slug)).toEqual(['pfifferling']);
    expect(setup.state.failed()).toBe(false);
  });

  it('meldet einen Fehler nur ohne lokalen Stand', async () => {
    const setup = build();
    void setup.state.loadBundle();

    await vi.waitFor(() => {
      setup.http.expectOne(BUNDLE_PATH).error(new ProgressEvent('error'));
    });

    await vi.waitFor(() => {
      expect(setup.state.failed()).toBe(true);
    });
    expect(setup.state.loading()).toBe(false);
  });

  it('bleibt ohne Fehler, wenn der Dienst zum lokalen Stand schweigt', async () => {
    const setup = build({ bundle: LOCAL });
    void setup.state.loadBundle();

    await vi.waitFor(() => {
      setup.http.expectOne(BUNDLE_PATH).error(new ProgressEvent('error'));
    });

    await vi.waitFor(() => {
      expect(setup.state.species()).toHaveLength(1);
    });
    expect(setup.state.failed()).toBe(false);
  });

  it('versucht es mit reload erneut', async () => {
    const setup = build();
    void setup.state.loadBundle();
    await vi.waitFor(() => {
      setup.http.expectOne(BUNDLE_PATH).error(new ProgressEvent('error'));
    });
    await vi.waitFor(() => {
      expect(setup.state.failed()).toBe(true);
    });

    setup.state.reload();

    expect(setup.state.failed()).toBe(false);
    await vi.waitFor(() => {
      setup.http.expectOne(BUNDLE_PATH).flush(SPECIES_BUNDLE);
    });
    await vi.waitFor(() => {
      expect(setup.state.species()).toHaveLength(3);
    });
  });

  it('fragt nur einmal, solange ein Lauf offen ist', async () => {
    const setup = build();
    void setup.state.loadBundle();
    void setup.state.loadBundle();

    await vi.waitFor(() => {
      setup.http.expectOne(BUNDLE_PATH).flush(SPECIES_BUNDLE);
    });
    await vi.waitFor(() => {
      setup.http.expectOne(TERMS_PATH).flush({ items: [] });
    });

    setup.http.verify();
  });

  it('findet eine Art und ihren Namen über den Slug', async () => {
    const setup = build({ bundle: SPECIES_BUNDLE });
    void setup.state.loadBundle();

    await vi.waitFor(() => {
      expect(setup.state.entryOf('steinpilz')).toEqual(PENNY_BUN);
    });
    expect(setup.state.nameOf('steinpilz')).toBe('Steinpilz');
    expect(setup.state.entryOf('nichts')).toBeNull();
    expect(setup.state.nameOf('nichts')).toBeNull();
  });

  it('merkt sich die gewählte Art', () => {
    const setup = build();

    expect(setup.state.activeSpecies()).toBeNull();
    setup.state.select('steinpilz');

    expect(setup.state.activeSpecies()).toBe('steinpilz');
  });

  it('rechnet zu jeder Art ihre Achsen, sobald die Begriffe da sind', async () => {
    const withTerm = speciesEntry({
      slug: 'steinpilz',
      name: 'Steinpilz',
      scientificName: 'Boletus edulis',
      terms: [{ term: { id: SMELL.id, slug: SMELL.slug, name: SMELL.name }, fromExperience: false }],
    });
    const setup = build();
    void setup.state.loadBundle();

    await vi.waitFor(() => {
      setup.http.expectOne(BUNDLE_PATH).flush({ items: [withTerm] });
    });
    await vi.waitFor(() => {
      setup.http.expectOne(TERMS_PATH).flush({ items: [SMELL] });
    });

    await vi.waitFor(() => {
      expect(setup.state.facts()[0].values.get('senses')).toEqual(['anis']);
    });
    expect(setup.state.entries()).toHaveLength(1);
  });
});
