import { Injectable, inject } from '@angular/core';
import { map, type Observable } from 'rxjs';
import { ApiClient, type Silent } from './api-client';
import type { FriendGroup, Items } from './models';

/** The friend group endpoints. Each one needs a sign-in. */
@Injectable({ providedIn: 'root' })
export class GroupsApi {
  private readonly api = inject(ApiClient);

  /** The own groups. `all` needs the `group.manage` permission. */
  list(all = false, options?: Silent): Observable<FriendGroup[]> {
    return this.api
      .get<Items<FriendGroup>>('/groups', { all: all || undefined }, options)
      .pipe(map((page) => page.items));
  }

  create(name: string): Observable<FriendGroup> {
    return this.api.post<FriendGroup>('/groups', { name });
  }

  join(inviteCode: string): Observable<FriendGroup> {
    return this.api.post<FriendGroup>('/groups/join', { inviteCode });
  }

  rename(id: string, name: string): Observable<FriendGroup> {
    return this.api.put<FriendGroup>(`/groups/${encodeURIComponent(id)}`, { name });
  }

  remove(id: string): Observable<null> {
    return this.api.delete<null>(`/groups/${encodeURIComponent(id)}`);
  }

  removeMember(id: string, userId: string): Observable<null> {
    const path = `/groups/${encodeURIComponent(id)}/members/${encodeURIComponent(userId)}`;
    return this.api.delete<null>(path);
  }
}
