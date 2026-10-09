import { inject, type Provider } from '@angular/core';
import { I18nService } from '../core/i18n/i18n.service';
import { CatalogueText, catalogueNames } from '../features/species/catalogue-text';
import { PALETTE } from './species-fixture';

/** The names of catalogue values without the species store: the palette of the fixture. */
export const CATALOGUE_TEXT: Provider = {
  provide: CatalogueText,
  useFactory: () => catalogueNames(inject(I18nService), () => PALETTE),
};
