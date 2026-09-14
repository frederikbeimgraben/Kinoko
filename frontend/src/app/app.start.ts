import { afterNextRender, inject, EnvironmentInjector } from '@angular/core';
import { AuthService } from './core/auth';
import { ConfigService } from './core/config/config.service';
import { TextCatalogService } from './core/i18n/text-catalog.service';
import { ThemeService } from './core/theme/theme.service';
import { bootOffline } from './app.boot';

/** Der Start der App. Jedes `inject` steht vor dem ersten `await`. */
export async function startApp(): Promise<void> {
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
  // Der abgelegte Katalog hält den ersten Frame nicht auf. Sein Signal
  // schreibt die Oberfläche um, sobald die Ablage antwortet.
  const stored = texts.restore().catch(() => undefined);
  // Ohne Issuer und Client ID gibt es keine Anmeldung. Die Sitzung kommt
  // danach im Hintergrund: oidc-client-ts hält den ersten Frame sonst auf.
  await config.load();
  void auth.restoreSession();
  // Der Server erst nach der Ablage: sein ETag steht dort.
  void stored.then(() => texts.load());
}
