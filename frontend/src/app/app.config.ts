import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  inject,
  isDevMode,
  type ApplicationConfig,
} from '@angular/core';
import { provideRouter, withComponentInputBinding, withViewTransitions } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';
import { UI_KIT_INTL, uiKitIntlFromLang } from '@stupa-makers/ui-kit';
import { authInterceptor } from './core/auth';
import { I18nService } from './core/i18n/i18n.service';
import { TEXT_CACHE } from './core/i18n/text-cache';
import { OfflineTextCache } from './core/offline/offline-text-cache';
import { applyRouteMotion } from './core/navigation/route-motion';
import { routes } from './app.routes';
import { startApp } from './app.start';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withViewTransitions({ skipInitialTransition: true, onViewTransitionCreated: applyRouteMotion }),
    ),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerImmediately',
    }),
    // Die Texte des Kits folgen der Sprache der App, statt eine eigene zu führen.
    { provide: UI_KIT_INTL, useFactory: () => uiKitIntlFromLang(inject(I18nService).locale) },
    // Der Katalog liegt auf dem Gerät, nicht nur im Arbeitsspeicher.
    { provide: TEXT_CACHE, useExisting: OfflineTextCache },
    provideAppInitializer(startApp),
  ],
};
