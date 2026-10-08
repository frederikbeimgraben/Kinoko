import { Pipe, inject, type PipeTransform } from '@angular/core';
import { I18nService } from './i18n.service';
import type { TranslationKey } from './translations';

/**
 * `{{ 'nav.karte' | t }}`. The pipe is impure, so a language change applies immediately. The active language is a signal in the service.
 */
@Pipe({ name: 't', pure: false })
export class TranslatePipe implements PipeTransform {
  private readonly i18n = inject(I18nService);

  transform(key: TranslationKey, params?: Record<string, string | number>): string {
    return this.i18n.translate(key, params);
  }
}
