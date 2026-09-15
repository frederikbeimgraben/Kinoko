import { Injectable, computed, inject, signal, type WritableSignal } from '@angular/core';
import { firstValueFrom, type Observable } from 'rxjs';
import { EntriesApi } from '../../core/api/entries.api';
import { FindsApi } from '../../core/api/finds.api';
import { PhotosApi } from '../../core/api/photos.api';
import type {
  Find,
  FindWrite,
  SharedFind,
  Marker,
  MarkerWrite,
  Zone,
  ZoneWrite,
} from '../../core/api/models';
import { AuthService } from '../../core/auth';
import type { Viewbox } from '../../map/tile-grid';
import { SyncService } from '../../core/offline/sync.service';
import type { SyncKind, SyncOperation, SyncTask } from '../../core/offline/sync.types';
import { EntriesCache } from './entries.cache';
import { attachPhotos } from './photos';
import { findWrite, markerWrite, zoneWrite } from './writes';

/** Was aus einem Speicherversuch geworden ist. */
export type SaveResult = 'gespeichert' | 'wartet' | 'verworfen';

/** Der Körper, den ein Objekt auf dem Draht trägt. */
export type EntryBody = FindWrite | MarkerWrite | ZoneWrite;

/**
 * Die eigenen Einträge im Speicher.
 *
 * Der Zustand hängt an keiner Seite: Karte, Liste und Objekt-Blätter lesen
 * dieselben Signale, damit ein neuer Fund überall zugleich steht. Wer speichern
 * will, wird vorher nach der Anmeldung gefragt; wer sie ablehnt oder kein Netz
 * hat, dessen Eintrag geht in die Warteschlange und trägt in der Liste das
 * Kennzeichen „Übertragung ausstehend“.
 */
@Injectable({ providedIn: 'root' })
export class EntriesState {
  private readonly api = inject(EntriesApi);
  private readonly findsApi = inject(FindsApi);
  private readonly photosApi = inject(PhotosApi);
  private readonly auth = inject(AuthService);
  private readonly sync = inject(SyncService);
  private readonly cache = inject(EntriesCache);

  private readonly _finds = signal<readonly Find[]>([]);
  private readonly _markers = signal<readonly Marker[]>([]);
  private readonly _zones = signal<readonly Zone[]>([]);
  private readonly _shared = signal<readonly SharedFind[]>([]);
  private readonly _loading = signal(false);

  readonly finds = this._finds.asReadonly();
  readonly markers = this._markers.asReadonly();
  readonly zones = this._zones.asReadonly();
  /** Geteilte Funde im zuletzt gefragten Ausschnitt, auch fremde. */
  readonly shared = this._shared.asReadonly();
  readonly loading = this._loading.asReadonly();
  /** Nur neue Objekte stehen als eigene Zeile. */
  readonly pendingEntries = computed(
    () => this.sync.tasks().filter((task) => task.operation === 'create') as readonly SyncTask<EntryBody>[],
  );
  /** Die Kennungen der Objekte mit ausstehender Änderung. */
  readonly pendingTargets = this.sync.pendingTargets;

  readonly signedIn = this.auth.signedIn;
  /** Der Name am eigenen Fund kommt aus dem Konto, nie aus einem Feld. */
  readonly reporter = computed(() => this.auth.user()?.name ?? null);

  /** Holt alles Eigene. Ohne Konto gibt es nichts zu holen. */
  async load(): Promise<void> {
    await this.sync.read();
    if (!this.auth.signedIn()) {
      this._finds.set([]);
      this._markers.set([]);
      this._zones.set([]);
      return;
    }
    await this.restore();
    this._loading.set(true);
    try {
      const [finds, markers, zones] = await Promise.all([
        firstValueFrom(this.api.finds()),
        firstValueFrom(this.api.markers()),
        firstValueFrom(this.api.zones()),
      ]);
      this._finds.set(finds);
      this._markers.set(markers);
      this._zones.set(zones);
      await this.keep();
    } catch {
      // Ein Ausfall lässt stehen, was schon da ist.
    } finally {
      this._loading.set(false);
    }
  }

  /** Der letzte Stand vom Gerät, bevor der Server antwortet. */
  private async restore(): Promise<void> {
    const known = await this.cache.read();
    if (known === null) return;
    this._finds.set(known.finds);
    this._markers.set(known.markers);
    this._zones.set(known.zones);
  }

  private keep(): Promise<void> {
    return this.cache.write({ finds: this._finds(), markers: this._markers(), zones: this._zones() });
  }

  /** Geteilte Funde im Ausschnitt. Diese Route liest auch ohne Konto. */
  async loadShared(view?: Viewbox): Promise<void> {
    try {
      this._shared.set(await firstValueFrom(this.findsApi.shared(view)));
    } catch {
      // Ohne Netz bleibt die Karte bei dem, was zuletzt kam.
    }
  }

  async saveFind(body: FindWrite, photos: readonly File[] = []): Promise<SaveResult> {
    if (!(await this.auth.requestSignIn())) return this.enqueue('find', body, photos);
    try {
      const find = await firstValueFrom(this.api.createFind(body));
      if (find === null) return 'gespeichert';
      await attachPhotos(this.photosApi, find.id, this.reporter() ?? '', photos);
      this._finds.update((all) => [find, ...all]);
      return 'gespeichert';
    } catch {
      return this.enqueue('find', body, photos);
    }
  }

  async saveMarker(body: MarkerWrite): Promise<SaveResult> {
    return this.save('marker', this._markers, body, () => this.api.createMarker(body));
  }

  async saveZone(body: ZoneWrite): Promise<SaveResult> {
    return this.save('zone', this._zones, body, () => this.api.createZone(body));
  }

  private async save<T>(
    kind: SyncKind,
    list: WritableSignal<readonly T[]>,
    body: EntryBody,
    send: () => Observable<T | null>,
  ): Promise<SaveResult> {
    if (!(await this.auth.requestSignIn())) return this.enqueue(kind, body);
    try {
      const fresh = await firstValueFrom(send());
      if (fresh !== null) list.update((all) => [fresh, ...all]);
      return 'gespeichert';
    } catch {
      return this.enqueue(kind, body);
    }
  }

  /** Ohne Platz im Gerät ist der Eintrag verworfen, statt still zu gelingen. */
  private async enqueue(kind: SyncKind, body: EntryBody, photos: readonly File[] = []): Promise<SaveResult> {
    return (await this.sync.enqueue(kind, 'create', body, photos)) === null ? 'verworfen' : 'wartet';
  }

  /** Ändert einen Fund. `PUT` ersetzt, darum geht der ganze Körper hinaus. */
  async updateFind(find: Find, change: Partial<FindWrite>): Promise<boolean> {
    return this.change('find', this._finds, find, { ...findWrite(find), ...change }, (body) =>
      this.api.putFind(find.id, body),
    );
  }

  async updateMarker(marker: Marker, change: Partial<MarkerWrite>): Promise<boolean> {
    return this.change('marker', this._markers, marker, { ...markerWrite(marker), ...change }, (body) =>
      this.api.putMarker(marker.id, body),
    );
  }

  async updateZone(zone: Zone, change: Partial<ZoneWrite>): Promise<boolean> {
    return this.change('zone', this._zones, zone, { ...zoneWrite(zone), ...change }, (body) =>
      this.api.putZone(zone.id, body),
    );
  }

  async deleteFind(id: string): Promise<boolean> {
    return this.drop('find', this._finds, id, () => this.api.deleteFind(id));
  }

  async deleteMarker(id: string): Promise<boolean> {
    return this.drop('marker', this._markers, id, () => this.api.deleteMarker(id));
  }

  async deleteZone(id: string): Promise<boolean> {
    return this.drop('zone', this._zones, id, () => this.api.deleteZone(id));
  }

  /** Ändert lokal zuerst. Ohne Netz geht die Änderung in die Warteschlange. */
  private async change<T extends { id: string }, B extends EntryBody>(
    kind: SyncKind,
    list: WritableSignal<readonly T[]>,
    held: T,
    body: B,
    send: (body: B) => Observable<T | null>,
  ): Promise<boolean> {
    const { id } = held;
    try {
      const fresh = await firstValueFrom(send(body));
      if (fresh !== null) list.update((all) => all.map((one) => (one.id === id ? fresh : one)));
      return true;
    } catch {
      list.update((all) => all.map((one) => (one.id === id ? { ...one, ...body } : one)));
      return this.queueChange(kind, 'update', id, body);
    }
  }

  private async drop<T extends { id: string }>(
    kind: SyncKind,
    list: WritableSignal<readonly T[]>,
    id: string,
    send: () => Observable<unknown>,
  ): Promise<boolean> {
    try {
      await firstValueFrom(send());
      list.update((all) => all.filter((one) => one.id !== id));
      return true;
    } catch {
      list.update((all) => all.filter((one) => one.id !== id));
      return this.queueChange(kind, 'delete', id, null);
    }
  }

  /** Sendet, was wartet, und holt danach die eigenen Einträge neu. */
  async sendPending(): Promise<number> {
    if (!this.auth.signedIn()) return 0;
    const sent = await this.sync.flush();
    if (sent > 0) await this.load();
    return sent;
  }

  /** Ohne Netz geht die Änderung in die Warteschlange, statt verloren zu gehen. */
  private async queueChange(
    kind: SyncKind,
    operation: SyncOperation,
    id: string,
    body: EntryBody | null,
  ): Promise<boolean> {
    return (await this.sync.enqueue(kind, operation, body, [], id)) !== null;
  }
}
