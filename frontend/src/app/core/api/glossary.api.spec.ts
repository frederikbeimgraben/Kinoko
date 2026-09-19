import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { GLOSSARY, HYMENIUM } from '../../testing/glossary-fixture';
import { GlossaryApi } from './glossary.api';

function build(): { api: GlossaryApi; http: HttpTestingController } {
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  return { api: TestBed.inject(GlossaryApi), http: TestBed.inject(HttpTestingController) };
}

describe('GlossaryApi', () => {
  it('liest die Begriffe', () => {
    const { api, http } = build();
    let seen = 0;

    api.list().subscribe((entries) => {
      seen = entries.length;
    });
    http.expectOne('/api/glossary').flush({ items: GLOSSARY });

    expect(seen).toBe(2);
    http.verify();
  });

  it('legt an, ändert und löscht', () => {
    const { api, http } = build();
    const write = { term: 'Velum', definition: 'Schutzhülle.' };

    api.create(write).subscribe();
    http.expectOne({ url: '/api/glossary', method: 'POST' }).flush(HYMENIUM);
    api.update('begriff-eins', write).subscribe();
    http.expectOne({ url: '/api/glossary/begriff-eins', method: 'PUT' }).flush(HYMENIUM);
    api.remove('begriff-eins').subscribe();

    expect(http.expectOne('/api/glossary/begriff-eins').request.method).toBe('DELETE');
    http.verify();
  });
});
