import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { taxonPage, taxonStep } from '../../testing/species-fixture';
import { TaxaApi } from './taxa.api';

const NOT_FOUND = 404;

describe('TaxaApi', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  });

  it('holt eine Stufe über Rang und Slug', async () => {
    const api = TestBed.inject(TaxaApi);
    const page = taxonPage({
      rank: 'genus',
      slug: 'boletus',
      name: 'Boletus',
      path: [taxonStep('family', 'boletaceae', 'Boletaceae')],
    });
    const answer = firstValueFrom(api.page('genus', 'boletus'));

    const request = TestBed.inject(HttpTestingController).expectOne('/api/taxa/genus/boletus');
    expect(request.request.method).toBe('GET');
    request.flush(page);

    expect((await answer).path[0].slug).toBe('boletaceae');
  });

  it('kodiert einen Slug mit Sonderzeichen für den Weg', () => {
    const api = TestBed.inject(TaxaApi);
    void firstValueFrom(api.page('family', 'a/b'));

    TestBed.inject(HttpTestingController).expectOne('/api/taxa/family/a%2Fb');
  });

  it('reicht eine unbekannte Stufe als Problem weiter', async () => {
    const api = TestBed.inject(TaxaApi);
    const answer = firstValueFrom(api.page('genus', 'nichts')).catch((problem: unknown) => problem);

    TestBed.inject(HttpTestingController)
      .expectOne('/api/taxa/genus/nichts')
      .flush(null, { status: NOT_FOUND, statusText: 'Not Found' });

    expect(await answer).toHaveProperty('status', NOT_FOUND);
  });
});
