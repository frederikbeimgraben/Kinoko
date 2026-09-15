import { Injectable, inject } from '@angular/core';
import { map, type Observable } from 'rxjs';
import { ApiClient } from './api-client';
import type { components } from './contract';
import { ENTRY_PATHS } from './entry-paths';
import { marker as readMarker, ownFind, zone as readZone } from './entry-reader';
import type { Find, FindWrite, Marker, MarkerWrite, Zone, ZoneValue, ZoneWrite } from './models';

type FindEntry = components['schemas']['Find'];
type MarkerEntry = components['schemas']['Marker'];
type ZoneEntry = components['schemas']['Zone'];
type FindPage = components['schemas']['FindPage'];
type MarkerPage = components['schemas']['MarkerPage'];
type ZonePage = components['schemas']['ZonePage'];

/** So viele Einträge holt eine Seite. Der Vertrag erlaubt höchstens 50. */
const PAGE_SIZE = 50;

function id(value: string): string {
  return encodeURIComponent(value);
}

/** Die eigenen Funde, Marker und Zonen. Jede Route braucht ein Konto. */
@Injectable({ providedIn: 'root' })
export class EntriesApi {
  private readonly api = inject(ApiClient);

  finds(): Observable<readonly Find[]> {
    return this.api
      .get<FindPage>(ENTRY_PATHS.find, { mine: true, limit: PAGE_SIZE })
      .pipe(map((answer) => read(answer.items, ownFind)));
  }

  createFind(body: FindWrite): Observable<Find | null> {
    return this.api.post<FindEntry>(ENTRY_PATHS.find, body).pipe(map(ownFind));
  }

  putFind(target: string, body: FindWrite): Observable<Find | null> {
    return this.api.put<FindEntry>(`${ENTRY_PATHS.find}/${id(target)}`, body).pipe(map(ownFind));
  }

  deleteFind(target: string): Observable<null> {
    return this.api.delete<null>(`${ENTRY_PATHS.find}/${id(target)}`);
  }

  markers(): Observable<readonly Marker[]> {
    return this.api
      .get<MarkerPage>(ENTRY_PATHS.marker, { limit: PAGE_SIZE })
      .pipe(map((answer) => read(answer.items, readMarker)));
  }

  createMarker(body: MarkerWrite): Observable<Marker | null> {
    return this.api.post<MarkerEntry>(ENTRY_PATHS.marker, body).pipe(map(readMarker));
  }

  putMarker(target: string, body: MarkerWrite): Observable<Marker | null> {
    return this.api.put<MarkerEntry>(`${ENTRY_PATHS.marker}/${id(target)}`, body).pipe(map(readMarker));
  }

  deleteMarker(target: string): Observable<null> {
    return this.api.delete<null>(`${ENTRY_PATHS.marker}/${id(target)}`);
  }

  zones(): Observable<readonly Zone[]> {
    return this.api
      .get<ZonePage>(ENTRY_PATHS.zone, { limit: PAGE_SIZE })
      .pipe(map((answer) => read(answer.items, readZone)));
  }

  createZone(body: ZoneWrite): Observable<Zone | null> {
    return this.api.post<ZoneEntry>(ENTRY_PATHS.zone, body).pipe(map(readZone));
  }

  putZone(target: string, body: ZoneWrite): Observable<Zone | null> {
    return this.api.put<ZoneEntry>(`${ENTRY_PATHS.zone}/${id(target)}`, body).pipe(map(readZone));
  }

  deleteZone(target: string): Observable<null> {
    return this.api.delete<null>(`${ENTRY_PATHS.zone}/${id(target)}`);
  }

  /** Das Flächenmittel der Vorhersage in der Zone, für genau Art und Woche. */
  zoneValue(target: string, speciesId: string, year: number, week: number): Observable<ZoneValue> {
    return this.api.get<ZoneValue>(`${ENTRY_PATHS.zone}/${id(target)}/value`, {
      speciesId,
      year,
      week,
    });
  }
}

function read<E, T>(items: readonly E[], of: (entry: E) => T | null): readonly T[] {
  return items.flatMap((entry) => of(entry) ?? []);
}
