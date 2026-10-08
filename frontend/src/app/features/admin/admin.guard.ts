import { inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { Router, type CanActivateFn, type UrlTree } from '@angular/router';
import { filter, map, take, type Observable } from 'rxjs';
import { PermissionsStore } from '../../core/access/permissions.store';
import type { Permission } from '../../core/api/models';
import { ADMIN_PERMISSIONS } from './admin.entries';

// Opens an admin route only with the matching permission, else goes to the account page. `null` accepts any admin permission.
// This guard only hides routes. Each server route checks its permission and gives 403 for a typed URL.
export function requiresPermission(permission: Permission | null): CanActivateFn {
  return (): Observable<boolean | UrlTree> => {
    const rights = inject(PermissionsStore);
    const router = inject(Router);
    // At startup, the silent sign-in still runs. Without this wait, a deep link
    // into the admin area always goes back to the account page.
    return toObservable(rights.settled).pipe(
      filter(Boolean),
      take(1),
      map(() => allowed(rights, permission) || router.parseUrl('/konto')),
    );
  };
}

function allowed(rights: PermissionsStore, permission: Permission | null): boolean {
  return permission === null ? rights.canAny(ADMIN_PERMISSIONS) : rights.can(permission);
}
