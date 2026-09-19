import { Injectable, inject, signal } from '@angular/core';
import { AccessApi } from '../api/access.api';
import type { PersonName } from '../api/models';

/** So viele Kennungen erlaubt der Vertrag je Anfrage. */
const MAX_IDS = 50;

/** Der Name einer Person, für Melder mit gemeinsamer Gruppe: sammelt, cached, löst über ein Signal auf. */
@Injectable({ providedIn: 'root' })
export class PersonNamesService {
  private readonly api = inject(AccessApi);

  private readonly cache = signal<ReadonlyMap<string, string | null>>(new Map());
  private readonly pending = new Set<string>();
  private readonly asked = new Set<string>();
  private flushScheduled = false;

  /** Der Name zu einer Kennung, `null` ohne Auflösung oder noch nicht geladen. */
  nameOf(id: string | null): string | null {
    if (id === null) return null;
    const held = this.cache().get(id);
    if (held !== undefined) return held;
    this.queue(id);
    return null;
  }

  private queue(id: string): void {
    if (this.asked.has(id)) return;
    this.asked.add(id);
    this.pending.add(id);
    if (this.flushScheduled) return;
    this.flushScheduled = true;
    queueMicrotask(() => {
      this.flush();
    });
  }

  private flush(): void {
    this.flushScheduled = false;
    const ids = [...this.pending];
    this.pending.clear();
    for (let start = 0; start < ids.length; start += MAX_IDS) {
      this.resolve(ids.slice(start, start + MAX_IDS));
    }
  }

  private resolve(ids: readonly string[]): void {
    this.api.personNames(ids).subscribe({
      next: (found) => {
        this.store(ids, found);
      },
      error: () => {
        this.store(ids, []);
      },
    });
  }

  private store(requested: readonly string[], found: readonly PersonName[]): void {
    const byId = new Map(found.map((person) => [person.id, person.name] as const));
    this.cache.update((current) => {
      const next = new Map(current);
      for (const id of requested) next.set(id, byId.get(id) ?? null);
      return next;
    });
  }
}
