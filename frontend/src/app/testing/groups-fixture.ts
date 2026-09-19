import { of, throwError, type Observable } from 'rxjs';
import { GroupsApi } from '../core/api/groups.api';
import type { FriendGroup } from '../core/api/models';
import type { ProblemDetail } from '../core/api/problem';

export const OWNER_ID = 'konto-eins';
export const MEMBER_ID = 'konto-zwei';

export const KARLSRUHE: FriendGroup = {
  id: 'gruppe-eins',
  name: 'Pilzgruppe Karlsruhe',
  ownerId: OWNER_ID,
  inviteCode: 'PILZ-7F3K',
  createdAt: '2026-09-03T08:00:00Z',
  members: [
    { userId: OWNER_ID, name: 'Frederik', joinedAt: '2026-09-03T08:00:00Z' },
    { userId: MEMBER_ID, name: 'Jonas', joinedAt: '2026-09-05T08:00:00Z' },
  ],
};

export const FAMILY: FriendGroup = {
  id: 'gruppe-zwei',
  name: 'Familie',
  ownerId: OWNER_ID,
  inviteCode: 'PILZ-2QX8',
  createdAt: '2026-09-04T08:00:00Z',
  members: [{ userId: OWNER_ID, name: 'Frederik', joinedAt: '2026-09-04T08:00:00Z' }],
};

export const GROUPS: FriendGroup[] = [KARLSRUHE, FAMILY];

/** Ein Doppelgänger der Gruppen-API. Der Test liest nach, was gefragt wurde. */
export class GroupsApiDouble {
  groupList: FriendGroup[] = GROUPS;
  /** Steht hier ein Problem, weist der nächste Schreibzugriff es zurück. */
  rejectWith: ProblemDetail | null = null;

  readonly calls: boolean[] = [];
  readonly created: string[] = [];
  readonly joined: string[] = [];
  readonly renamed: { id: string; name: string }[] = [];
  readonly removed: string[] = [];
  readonly dropped: { id: string; userId: string }[] = [];

  list(all = false): Observable<FriendGroup[]> {
    this.calls.push(all);
    return of(this.groupList);
  }

  create(name: string): Observable<FriendGroup> {
    this.created.push(name);
    return this.answer({ ...FAMILY, id: 'gruppe-neu', name });
  }

  join(inviteCode: string): Observable<FriendGroup> {
    this.joined.push(inviteCode);
    return this.answer(KARLSRUHE);
  }

  rename(id: string, name: string): Observable<FriendGroup> {
    this.renamed.push({ id, name });
    return this.answer({ ...KARLSRUHE, id, name });
  }

  remove(id: string): Observable<null> {
    this.removed.push(id);
    return this.answer(null);
  }

  removeMember(id: string, userId: string): Observable<null> {
    this.dropped.push({ id, userId });
    return this.answer(null);
  }

  private answer<T>(value: T): Observable<T> {
    const failure = this.rejectWith;
    this.rejectWith = null;
    return failure === null ? of(value) : throwError(() => failure);
  }
}

/** Hängt den Doppelgänger an die Stelle der echten API. */
export function groupsApiProvider(double: GroupsApiDouble): {
  provide: typeof GroupsApi;
  useValue: unknown;
} {
  return { provide: GroupsApi, useValue: double };
}
