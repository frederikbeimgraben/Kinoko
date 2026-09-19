import { Injectable, inject } from '@angular/core';
import { tap, type Observable } from 'rxjs';
import { GroupsApi } from '../api/groups.api';
import type { FriendGroup } from '../api/models';
import { SearchableListState } from './searchable-list.state';

/** The groups in memory. The account and the administration read the same list. */
@Injectable({ providedIn: 'root' })
export class GroupsState extends SearchableListState<FriendGroup> {
  private readonly api = inject(GroupsApi);

  readonly groups = this.items;

  /** A quiet call does not report an error as a toast. */
  load(all = false, quiet = false): void {
    this.api.list(all, { quiet }).subscribe({
      next: (groups) => {
        this.setItems(groups);
      },
      error: () => {
        this.setItems([]);
      },
    });
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

  protected matches(item: FriendGroup, needle: string): boolean {
    return item.name.toLocaleLowerCase().includes(needle);
  }

  protected sortKey(item: FriendGroup): string {
    return item.name;
  }
}
