import type { Edibility, Permission, PermissionArea, TermKind } from '../../core/api/models';
import type { TranslationKey } from '../../core/i18n/translations';

/** The text key for each permission and each area. */
export const PERMISSION_TEXT: Readonly<Record<Permission, TranslationKey>> = {
  'species.edit': 'admin.role.editSpeciesProfiles',
  'image.submit': 'admin.role.submitImages',
  'image.review': 'admin.role.approveImages',
  'text.edit': 'admin.role.editTexts',
  'role.manage': 'admin.role.manageRoles',
  'role.assign': 'admin.role.assignRoles',
  'find.review': 'admin.role.reviewFinds',
  'run.manage': 'admin.role.manageRuns',
  'data.manage': 'admin.role.manageData',
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

/** Short names of the edibility for the five segments of the create page. */
export const EDIBILITY_SHORT_TEXT: Readonly<Record<Edibility, TranslationKey>> = {
  edible: 'admin.species.edibilityShort.edible',
  conditionally_edible: 'admin.species.edibilityShort.conditionally_edible',
  inedible: 'admin.species.edibilityShort.inedible',
  poisonous: 'admin.species.edibilityShort.poisonous',
  deadly: 'admin.species.edibilityShort.deadly',
};
