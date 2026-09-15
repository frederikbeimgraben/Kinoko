import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  FIND,
  FIND_ENTRY,
  MARKER,
  MARKER_ENTRY,
  ZONE,
  ZONE_ENTRY,
  page,
} from '../../testing/entries-fixture';
import { EntriesApi } from './entries.api';

interface Setup {
  api: EntriesApi;
  http: HttpTestingController;
}

function build(): Setup {
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  return { api: TestBed.inject(EntriesApi), http: TestBed.inject(HttpTestingController) };
}

const FIND_WRITE = {
  speciesId: FIND.speciesId,
  lat: FIND.lat,
  lon: FIND.lon,
  foundOn: FIND.foundOn,
  count: FIND.count,
  note: FIND.note,
  visibility: FIND.visibility,
  forTraining: FIND.forTraining,
};

const MARKER_WRITE = {
  name: MARKER.name,
  lat: MARKER.lat,
  lon: MARKER.lon,
  colour: MARKER.colour,
  note: MARKER.note,
  visibility: MARKER.visibility,
};

const ZONE_WRITE = {
  name: ZONE.name,
  polygon: ZONE.polygon,
  colour: ZONE.colour,
  note: ZONE.note,
  visibility: ZONE.visibility,
};

describe('EntriesApi', () => {
  it('holt die eigenen Listen über die Wege des Vertrags', () => {
    const { api, http } = build();

    api.finds().subscribe();
    api.markers().subscribe();
    api.zones().subscribe();

    expect(http.expectOne('/api/finds?mine=true&limit=50').request.method).toBe('GET');
    http.expectOne('/api/markers?limit=50').flush(page([MARKER_ENTRY]));
    http.expectOne('/api/zones?limit=50').flush(page([ZONE_ENTRY]));
  });

  it('liest aus einer Seite die Objekte des Geräts', () => {
    const { api, http } = build();
    let found: readonly unknown[] = [];

    api.finds().subscribe((items) => {
      found = items;
    });
    http.expectOne('/api/finds?mine=true&limit=50').flush(page([FIND_ENTRY]));

    expect(found).toEqual([FIND]);
  });

  it('lässt einen Grabstein aus der Liste', () => {
    const { api, http } = build();
    let found: readonly unknown[] = [];

    api.markers().subscribe((items) => {
      found = items;
    });
    http.expectOne('/api/markers?limit=50').flush(page([{ ...MARKER_ENTRY, deleted: true }]));

    expect(found).toEqual([]);
  });

  it('legt einen Fund an, ersetzt ihn mit PUT und löscht ihn', () => {
    const { api, http } = build();

    api.createFind(FIND_WRITE).subscribe();
    const create = http.expectOne({ url: '/api/finds', method: 'POST' });
    expect(create.request.body).toEqual(FIND_WRITE);
    create.flush(FIND_ENTRY);

    api.putFind(FIND.id, { ...FIND_WRITE, count: 4 }).subscribe();
    const replace = http.expectOne({ url: `/api/finds/${FIND.id}`, method: 'PUT' });
    expect(replace.request.body).toMatchObject({ count: 4, forTraining: true });
    replace.flush(FIND_ENTRY);

    api.deleteFind(FIND.id).subscribe();
    expect(http.expectOne(`/api/finds/${FIND.id}`).request.method).toBe('DELETE');
  });

  it('legt Marker und Zonen an, ersetzt und löscht sie', () => {
    const { api, http } = build();

    api.createMarker(MARKER_WRITE).subscribe();
    http.expectOne({ url: '/api/markers', method: 'POST' }).flush(MARKER_ENTRY);
    api.putMarker(MARKER.id, { ...MARKER_WRITE, name: 'Neu' }).subscribe();
    http.expectOne({ url: `/api/markers/${MARKER.id}`, method: 'PUT' }).flush(MARKER_ENTRY);
    api.deleteMarker(MARKER.id).subscribe();
    http.expectOne({ url: `/api/markers/${MARKER.id}`, method: 'DELETE' }).flush(null);

    api.createZone(ZONE_WRITE).subscribe();
    http.expectOne({ url: '/api/zones', method: 'POST' }).flush(ZONE_ENTRY);
    api.putZone(ZONE.id, { ...ZONE_WRITE, name: 'Neu' }).subscribe();
    http.expectOne({ url: `/api/zones/${ZONE.id}`, method: 'PUT' }).flush(ZONE_ENTRY);
    api.deleteZone(ZONE.id).subscribe();
    http.expectOne({ url: `/api/zones/${ZONE.id}`, method: 'DELETE' }).flush(null);
  });

  it('fragt den Zonenwert mit Art, Jahr und Woche des Vertrags', () => {
    const { api, http } = build();

    api.zoneValue(ZONE.id, 'steinpilz', 2025, 40).subscribe();

    http
      .expectOne(`/api/zones/${ZONE.id}/value?speciesId=steinpilz&year=2025&week=40`)
      .flush({ speciesId: 'steinpilz', year: 2025, week: 40, areaMean: 18, points: 12, ownFinds: 2 });
  });
});
