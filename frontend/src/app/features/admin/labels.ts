import type { Permission, PermissionArea, TermKind } from '../../core/api/models';
import type { TranslationKey } from '../../core/i18n/translations';

/** Die Beschriftung zu einem Recht und zu einem Bereich. */
export const PERMISSION_TEXT: Readonly<Record<Permission, TranslationKey>> = {
  'species.edit': 'admin.role.editSpeciesProfiles',
  'image.submit': 'admin.role.submitImages',
  'image.review': 'admin.role.approveImages',
  'text.edit': 'admin.role.editTexts',
  'role.manage': 'admin.role.manageRoles',
  'role.assign': 'admin.role.assignRoles',
  'find.review': 'admin.role.reviewFinds',
  'run.manage': 'admin.role.manageRuns',
  'group.manage': 'admin.role.manageGroups',
};

export const KIND_TEXT: Readonly<Record<TermKind, TranslationKey>> = {
  smell: 'admin.category.smell',
  taste: 'admin.category.taste',
  tree: 'admin.category.tree',
  trigger: 'admin.category.trigger',
};

export const AREA_TEXT: Readonly<Record<PermissionArea, TranslationKey>> = {
  species: 'admin.role.section.species',
  interface: 'admin.role.section.interface',
  access: 'admin.role.section.access',
  data: 'admin.role.section.data',
};
