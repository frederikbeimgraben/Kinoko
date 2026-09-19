import { Injectable, computed, inject, signal } from '@angular/core';
import { tap, type Observable } from 'rxjs';
import { GroupsApi } from '../api/groups.api';
import type { FriendGroup } from '../api/models';

/** Die Gruppen im Speicher. Konto und Verwaltung lesen dieselbe Liste. */
@Injectable({ providedIn: 'root' })
export class GroupsState {
  private readonly api = inject(GroupsApi);

  private readonly _groups = signal<readonly FriendGroup[] | null>(null);
  private readonly _search = signal('');

  /** `null`, solange die erste Antwort aussteht. */
  readonly groups = this._groups.asReadonly();
  readonly search = this._search.asReadonly();

  readonly found = computed(() => {
    const needle = this._search().trim().toLocaleLowerCase();
    const all = this._groups() ?? [];
    return needle === '' ? all : all.filter((one) => one.name.toLocaleLowerCase().includes(needle));
  });

  load(all = false): void {
    this.api.list(all).subscribe((groups) => {
      this._groups.set(groups);
    });
  }

  setSearch(value: string): void {
    this._search.set(value);
  }

  one(id: string): FriendGroup | null {
    return this._groups()?.find((group) => group.id === id) ?? null;
  }

  create(name: string): Observable<FriendGroup> {
    return this.api.create(name).pipe(
      tap((group) => {
        this.put(group);
      }),
    );
  }

  join(inviteCode: string): Observable<FriendGroup> {
    return this.api.join(inviteCode).pipe(
      tap((group) => {
        this.put(group);
      }),
    );
  }

  rename(id: string, name: string): Observable<FriendGroup> {
    return this.api.rename(id, name).pipe(
      tap((group) => {
        this.put(group);
      }),
    );
  }

  remove(id: string): Observable<null> {
    return this.api.remove(id).pipe(
      tap(() => {
        this.drop(id);
      }),
    );
  }

  removeMember(id: string, userId: string): Observable<null> {
    return this.api.removeMember(id, userId).pipe(
      tap(() => {
        const group = this.one(id);
        if (group === null) return;
        const members = group.members.filter((one) => one.userId !== userId);
        this.put({ ...group, members });
      }),
    );
  }

  /** Nimmt eine Gruppe auf, oder ersetzt sie. Die Liste bleibt nach Name sortiert. */
  private put(group: FriendGroup): void {
    this._groups.update((all) => {
      const rest = (all ?? []).filter((one) => one.id !== group.id);
      return [...rest, group].sort((a, b) => a.name.localeCompare(b.name));
    });
  }

  private drop(id: string): void {
    this._groups.update((all) => all?.filter((one) => one.id !== id) ?? null);
  }
}
