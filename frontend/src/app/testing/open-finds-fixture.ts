import { of, type Observable } from 'rxjs';
import { FindsApi } from '../core/api/finds.api';
import { PhotosApi, type PhotoPage, type PhotoQuery } from '../core/api/photos.api';
import type { OpenFind, Photo } from '../core/api/models';
import { photo } from './photos-fixture';

type Decision = 'accepted' | 'rejected';

export function openFind(part: Partial<OpenFind> & Pick<OpenFind, 'id'>): OpenFind {
  return {
    ownerId: 'person-eins',
    speciesId: 'boletus-edulis',
    lat: 48.5203,
    lon: 9.0511,
    foundOn: '2026-09-06',
    count: 3,
    note: null,
    reviewState: 'open',
    ...part,
  };
}

export const FIRST_FIND = openFind({ id: 'fund-eins', note: 'Am Wegrand' });
export const SECOND_FIND = openFind({ id: 'fund-zwei', count: null, lat: 48.6, lon: 9.1 });

export const OPEN_FINDS: OpenFind[] = [FIRST_FIND, SECOND_FIND];

/** Ein Doppelgänger der Fund-API. Der Test liest nach, was entschieden wurde. */
export class FindsApiDouble {
  findList: readonly OpenFind[] = OPEN_FINDS;

  readonly reviewed: { id: string; decision: Decision }[] = [];
  accepted = 0;

  open(): Observable<readonly OpenFind[]> {
    return of(this.findList);
  }

  review(id: string, decision: Decision): Observable<null> {
    this.reviewed.push({ id, decision });
    return of(null);
  }

  acceptAll(): Observable<null> {
    this.accepted += 1;
    return of(null);
  }
}

/** Ein Doppelgänger der Foto-API. Er liefert je Fund ein Foto. */
export class FindPhotosApiDouble {
  readonly asked: string[] = [];
  photoList: readonly Photo[] = [photo({ id: 'bild-fund', findId: 'fund-eins', speciesId: null })];

  list(query: PhotoQuery = {}): Observable<PhotoPage> {
    this.asked.push(query.findId ?? '');
    const items = this.photoList.filter((one) => one.findId === query.findId);
    return of({ items, nextCursor: null });
  }
}

export function findsApiProvider(double: FindsApiDouble): {
  provide: typeof FindsApi;
  useValue: unknown;
} {
  return { provide: FindsApi, useValue: double };
}

export function findPhotosApiProvider(double: FindPhotosApiDouble): {
  provide: typeof PhotosApi;
  useValue: unknown;
} {
  return { provide: PhotosApi, useValue: double };
}
