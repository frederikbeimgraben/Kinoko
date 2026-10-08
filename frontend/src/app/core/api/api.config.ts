import { InjectionToken } from '@angular/core';

/**
 * Root of the own API. Locally, `proxy.conf.json` sends it to the dev server.
 * In production, it is on the same origin.
 */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', {
  providedIn: 'root',
  factory: () => '/api',
});
