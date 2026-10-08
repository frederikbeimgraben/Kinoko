import { Injectable, inject } from '@angular/core';
import { map, type Observable } from 'rxjs';
import { ApiClient, type Silent } from './api-client';
import type {
  AccountExport,
  AdminSummary,
  Items,
  Me,
  MyPermissions,
  PermissionEntry,
  Person,
  PersonName,
  Role,
  RoleInput,
  RolePatch,
  SpeciesCountsEntry,
} from './models';

/**
 * The permission endpoints. All except the own permissions need a permission, else the service gives 403.
 */
@Injectable({ providedIn: 'root' })
export class AccessApi {
  private readonly api = inject(ApiClient);

  /** The own account. Needs only a sign-in. */
  me(options?: Silent): Observable<Me> {
    return this.api.get<Me>('/me', undefined, options);
  }

  /** The own permissions. Needs only a sign-in. */
  mine(): Observable<MyPermissions> {
    return this.api.get<MyPermissions>('/me/permissions');
  }

  /** The own account with all own finds, objects and photos. */
  exportData(): Observable<AccountExport> {
    return this.api.get<AccountExport>('/me/export');
  }

  /** Deletes all own data. The account itself stays. */
  deleteData(): Observable<null> {
    return this.api.delete<null>('/me/data');
  }

  /** The counters of the overview. An item without permission has no number. */
  summary(): Observable<AdminSummary> {
    return this.api.get<AdminSummary>('/admin/summary');
  }

  /** The numbers of each species. Needs the permission `species.edit`. */
  speciesCounts(): Observable<SpeciesCountsEntry[]> {
    return this.api.get<Items<SpeciesCountsEntry>>('/admin/species-counts').pipe(map((page) => page.items));
  }

  catalogue(): Observable<PermissionEntry[]> {
    return this.api.get<Items<PermissionEntry>>('/permissions').pipe(map((page) => page.items));
  }

  roles(): Observable<Role[]> {
    return this.api.get<Items<Role>>('/roles').pipe(map((page) => page.items));
  }

  createRole(role: RoleInput): Observable<Role> {
    return this.api.post<Role>('/roles', role);
  }

  patchRole(id: string, patch: RolePatch): Observable<Role> {
    return this.api.patch<Role>(`/roles/${encodeURIComponent(id)}`, patch);
  }

  deleteRole(id: string): Observable<null> {
    return this.api.delete<null>(`/roles/${encodeURIComponent(id)}`);
  }

  people(search: string): Observable<Person[]> {
    return this.api.get<Items<Person>>('/people', { q: search || undefined }).pipe(map((page) => page.items));
  }

  /** The names for IDs that share a group with the current user. A background call: it shows no toast. */
  personNames(ids: readonly string[]): Observable<PersonName[]> {
    return this.api.get<PersonName[]>('/people/names', { ids: ids.join(',') }, { quiet: true });
  }

  /** Sets the roles of a person. The list replaces the roles; it does not add to them. */
  setRoles(id: string, roleIds: string[]): Observable<Person> {
    return this.api.put<Person>(`/people/${encodeURIComponent(id)}/roles`, { roleIds });
  }

  deletePerson(id: string): Observable<null> {
    return this.api.delete<null>(`/people/${encodeURIComponent(id)}`);
  }
}
