import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  isDevMode,
  type ApplicationConfig,
} from '@angular/core';
import { provideRouter, withComponentInputBinding, withViewTransitions } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';
import { authInterceptor } from './core/auth';
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
    // Der Katalog liegt auf dem Gerät, nicht nur im Arbeitsspeicher.
    { provide: TEXT_CACHE, useExisting: OfflineTextCache },
    provideAppInitializer(startApp),
  ],
};
