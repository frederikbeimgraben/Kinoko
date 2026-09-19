import type { Permission, PermissionArea } from '../../core/api/models';
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

export const AREA_TEXT: Readonly<Record<PermissionArea, TranslationKey>> = {
  species: 'admin.role.section.species',
  interface: 'admin.role.section.interface',
  access: 'admin.role.section.access',
  data: 'admin.role.section.data',
};
