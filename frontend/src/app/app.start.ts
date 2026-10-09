import { afterNextRender, inject, EnvironmentInjector } from '@angular/core';
import { AuthService } from './core/auth';
import { leaveSignedInPages } from './core/auth/signed-in.guard';
import { ConfigStore } from './core/config/config.store';
import { HistoryService } from './core/navigation/history.service';
import { TextCatalogService } from './core/i18n/text-catalog.service';
import { ThemeStore } from './core/theme/theme.store';
import { bootOffline } from './app.boot';

/** The start of the app. The shell, the map, the catalogue and the session start in parallel. */
export function startApp(): void {
  // The theme store paints the page when it starts, so the first frame has the correct theme.
  inject(ThemeStore);
  // The in-app back arrow needs every navigation from the first one.
  inject(HistoryService);
  leaveSignedInPages();
  const config = inject(ConfigStore);
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
  void config.load();
  // `AuthService` waits for the configuration itself.
  void auth.restoreSession();
  // The server comes after the local copy, because the local copy holds the ETag.
  void texts
    .restore()
    .catch(() => undefined)
    .then(() => texts.load());
}
