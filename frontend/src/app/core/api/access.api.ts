import { Injectable, inject } from '@angular/core';
import { map, type Observable } from 'rxjs';
import { ApiClient, type Silent } from './api-client';
import type {
  AdminSummary,
  Items,
  Me,
  MyPermissions,
  Page,
  PermissionEntry,
  Person,
  Role,
  RoleInput,
  RolePatch,
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

  people(search: string): Observable<Page<Person>> {
    return this.api.get<Page<Person>>('/people', { q: search || undefined });
  }

  /** Setzt die Rollen einer Person neu. Die Liste ersetzt, sie ergänzt nicht. */
  setRoles(sub: string, roles: string[]): Observable<Person> {
    return this.api.put<Person>(`/people/${encodeURIComponent(sub)}/roles`, { roles });
  }
}
