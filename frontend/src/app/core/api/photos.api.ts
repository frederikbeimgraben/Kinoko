import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { ApiClient, type Query, type Silent, type Upload } from './api-client';
import { ENTRY_PATHS } from './entry-paths';
import type { Licence, Photo, PhotoState } from './models';

const PATH = ENTRY_PATHS.photo;

/** Ein Foto am eigenen Fund gehört der Person, die es aufgenommen hat. */
const OWN_LICENCE: Licence = 'own';

/** Was der Dienst neben der Datei erwartet. Fotograf und Lizenz sind Pflicht. */
export interface PhotoInput {
  speciesId?: string;
  findId?: string;
  photographer: string;
  licence: Licence;
  caption?: string;
  source?: string;
  takenOn?: string;
}

/** Eine Seite Fotos. Der Zeiger führt zur nächsten. */
export interface PhotoPage {
  items: Photo[];
  nextCursor: string | null;
}

/** Wonach eine Seite Fotos gesucht wird. */
export interface PhotoQuery {
  state?: PhotoState;
  speciesId?: string;
  findId?: string;
  mine?: boolean;
  limit?: number;
  cursor?: string;
}

/** Die Fotos des Vertrags: lesen, einreichen, prüfen, Titelbild setzen. */
@Injectable({ providedIn: 'root' })
export class PhotosApi {
  private readonly api = inject(ApiClient);

  list(query: PhotoQuery = {}): Observable<PhotoPage> {
    return this.api.get<PhotoPage>(PATH, query as Query);
  }

  get(id: string): Observable<Photo> {
    return this.api.get<Photo>(`${PATH}/${encodeURIComponent(id)}`);
  }

  /** Lädt ein Foto hoch und meldet den Anteil. */
  create(input: PhotoInput, file: File): Observable<Upload<Photo>> {
    return this.api.uploadFile<Photo>(PATH, 'file', file, { ...input });
  }

  /** Ein Foto an einem eigenen Fund. Der Fund trägt das Recht daran. */
  ofFind(findId: string, photographer: string, file: File, options?: Silent): Observable<Photo> {
    return this.api.postFile<Photo>(
      PATH,
      'file',
      file,
      { findId, photographer, licence: OWN_LICENCE },
      options,
    );
  }

  remove(id: string): Observable<null> {
    return this.api.delete<null>(`${PATH}/${encodeURIComponent(id)}`);
  }

  approve(id: string): Observable<Photo> {
    return this.api.post<Photo>(`${PATH}/${encodeURIComponent(id)}/approval`);
  }

  reject(id: string, reason: string): Observable<Photo> {
    return this.api.post<Photo>(`${PATH}/${encodeURIComponent(id)}/rejection`, { reason });
  }

  setLead(id: string): Observable<Photo> {
    return this.api.put<Photo>(`${PATH}/${encodeURIComponent(id)}/lead`, {});
  }
}
