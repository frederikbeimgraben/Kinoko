import { afterNextRender, inject, EnvironmentInjector } from '@angular/core';
import { AuthService } from './core/auth';
import { ConfigStore } from './core/config/config.store';
import { TextCatalogService } from './core/i18n/text-catalog.service';
import { ThemeStore } from './core/theme/theme.store';
import { bootOffline } from './app.boot';

/** The start of the app. The shell, the map, the catalogue and the session start in parallel. */
export function startApp(): void {
  // The theme store paints the page when it starts, so the first frame has the correct theme.
  inject(ThemeStore);
  // The config store starts its read when it starts. `AuthService` waits for the answer itself.
  inject(ConfigStore);
  const auth = inject(AuthService);
  const texts = inject(TextCatalogService);
  const injector = inject(EnvironmentInjector);
  // The service worker, the queue and the catalogue start after the first frame.
  afterNextRender(
    () => {
      bootOffline(injector);
    },
    { injector },
  );
  void auth.restoreSession();
  // The server comes after the local copy, because the local copy holds the ETag.
  void texts
    .restore()
    .catch(() => undefined)
    .then(() => texts.load());
}
