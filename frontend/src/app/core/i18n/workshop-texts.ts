import { InjectionToken } from '@angular/core';
import table from './workshop-texts.json';
import type { Locale } from './translations';

export type WorkshopKey = keyof (typeof table)['de'];

/** Die Texte der Werkstattseite. Der Katalog der App trägt sie nicht. */
export const WORKSHOP_TEXTS = new InjectionToken<Record<Locale, Record<string, string>>>('WORKSHOP_TEXTS', {
  providedIn: 'root',
  factory: () => table,
});
