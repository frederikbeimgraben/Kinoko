import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { SPECIES_BUNDLE } from '../../testing/species-fixture';
import { SpeciesApi } from './species.api';

const NOT_MODIFIED = 304;

describe('SpeciesApi', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  });

  it('holt das Bündel ohne ETag und reicht das neue weiter', async () => {
    const api = TestBed.inject(SpeciesApi);
    const answer = firstValueFrom(api.bundle(null));

    const request = TestBed.inject(HttpTestingController).expectOne('/api/species/bundle');
    expect(request.request.method).toBe('GET');
    expect(request.request.headers.has('If-None-Match')).toBe(false);
    request.flush(SPECIES_BUNDLE, { headers: { ETag: 'w/"eins"' } });

    expect(await answer).toEqual({ etag: 'w/"eins"', body: SPECIES_BUNDLE });
  });

  it('fragt mit bekanntem ETag und lässt den Körper zum bekannten Stand leer', async () => {
    const api = TestBed.inject(SpeciesApi);
    const answer = firstValueFrom(api.bundle('w/"eins"'));

    const request = TestBed.inject(HttpTestingController).expectOne('/api/species/bundle');
    expect(request.request.headers.get('If-None-Match')).toBe('w/"eins"');
    request.flush(null, { status: NOT_MODIFIED, statusText: 'Not Modified' });

    expect(await answer).toEqual({ etag: 'w/"eins"', body: null });
  });

  it('reicht einen Fehler weiter, statt still einen leeren Stand zu melden', async () => {
    const api = TestBed.inject(SpeciesApi);
    const answer = firstValueFrom(api.bundle(null)).catch((problem: unknown) => problem);

    TestBed.inject(HttpTestingController)
      .expectOne('/api/species/bundle')
      .error(new ProgressEvent('error'), { status: 0 });

    expect(await answer).not.toBeInstanceOf(HttpErrorResponse);
    expect(await answer).toHaveProperty('status', 0);
  });
});
