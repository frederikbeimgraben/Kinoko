import type { components } from '../contract';

/** The counters of the admin overview. */
export type AdminSummary = components['schemas']['AdminSummary'];

/** The account of the current user with all its finds, objects and photos. */
export type AccountExport = components['schemas']['AccountExport'];

/** The counts of one species in the species admin. */
export type SpeciesCountsEntry = components['schemas']['SpeciesCountsEntry'];

/** A response that keeps its entries in `items`. */
export interface Items<E> {
  items: E[];
}

/** The account of the current user, as `/api/me` gives it. */
export type Me = components['schemas']['Me'];

/** The contract permissions. The server decides who has them. */
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

/** The four groups that the permission matrix uses for its rows. */
export type PermissionArea = components['schemas']['Area'];

export const PERMISSION_AREAS: readonly PermissionArea[] = ['species', 'interface', 'access', 'data'];

/** A catalogue permission with its group. */
export type PermissionEntry = components['schemas']['PermissionEntry'];

/** The response of `/api/me/permissions`. */
export type MyPermissions = components['schemas']['MyPermissions'];

/** The short form of a role, as shown next to a person. */
export interface RoleRef {
  id: string;
  slug: string;
  name: string;
}

export interface Role extends RoleRef {
  description: string | null;
  /** Admin and user are fixed. You cannot delete or rename them. */
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

/** Omitted fields keep their values. */
export interface RolePatch {
  name?: string;
  description?: string | null;
  permissions?: Permission[];
}

/** An account that used the service at least once. */
export type Person = components['schemas']['Person'];

/** The name of a person. It resolves only when you and the person share a group. */
export type PersonName = components['schemas']['PersonName'];

/** One page of the person list, with the total count. */
export interface Page<E> {
  eintraege: E[];
  gesamt: number;
  limit: number;
  offset: number;
}
