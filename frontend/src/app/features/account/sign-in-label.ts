import { computed, inject, type Signal } from '@angular/core';
import { ConfigStore } from '../../core/config/config.store';
import { I18nService } from '../../core/i18n/i18n.service';

/** "Sign in with {name}" with the SSO name of `/api/config`. Without a name, only "Sign in". */
export function signInLabel(): Signal<string> {
  const i18n = inject(I18nService);
  const config = inject(ConfigStore);
  return computed(() => {
    const name = config.providerName();
    return name === '' ? i18n.translate('account.signIn') : i18n.translate('account.signInWith', { name });
  });
}
