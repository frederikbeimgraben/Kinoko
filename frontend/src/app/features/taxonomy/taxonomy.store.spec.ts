import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { taxonPage } from '../../testing/species-fixture';
import { TaxonomyStore, taxonKey } from './taxonomy.store';

const NOT_FOUND = 404;

function build(): { store: TaxonomyStore; http: HttpTestingController } {
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  return { store: TestBed.inject(TaxonomyStore), http: TestBed.inject(HttpTestingController) };
}

describe('TaxonomyStore', () => {
  it('loads a step one time and keeps it by rank and slug', () => {
    const { store, http } = build();
    const page = taxonPage({ rank: 'genus', slug: 'boletus', name: 'Boletus' });

    store.load({ rank: 'genus', slug: 'boletus' });
    store.load({ rank: 'genus', slug: 'boletus' });
    http.expectOne('/api/taxa/genus/boletus').flush(page);

    expect(store.pageOf('genus', 'boletus')).toEqual(page);
    expect(store.isUnknown('genus', 'boletus')).toBe(false);
    http.verify();
  });

  it('marks a step that the service does not know', () => {
    const { store, http } = build();

    store.load({ rank: 'genus', slug: 'nichts' });
    http.expectOne('/api/taxa/genus/nichts').flush(null, { status: NOT_FOUND, statusText: 'Not Found' });

    expect(store.isUnknown('genus', 'nichts')).toBe(true);
    expect(store.pageOf('genus', 'nichts')).toBeNull();
  });

  it('sends no request for an address without a known rank', () => {
    const { store, http } = build();

    store.load(null);

    http.expectNone(() => true);
  });

  it('makes one key from rank and slug', () => {
    expect(taxonKey({ rank: 'family', slug: 'boletaceae' })).toBe('family/boletaceae');
  });
});
