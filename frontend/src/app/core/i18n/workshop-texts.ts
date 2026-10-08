import { InjectionToken } from '@angular/core';
import table from './workshop-texts.json';
import type { Locale } from './translations';

export type WorkshopKey = keyof (typeof table)['de'];

/** The texts of the workshop page. The app catalogue does not contain them. */
export const WORKSHOP_TEXTS = new InjectionToken<Record<Locale, Record<string, string>>>('WORKSHOP_TEXTS', {
  providedIn: 'root',
  factory: () => table,
});
