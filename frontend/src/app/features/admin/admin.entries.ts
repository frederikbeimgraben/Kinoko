import type { AdminSummary, Permission } from '../../core/api/models';
import type { TranslationKey } from '../../core/i18n/translations';

/** The three blocks of the overview. */
export const ADMIN_SECTIONS = ['content', 'access', 'operations'] as const;

export type AdminSection = (typeof ADMIN_SECTIONS)[number];

/** An item of the administration: its permission, its block, its route and its badge. */
export interface AdminEntry {
  title: TranslationKey;
  permission: Permission;
  section: AdminSection;
  path: string;
  /** The count in the badge. */
  total: keyof AdminSummary | null;
  /** A count of open work. Above zero, the badge shows it with `openText` instead of the total. */
  open?: keyof AdminSummary;
  openText?: TranslationKey;
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
    total: 'texts',
  },
  {
    title: 'admin.images.title',
    permission: 'image.review',
    section: 'content',
    path: '/verwaltung/bilder',
    total: 'photos',
    open: 'photosPending',
    openText: 'admin.badge.open',
  },
  {
    title: 'admin.species.title',
    permission: 'species.edit',
    section: 'content',
    path: '/verwaltung/arten',
    total: 'species',
  },
  {
    title: 'glossary.title',
    permission: 'text.edit',
    section: 'content',
    path: '/verwaltung/glossar',
    total: 'glossary',
  },
  {
    title: 'admin.categories.title',
    permission: 'species.edit',
    section: 'content',
    path: '/verwaltung/kategorien',
    total: 'terms',
  },
  {
    title: 'admin.roles.title',
    permission: 'role.manage',
    section: 'access',
    path: '/verwaltung/rollen',
    total: 'roles',
  },
  {
    title: 'admin.people.title',
    permission: 'role.assign',
    section: 'access',
    path: '/verwaltung/personen',
    total: 'people',
  },
  {
    title: 'group.title',
    permission: 'group.manage',
    section: 'access',
    path: '/verwaltung/gruppen',
    total: 'groups',
  },
  {
    title: 'admin.finds.title',
    permission: 'find.review',
    section: 'operations',
    path: '/verwaltung/funde',
    total: 'finds',
    open: 'findsPending',
    openText: 'admin.badge.open',
  },
  {
    title: 'admin.runs.title',
    permission: 'run.manage',
    section: 'operations',
    path: '/verwaltung/laeufe',
    total: 'runs',
    open: 'runsRunning',
    openText: 'admin.badge.running',
  },
  {
    title: 'admin.dataSources.title',
    permission: 'data.manage',
    section: 'operations',
    path: '/verwaltung/datenquellen',
    total: null,
    open: 'dataSourcesMissing',
    openText: 'admin.badge.missing',
  },
];

/** The permissions that open at least one item of the administration. */
export const ADMIN_PERMISSIONS: readonly Permission[] = ADMIN_ENTRIES.map((entry) => entry.permission);
