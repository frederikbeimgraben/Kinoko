import { TestBed } from '@angular/core/testing';
import { catalogueProviders, catalogueReady } from '../../testing/catalogue-double';
import { speciesBundle, speciesEntry } from '../../testing/species-fixture';
import { LISTING_PAGE, SpeciesListingStore } from './species-listing.store';

/** More species than two pages, named so that the name sort keeps the number order. */
const MANY = Array.from({ length: LISTING_PAGE * 2 + 5 }, (_, index) =>
  speciesEntry({
    slug: `art-${index}`,
    name: `Art ${String(index).padStart(3, '0')}`,
    scientificName: `Species ${index}`,
  }),
);

async function store(): Promise<SpeciesListingStore> {
  localStorage.removeItem('pilzkarte.speciesfilter');
  TestBed.configureTestingModule({ providers: catalogueProviders(speciesBundle(MANY)) });
  await catalogueReady();
  return TestBed.inject(SpeciesListingStore);
}

describe('SpeciesListingStore', () => {
  it('shows one page at first', async () => {
    const listing = await store();

    expect(listing.hits()).toHaveLength(LISTING_PAGE);
  });

  it('reveals the pages up to a species far down the list', async () => {
    const listing = await store();

    listing.reveal(`art-${LISTING_PAGE + 3}`);

    expect(listing.hits()).toHaveLength(LISTING_PAGE * 2);
    expect(listing.hits().some((one) => one.species.slug === `art-${LISTING_PAGE + 3}`)).toBe(true);
  });

  it('keeps the list for a species on the first page or out of the list', async () => {
    const listing = await store();

    listing.reveal('art-2');
    listing.reveal('gibt-es-nicht');

    expect(listing.hits()).toHaveLength(LISTING_PAGE);
  });
});
