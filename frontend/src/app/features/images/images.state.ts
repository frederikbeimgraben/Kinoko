import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom, lastValueFrom, tap, type Observable } from 'rxjs';
import { PhotosApi, type PhotoInput, type PhotoQuery } from '../../core/api/photos.api';
import type { Photo } from '../../core/api/models';
import { withoutMetadata } from '../../core/images/prepare-photo';
import { SyncService } from '../../core/offline/sync.service';

/** Die Fotos einer Sicht: laden, einreichen, prüfen, Titelbild setzen. */
@Injectable({ providedIn: 'root' })
export class ImagesState {
  private readonly api = inject(PhotosApi);
  private readonly sync = inject(SyncService);

  private readonly _photos = signal<readonly Photo[]>([]);
  private readonly _cursor = signal<string | null>(null);
  private readonly _loading = signal(false);
  private readonly _failed = signal(false);
  private readonly _percent = signal<number | null>(null);
  private readonly _queued = signal(false);

  readonly photos = this._photos.asReadonly();
  readonly cursor = this._cursor.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly failed = this._failed.asReadonly();
  /** Der Anteil des laufenden Hochladens. `null` heißt: keines läuft. */
  readonly percent = this._percent.asReadonly();
  /** Wahr, solange eine Einreichung ohne Netz auf dem Gerät wartet. */
  readonly queued = this._queued.asReadonly();

  readonly lead = computed<Photo | null>(() => {
    const all = this._photos();
    return all.find((one) => one.lead) ?? all[0] ?? null;
  });

  /** Holt eine Sicht neu. Eine zweite Abfrage ersetzt die erste. */
  load(query: PhotoQuery): void {
    this._loading.set(true);
    this._failed.set(false);
    this.api.list(query).subscribe({
      next: (page) => {
        this._photos.set(page.items);
        this._cursor.set(page.nextCursor);
        this._loading.set(false);
      },
      error: () => {
        this._loading.set(false);
        this._failed.set(true);
      },
    });
  }

  photoOf(id: string): Photo | null {
    return this._photos().find((one) => one.id === id) ?? null;
  }

  /** Die Stelle im Stapel, ab eins gezählt. Null heißt: nicht in der Sicht. */
  positionOf(id: string): number {
    return this._photos().findIndex((one) => one.id === id) + 1;
  }

  /**
   * Bereitet das Foto auf, sendet es und meldet den Anteil. Ohne Netz geht es
   * in die Warteschlange und später hinaus.
   */
  async submit(input: PhotoInput, file: File): Promise<Photo | null> {
    const prepared = await withoutMetadata(file);
    if (!this.sync.online()) {
      await this.sync.enqueue('photo', 'create', { ...input }, [prepared]);
      this._queued.set(true);
      return null;
    }
    this._percent.set(0);
    try {
      const done = await lastValueFrom(
        this.api.create(input, prepared).pipe(tap((step) => this._percent.set(step.percent))),
      );
      return done.body;
    } catch {
      return null;
    } finally {
      this._percent.set(null);
    }
  }

  async approve(id: string): Promise<void> {
    await this.settle(id, this.api.approve(id));
  }

  async reject(id: string, reason: string): Promise<void> {
    await this.settle(id, this.api.reject(id, reason));
  }

  async remove(id: string): Promise<void> {
    await this.settle(id, this.api.remove(id));
  }

  /** Ein neues Titelbild löst das alte ab: nur eines führt je Art. */
  async setLead(id: string): Promise<void> {
    try {
      await firstValueFrom(this.api.setLead(id));
    } catch {
      return;
    }
    this._photos.update((all) => all.map((one) => ({ ...one, lead: one.id === id })));
  }

  /** Ein entschiedenes Bild gehört nicht mehr in die Sicht, die es zeigte. */
  private async settle(id: string, call: Observable<unknown>): Promise<void> {
    try {
      await firstValueFrom(call);
    } catch {
      return;
    }
    this._photos.update((all) => all.filter((one) => one.id !== id));
  }
}
