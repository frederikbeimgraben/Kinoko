import { Injectable, inject } from '@angular/core';
import { map, type Observable } from 'rxjs';
import { ApiClient } from './api-client';
import type { FriendGroup, Items } from './models';

/** Die Endpunkte der Freundesgruppen. Jeder verlangt eine Anmeldung. */
@Injectable({ providedIn: 'root' })
export class GroupsApi {
  private readonly api = inject(ApiClient);

  /** Die eigenen Gruppen. `all` verlangt das Recht `group.manage`. */
  list(all = false): Observable<FriendGroup[]> {
    return this.api
      .get<Items<FriendGroup>>('/groups', { all: all || undefined })
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
