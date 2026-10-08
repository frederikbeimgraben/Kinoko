import { InjectionToken } from '@angular/core';

// The current time as a dependency. The map opens on the current ISO week.
// A test can give a fixed date here and keep the global clock unchanged.
export const NOW = new InjectionToken<() => Date>('Now', {
  providedIn: 'root',
  factory: () => () => new Date(),
});
