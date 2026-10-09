import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { ApiClient, type Query, type Silent, type Upload } from './api-client';
import { ENTRY_PATHS } from './entry-paths';
import type { Licence, Photo, PhotoState } from './models';

const PATH = ENTRY_PATHS.photo;

/** A photo of the user's own find belongs to the person who took it. */
const OWN_LICENCE: Licence = 'own';

/** The fields that the service needs with the file. Photographer and licence are mandatory. */
export interface PhotoInput {
  speciesId?: string;
  findId?: string;
  photographer: string;
  licence: Licence;
  caption?: string;
  source?: string;
  takenOn?: string;
}

/** A page of photos. The cursor points to the next page. */
export interface PhotoPage {
  items: Photo[];
  nextCursor: string | null;
}

/** The filters for a page of photos. */
export interface PhotoQuery {
  state?: PhotoState;
  speciesId?: string;
  findId?: string;
  mine?: boolean;
  limit?: number;
  cursor?: string;
}

/** The contract photos: read, submit, review, set the lead photo. */
@Injectable({ providedIn: 'root' })
export class PhotosApi {
  private readonly api = inject(ApiClient);

  list(query: PhotoQuery = {}): Observable<PhotoPage> {
    return this.api.get<PhotoPage>(PATH, query as Query);
  }

  get(id: string): Observable<Photo> {
    return this.api.get<Photo>(`${PATH}/${encodeURIComponent(id)}`);
  }

  /** Uploads a photo and reports the progress. */
  create(input: PhotoInput, file: File): Observable<Upload<Photo>> {
    return this.api.uploadFile<Photo>(PATH, 'file', file, { ...input });
  }

  /** A photo of the user's own find. The permission comes from the find. */
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

  /** Takes back an approval or a rejection: the photo waits for review again. */
  reopen(id: string): Observable<Photo> {
    return this.api.delete<Photo>(`${PATH}/${encodeURIComponent(id)}/review`);
  }

  setLead(id: string): Observable<Photo> {
    return this.api.put<Photo>(`${PATH}/${encodeURIComponent(id)}/lead`, {});
  }
}
