import { afterNextRender, inject, EnvironmentInjector } from '@angular/core';
import { AuthService } from './core/auth';
import { ConfigService } from './core/config/config.service';
import { TextCatalogService } from './core/i18n/text-catalog.service';
import { ThemeService } from './core/theme/theme.service';
import { bootOffline } from './app.boot';

/** Der Start der App. Hülle, Karte, Katalog und Sitzung laufen nebeneinander. */
export function startApp(): void {
  inject(ThemeService).init();
  const auth = inject(AuthService);
  const texts = inject(TextCatalogService);
  const config = inject(ConfigService);
  const injector = inject(EnvironmentInjector);
  // Service Worker, Warteschlange und Katalog erst nach dem ersten Bild.
  afterNextRender(
    () => {
      bootOffline(injector);
    },
    { injector },
  );
  void config.load();
  // Die Sitzung wartet in `AuthService` selbst auf die Konfiguration.
  void auth.restoreSession();
  // Der Server erst nach der Ablage: sein ETag steht dort.
  void texts
    .restore()
    .catch(() => undefined)
    .then(() => texts.load());
}
