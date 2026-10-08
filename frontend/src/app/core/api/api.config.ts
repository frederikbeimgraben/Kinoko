import { InjectionToken } from '@angular/core';

// The base path of the app API. Locally, `proxy.conf.json` sends it to the dev server.
// In production, the API is on the same origin.
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', {
  providedIn: 'root',
  factory: () => '/api',
});
