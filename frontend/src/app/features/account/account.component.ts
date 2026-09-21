import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { PermissionsService } from '../../core/access/permissions.service';
import { AuthService } from '../../core/auth';
import { ConfigService } from '../../core/config/config.service';
import { I18nService, LANGUAGE_CHOICES, type LanguageChoice } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { MapAppService, type MapApp } from '../../core/maps/map-app.service';
import { PwaService } from '../../core/pwa/pwa.service';
import { ThemeService, type ThemeChoice } from '../../core/theme/theme.service';
import { APP_VERSION } from '../../core/version.generated';
import { AccountTileComponent } from '../../ui/account-tile/account-tile.component';
import { ButtonComponent } from '../../ui/button/button.component';
import { LevelPillComponent } from '../../ui/level-pill/level-pill.component';
import { ListRowComponent } from '../../ui/list-row/list-row.component';
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';
import { RowGroupComponent } from '../../ui/row-group/row-group.component';
import { ScrollFadeDirective } from '../../ui/scroll-fade/scroll-fade.directive';
import { type SegmentOption, SegmentedComponent } from '../../ui/segmented/segmented.component';
import { ADMIN_PERMISSIONS } from '../admin/admin.entries';

/** Die drei Wahlmöglichkeiten der Darstellung, in der Reihenfolge des Artboards. */
const THEMES: readonly ThemeChoice[] = ['hell', 'dunkel', 'system'];

/** OpenStreetMap vor Google Maps, wie das Artboard sie zeigt. */
const MAP_APPS: readonly MapApp[] = ['osm', 'google'];

/**
 * Der Konto-Screen (Artboard `Mehr`): wer angemeldet ist, Darstellung, Offline
 * und Über. Er ist auch ohne Anmeldung vollständig bedienbar; nur die
 * Konto-Karte wechselt ihren Inhalt.
 *
 * Die Zahlen unter „Offline“ stehen auf null, bis F1 die Warteschlange und die
 * Gebiete liefert. Sie stehen trotzdem hier, weil der Screen sonst zweimal
 * gebaut würde.
 */
@Component({
  selector: 'app-account',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AccountTileComponent,
    ButtonComponent,
    LevelPillComponent,
    ListRowComponent,
    PageHeaderComponent,
    RowGroupComponent,
    ScrollFadeDirective,
    SegmentedComponent,
    TranslatePipe,
  ],
  templateUrl: './account.component.html',
  styleUrl: './account.component.scss',
})
export class AccountComponent {
  private readonly auth = inject(AuthService);
  private readonly config = inject(ConfigService);
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly theme = inject(ThemeService);
  private readonly mapApp = inject(MapAppService);
  private readonly rights = inject(PermissionsService);
  private readonly pwa = inject(PwaService);

  protected readonly canInstall = this.pwa.canInstall;
  protected readonly updateReady = this.pwa.updateReady;

  protected readonly user = this.auth.user;
  /** Ohne ein Recht der Verwaltung fehlt der Punkt ganz. */
  protected readonly canAdminister = computed(() => this.rights.canAny(ADMIN_PERMISSIONS));
  protected readonly signedIn = this.auth.signedIn;
  protected readonly choice = this.theme.choice;
  protected readonly languageChoice = this.i18n.choice;

  /**
   * Deutsch, Englisch oder der Browser. Die Wahl steht neben der Darstellung,
   * weil beides dasselbe ist: wie die App aussieht, nicht was in ihr steht.
   */
  protected readonly languages = computed<SegmentOption[]>(() =>
    LANGUAGE_CHOICES.map((value) => ({ value, label: this.i18n.translate(`sprache.${value}`) })),
  );

  protected selectLanguage(value: string): void {
    const selected = LANGUAGE_CHOICES.find((candidate) => candidate === value);
    if (selected) this.i18n.setChoice(selected satisfies LanguageChoice);
  }

  protected readonly version = APP_VERSION;

  protected readonly themes = computed<SegmentOption[]>(() =>
    THEMES.map((choice) => ({ value: choice, label: this.i18n.translate(`theme.${choice}`) })),
  );

  protected readonly mapAppChoice = this.mapApp.choice;

  protected readonly mapApps = computed<SegmentOption[]>(() =>
    MAP_APPS.map((choice) => ({ value: choice, label: this.i18n.translate(`account.mapApp.${choice}`) })),
  );

  protected selectMapApp(value: string): void {
    const choice = MAP_APPS.find((candidate) => candidate === value);
    if (choice) this.mapApp.setChoice(choice);
  }

  protected install(): void {
    void this.pwa.install();
  }

  protected back(): void {
    void this.router.navigateByUrl('/karte');
  }

  protected toMyImages(): void {
    void this.router.navigateByUrl('/konto/bilder');
  }

  protected toMyData(): void {
    void this.router.navigateByUrl('/konto/daten');
  }

  protected toMethod(): void {
    void this.router.navigateByUrl('/konto/methode');
  }

  protected toLicences(): void {
    void this.router.navigateByUrl('/konto/lizenzen');
  }

  protected toGroups(): void {
    void this.router.navigateByUrl('/konto/gruppen');
  }

  protected toGlossary(): void {
    void this.router.navigateByUrl('/konto/glossar');
  }

  protected toAdministration(): void {
    void this.router.navigateByUrl('/verwaltung');
  }

  protected signIn(): void {
    void this.auth.signIn('/konto');
  }

  protected signOut(): void {
    void this.auth.signOut();
  }

  protected selectTheme(value: string): void {
    const choice = THEMES.find((candidate) => candidate === value);
    if (choice) this.theme.setChoice(choice);
  }

  /** Der Wirt des Issuers sagt kürzer als die volle URL, wo das Konto liegt. */
  protected aussteller(): string {
    const issuer = this.config.configuration()?.oidcIssuer ?? '';
    try {
      return new URL(issuer).host;
    } catch {
      // Ein Issuer, der keine URL ist, steht so da, wie er gekommen ist.
      return issuer;
    }
  }
}
