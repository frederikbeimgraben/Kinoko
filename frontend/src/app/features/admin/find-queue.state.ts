import { Injectable, inject, signal } from '@angular/core';
import { tap, type Observable } from 'rxjs';
import { FindsApi } from '../../core/api/finds.api';
import { PhotosApi } from '../../core/api/photos.api';
import type { OpenFind, Photo } from '../../core/api/models';

/** Die Entscheidung über einen Fund. */
export type Decision = 'accepted' | 'rejected';

/** Die offenen Funde der Prüfung, dazu die Fotos je Fund. */
@Injectable({ providedIn: 'root' })
export class FindQueueState {
  private readonly api = inject(FindsApi);
  private readonly photosApi = inject(PhotosApi);

  private readonly _open = signal<readonly OpenFind[]>([]);
  private readonly _photos = signal<Readonly<Record<string, readonly Photo[]>>>({});

  readonly open = this._open.asReadonly();
  readonly photos = this._photos.asReadonly();

  load(): void {
    this.api.open().subscribe((finds) => {
      this._open.set(finds);
    });
  }

  /** Holt die Fotos eines Fundes einmal. Ein zweiter Ruf bleibt still. */
  loadPhotos(id: string): void {
    if (id in this._photos()) return;
    this._photos.update((all) => ({ ...all, [id]: [] }));
    this.photosApi.list({ findId: id }).subscribe((page) => {
      this._photos.update((all) => ({ ...all, [id]: page.items }));
    });
  }

  review(id: string, decision: Decision): void {
    this.api.review(id, decision).subscribe(() => {
      this._open.update((all) => all.filter((one) => one.id !== id));
    });
  }

  acceptAll(): Observable<null> {
    return this.api.acceptAll().pipe(
      tap(() => {
        this._open.set([]);
      }),
    );
  }
}
