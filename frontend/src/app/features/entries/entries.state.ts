import { Injectable, computed, inject, signal, type WritableSignal } from '@angular/core';
import { firstValueFrom, type Observable } from 'rxjs';
import { EntriesApi } from '../../core/api/entries.api';
import { FindsApi } from '../../core/api/finds.api';
import type {
  Find,
  FindPatch,
  FindInput,
  SharedFind,
  Marker,
  MarkerPatch,
  MarkerInput,
  Zone,
  ZonePatch,
  ZoneInput,
} from '../../core/api/models';
import { AuthService } from '../../core/auth';
import type { Viewbox } from '../../map/tile-grid';
import { SyncService } from '../../core/offline/sync.service';
import type { SyncKind, SyncOperation, SyncTask } from '../../core/offline/sync.types';
import { EntriesCache } from './entries.cache';
import { attachPhotos } from './photos';

/** Was aus einem Speicherversuch geworden ist. */
export type SaveResult = 'gespeichert' | 'wartet' | 'verworfen';

/** Die Eingabe eines neuen Objekts. */
export type EntryInput = FindInput | MarkerInput | ZoneInput;

/** Was ein wartender Auftrag an Eingabe trägt. */
export type EntryBody = EntryInput | FindPatch | MarkerPatch | ZonePatch;

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
  private readonly auth = inject(AuthService);
  private readonly sync = inject(SyncService);
  private readonly cache = inject(EntriesCache);

  private readonly _finds = signal<readonly Find[]>([]);
  private readonly _marker = signal<readonly Marker[]>([]);
  private readonly _zones = signal<readonly Zone[]>([]);
  private readonly _shared = signal<readonly SharedFind[]>([]);
  private readonly _loading = signal(false);

  readonly finds = this._finds.asReadonly();
  readonly marker = this._marker.asReadonly();
  readonly zones = this._zones.asReadonly();
  /** Geteilte Funde im zuletzt gefragten Ausschnitt, auch fremde. */
  readonly shared = this._shared.asReadonly();
  readonly loading = this._loading.asReadonly();
  /** Nur neue Objekte stehen als eigene Zeile. */
  readonly pendingEntries = computed(
    () => this.sync.tasks().filter((task) => task.operation === 'create') as readonly SyncTask<EntryInput>[],
  );
  /** Die Kennungen der Objekte mit ausstehender Änderung. */
  readonly pendingTargets = this.sync.pendingTargets;

  readonly signedIn = this.auth.signedIn;
  /** Der Name am eigenen Fund kommt aus dem Konto, nie aus einem Feld. */
  readonly melder = computed(() => this.auth.user()?.name ?? null);

  /** Holt alles Eigene. Ohne Konto gibt es nichts zu holen. */
  async load(): Promise<void> {
    await this.sync.read();
    if (!this.auth.signedIn()) {
      this._finds.set([]);
      this._marker.set([]);
      this._zones.set([]);
      return;
    }
    await this.restore();
    this._loading.set(true);
    try {
      const [finds, marker, zones] = await Promise.all([
        firstValueFrom(this.api.finds()),
        firstValueFrom(this.api.marker()),
        firstValueFrom(this.api.zones()),
      ]);
      this._finds.set(finds.eintraege);
      this._marker.set(marker.eintraege);
      this._zones.set(zones.eintraege);
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
    this._marker.set(known.marker);
    this._zones.set(known.zones);
  }

  private keep(): Promise<void> {
    return this.cache.write({ finds: this._finds(), marker: this._marker(), zones: this._zones() });
  }

  /** Geteilte Funde im Ausschnitt. Diese Route liest auch ohne Konto. */
  async loadShared(view?: Viewbox): Promise<void> {
    try {
      this._shared.set(await firstValueFrom(this.findsApi.shared(view)));
    } catch {
      // Ohne Netz bleibt die Karte bei dem, was zuletzt kam.
    }
  }

  async saveFind(input: FindInput, fotos: readonly File[] = []): Promise<SaveResult> {
    if (!(await this.auth.requestSignIn())) return this.enqueue('find', input, fotos);
    try {
      const find = await firstValueFrom(this.api.createFind(input));
      const done = await attachPhotos(this.api, find, fotos);
      this._finds.update((all) => [done, ...all]);
      return 'gespeichert';
    } catch {
      return this.enqueue('find', input, fotos);
    }
  }

  async saveMarker(input: MarkerInput): Promise<SaveResult> {
    return this.save('marker', this._marker, input, () => this.api.createMarker(input));
  }

  async saveZone(input: ZoneInput): Promise<SaveResult> {
    return this.save('zone', this._zones, input, () => this.api.createZone(input));
  }

  private async save<T>(
    kind: SyncKind,
    list: WritableSignal<readonly T[]>,
    input: EntryBody,
    send: () => Observable<T>,
  ): Promise<SaveResult> {
    if (!(await this.auth.requestSignIn())) return this.enqueue(kind, input);
    try {
      const fresh = await firstValueFrom(send());
      list.update((all) => [fresh, ...all]);
      return 'gespeichert';
    } catch {
      return this.enqueue(kind, input);
    }
  }

  /** Ohne Platz im Gerät ist der Eintrag verworfen, statt still zu gelingen. */
  private async enqueue(kind: SyncKind, body: EntryBody, fotos: readonly File[] = []): Promise<SaveResult> {
    return (await this.sync.enqueue(kind, 'create', body, fotos)) === null ? 'verworfen' : 'wartet';
  }

  async updateFind(id: string, patch: FindPatch): Promise<boolean> {
    return this.change('find', this._finds, id, patch, () => this.api.patchFind(id, patch));
  }

  async updateMarker(id: string, patch: MarkerPatch): Promise<boolean> {
    return this.change('marker', this._marker, id, patch, () => this.api.patchMarker(id, patch));
  }

  async updateZone(id: string, patch: ZonePatch): Promise<boolean> {
    return this.change('zone', this._zones, id, patch, () => this.api.patchZone(id, patch));
  }

  async deleteFind(id: string): Promise<boolean> {
    return this.drop('find', this._finds, id, () => this.api.deleteFind(id));
  }

  async deleteMarker(id: string): Promise<boolean> {
    return this.drop('marker', this._marker, id, () => this.api.deleteMarker(id));
  }

  async deleteZone(id: string): Promise<boolean> {
    return this.drop('zone', this._zones, id, () => this.api.deleteZone(id));
  }

  /** Ändert lokal zuerst. Ohne Netz geht die Änderung in die Warteschlange. */
  private async change<T extends { id: string }>(
    kind: SyncKind,
    list: WritableSignal<readonly T[]>,
    id: string,
    patch: EntryBody,
    send: () => Observable<T>,
  ): Promise<boolean> {
    try {
      const fresh = await firstValueFrom(send());
      list.update((all) => all.map((one) => (one.id === id ? fresh : one)));
      return true;
    } catch {
      list.update((all) => all.map((one) => (one.id === id ? { ...one, ...patch } : one)));
      return this.queueChange(kind, 'update', id, patch);
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
