import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  isDevMode,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  inject,
  type ApplicationConfig,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';
import { UI_KIT_INTL, uiKitIntlFromLang } from '@stupa-makers/ui-kit';
import { authInterceptor } from './core/auth';
import { I18nService } from './core/i18n/i18n.service';
import { routes } from './app.routes';
import { startApp } from './app.start';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:5000',
    }),
    // Die Texte des Kits folgen der Sprache der App, statt eine eigene zu führen.
    { provide: UI_KIT_INTL, useFactory: () => uiKitIntlFromLang(inject(I18nService).locale) },
    provideAppInitializer(startApp),
  ],
};
