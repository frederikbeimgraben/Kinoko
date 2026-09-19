import type { components } from '../contract';

/** Die Zähler der Verwaltungsübersicht. */
export type AdminSummary = components['schemas']['AdminSummary'];

/** Das eigene Konto mit allen eigenen Funden, Objekten und Fotos. */
export type AccountExport = components['schemas']['AccountExport'];

/** Die Zahlen einer Art in der Artenverwaltung. */
export type SpeciesCountsEntry = components['schemas']['SpeciesCountsEntry'];

/** Eine Antwort, die ihre Einträge unter `items` trägt. */
export interface Items<E> {
  items: E[];
}

/** Das eigene Konto, so wie `/api/me` es liefert. */
export type Me = components['schemas']['Me'];

/** Die Rechte des Vertrags. Der Server bleibt die Quelle, wer sie trägt. */
export type Permission = components['schemas']['Permission'];

export const PERMISSIONS: readonly Permission[] = [
  'species.edit',
  'image.submit',
  'image.review',
  'text.edit',
  'role.manage',
  'role.assign',
  'find.review',
  'run.manage',
  'group.manage',
];

/** Die vier Gruppen, unter denen die Rechtematrix ihre Zeilen zeigt. */
export type PermissionArea = components['schemas']['Area'];

export const PERMISSION_AREAS: readonly PermissionArea[] = ['species', 'interface', 'access', 'data'];

/** Ein Recht des Katalogs mit seiner Gruppe. */
export type PermissionEntry = components['schemas']['PermissionEntry'];

/** Die Antwort von `/api/me/permissions`. */
export type MyPermissions = components['schemas']['MyPermissions'];

/** Eine Rolle, so kurz wie sie neben einer Person steht. */
export interface RoleRef {
  id: string;
  slug: string;
  name: string;
}

export interface Role extends RoleRef {
  description: string | null;
  /** Admin und Nutzer stehen fest: nicht löschbar, nicht umbenennbar. */
  builtIn: boolean;
  permissions: Permission[];
  peopleCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface RoleInput {
  slug: string;
  name: string;
  description: string | null;
  permissions: Permission[];
}

/** Weggelassene Felder bleiben, wie sie sind. */
export interface RolePatch {
  name?: string;
  description?: string | null;
  permissions?: Permission[];
}

/** Ein Konto, das den Dienst schon einmal benutzt hat. */
export type Person = components['schemas']['Person'];

/** Der Name einer Person, auflösbar bei gemeinsamer Gruppe. */
export type PersonName = components['schemas']['PersonName'];

/** Ein Ausschnitt der Personenliste, mit der Gesamtzahl dahinter. */
export interface Page<E> {
  eintraege: E[];
  gesamt: number;
  limit: number;
  offset: number;
}
