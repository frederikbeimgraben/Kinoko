import type { Routes } from '@angular/router';

/** Accepts each URL, so navigation in a test does not fail. Tests check the target, not its content. */
export const ANY_ROUTE: Routes = [{ path: '**', children: [] }];
