import type { AdminSummary, Permission } from '../../core/api/models';
import type { TranslationKey } from '../../core/i18n/translations';

/** Die drei Blöcke der Übersicht. */
export const ADMIN_SECTIONS = ['content', 'access', 'operations'] as const;

export type AdminSection = (typeof ADMIN_SECTIONS)[number];

/** Ein Punkt der Verwaltung: sein Recht, sein Block, sein Weg, seine Zähler. */
export interface AdminEntry {
  title: TranslationKey;
  permission: Permission;
  section: AdminSection;
  path: string;
  counts: readonly (keyof AdminSummary)[];
}

export const SECTION_TITLE: Readonly<Record<AdminSection, TranslationKey>> = {
  content: 'admin.section.content',
  access: 'admin.section.access',
  operations: 'admin.section.operations',
};

export const ADMIN_ENTRIES: readonly AdminEntry[] = [
  {
    title: 'admin.texts.title',
    permission: 'text.edit',
    section: 'content',
    path: '/verwaltung/texte',
    counts: ['texts'],
  },
  {
    title: 'admin.images.title',
    permission: 'image.review',
    section: 'content',
    path: '/verwaltung/bilder',
    counts: ['photos', 'photosPending'],
  },
  {
    title: 'admin.species.title',
    permission: 'species.edit',
    section: 'content',
    path: '/verwaltung/arten',
    counts: ['species'],
  },
  {
    title: 'admin.roles.title',
    permission: 'role.manage',
    section: 'access',
    path: '/verwaltung/rollen',
    counts: ['roles', 'permissions'],
  },
  {
    title: 'admin.people.title',
    permission: 'role.assign',
    section: 'access',
    path: '/verwaltung/personen',
    counts: ['people'],
  },
  {
    title: 'admin.finds.title',
    permission: 'find.review',
    section: 'operations',
    path: '/verwaltung/funde',
    counts: ['finds', 'findsPending'],
  },
  {
    title: 'admin.runs.title',
    permission: 'run.manage',
    section: 'operations',
    path: '/verwaltung/laeufe',
    counts: ['runs', 'runsRunning'],
  },
];

/** Die Rechte, die überhaupt einen Punkt der Verwaltung freischalten. */
export const ADMIN_PERMISSIONS: readonly Permission[] = ADMIN_ENTRIES.map((entry) => entry.permission);
