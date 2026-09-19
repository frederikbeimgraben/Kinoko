import { Injectable, inject } from '@angular/core';
import { map, type Observable } from 'rxjs';
import { ApiClient, type Silent } from './api-client';
import type {
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
 * Die Endpunkte der Rechteverwaltung. Bis auf die eigenen Rechte verlangt jeder
 * ein Recht; ohne antwortet der Dienst mit 403.
 */
@Injectable({ providedIn: 'root' })
export class AccessApi {
  private readonly api = inject(ApiClient);

  /** Das eigene Konto. Braucht nur eine Anmeldung. */
  me(options?: Silent): Observable<Me> {
    return this.api.get<Me>('/me', undefined, options);
  }

  /** Die eigenen Rechte. Braucht nur eine Anmeldung. */
  mine(): Observable<MyPermissions> {
    return this.api.get<MyPermissions>('/me/permissions');
  }

  /** Die Zähler der Übersicht. Ein Punkt ohne Recht kommt ohne Zahl. */
  summary(): Observable<AdminSummary> {
    return this.api.get<AdminSummary>('/admin/summary');
  }

  /** Die Zahlen jeder Art. Braucht das Recht `species.edit`. */
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

  /** Die Namen zu Kennungen, mit denen das eigene Konto eine Gruppe teilt. */
  personNames(ids: readonly string[]): Observable<PersonName[]> {
    return this.api.get<PersonName[]>('/people/names', { ids: ids.join(',') });
  }

  /** Setzt die Rollen einer Person neu. Die Liste ersetzt, sie ergänzt nicht. */
  setRoles(id: string, roleIds: string[]): Observable<Person> {
    return this.api.put<Person>(`/people/${encodeURIComponent(id)}/roles`, { roleIds });
  }

  deletePerson(id: string): Observable<null> {
    return this.api.delete<null>(`/people/${encodeURIComponent(id)}`);
  }
}
