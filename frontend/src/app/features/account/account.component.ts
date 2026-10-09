import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { PermissionsStore } from '../../core/access/permissions.store';
import { AuthService, SessionStore } from '../../core/auth';
import { ConfigStore } from '../../core/config/config.store';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import type { TranslationKey } from '../../core/i18n/translations';
import { ViewportService } from '../../core/layout/viewport.service';
import { AccountTileComponent } from '../../ui/account-tile/account-tile.component';
import { ButtonComponent } from '../../ui/button/button.component';
import { ListRowComponent } from '../../ui/list-row/list-row.component';
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';
import { RowGroupComponent } from '../../ui/row-group/row-group.component';
import { ScrollFadeDirective } from '../../ui/scroll-fade/scroll-fade.directive';
import { SectionComponent } from '../../ui/section/section.component';
import { SkeletonComponent } from '../../ui/skeleton/skeleton.component';
import { ADMIN_PERMISSIONS } from '../admin/admin.entries';
import { AboutGroupComponent } from './about-group.component';
import { AccountStatsComponent } from './account-stats.component';
import { AppearanceFieldsComponent } from './appearance-fields.component';
import { OfflineSectionComponent } from './offline-section.component';
import { signInLabel } from './sign-in-label';

/** A row of the account list: its label, its path and who sees it. */
interface NavRow {
  readonly key: string;
  readonly label: TranslationKey;
  readonly path: string;
  /** The paths below `/konto` that select the row in the desktop list. */
  readonly owns: readonly string[];
  readonly needs: 'all' | 'signedIn' | 'admin';
  readonly desktopOnly?: boolean;
}

/** The rows in the order of `Account.dc.html` and `AccountDesktop.dc.html`. */
const NAV: readonly NavRow[] = [
  {
    key: 'appearance',
    label: 'account.appearanceAndLanguage',
    path: '/konto',
    owns: [''],
    needs: 'all',
    desktopOnly: true,
  },
  { key: 'images', label: 'bild.meine', path: '/konto/bilder', owns: ['bilder'], needs: 'signedIn' },
  { key: 'data', label: 'account.myData', path: '/konto/daten', owns: ['daten'], needs: 'signedIn' },
  { key: 'groups', label: 'group.title', path: '/konto/gruppen', owns: ['gruppen'], needs: 'signedIn' },
  {
    key: 'offline',
    label: 'map.offlineArea.title',
    path: '/konto/offline',
    owns: ['offline'],
    needs: 'signedIn',
    desktopOnly: true,
  },
  { key: 'glossary', label: 'glossary.title', path: '/konto/glossar', owns: ['glossar'], needs: 'signedIn' },
  { key: 'admin', label: 'konto.verwaltung', path: '/verwaltung', owns: [], needs: 'admin' },
  {
    key: 'about',
    label: 'account.section.about',
    path: '/konto/ueber',
    owns: ['ueber', 'methode', 'lizenzen'],
    needs: 'all',
    desktopOnly: true,
  },
];

/** The account. On the phone it is one page, and each entry opens its own page.
 * On the desktop it is a list with the selected entry in a detail pane. */
@Component({
  selector: 'app-account',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AboutGroupComponent,
    AccountStatsComponent,
    AccountTileComponent,
    AppearanceFieldsComponent,
    ButtonComponent,
    ListRowComponent,
    NgTemplateOutlet,
    OfflineSectionComponent,
    PageHeaderComponent,
    RouterOutlet,
    RowGroupComponent,
    ScrollFadeDirective,
    SectionComponent,
    SkeletonComponent,
    TranslatePipe,
  ],
  templateUrl: './account.component.html',
  styleUrl: './account.component.scss',
})
export class AccountComponent {
  private readonly auth = inject(AuthService);
  private readonly config = inject(ConfigStore);
  private readonly router = inject(Router);
  private readonly rights = inject(PermissionsStore);
  private readonly session = inject(SessionStore);

  protected readonly wide = inject(ViewportService).wide;
  protected readonly user = this.auth.user;
  protected readonly signedIn = this.auth.signedIn;
  /** While the session or the user is not known, the account tile is a skeleton. */
  protected readonly unknown = computed(() => {
    const status = this.session.status();
    return status === 'unknown' || (status === 'signedIn' && this.user() === null);
  });

  private readonly path = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );

  /** The part below `/konto`: `''` for the account itself, `gruppen` for `/konto/gruppen/…`. */
  private readonly child = computed(() => this.path().split(/[?#]/)[0].split('/')[2] ?? '');

  /** On the phone the account page shows only at `/konto`. Below it, the child page fills the screen. */
  protected readonly home = computed(() => this.child() === '');

  /** The same SSO name as on the sign-in button. */
  protected readonly server = this.config.providerName;
  protected readonly signInLabel = signInLabel();
  protected readonly ssoMissing = this.config.ssoMissing;
  protected readonly signingIn = this.auth.signingIn;

  private readonly allowed = computed(() => {
    const admin = this.rights.canAny(ADMIN_PERMISSIONS);
    const signedIn = this.signedIn();
    return (row: NavRow): boolean => row.needs === 'all' || (row.needs === 'signedIn' ? signedIn : admin);
  });

  /** The phone list has only the rows that open their own page. */
  protected readonly phoneRows = computed(() => NAV.filter((row) => !row.desktopOnly && this.allowed()(row)));

  protected readonly desktopRows = computed(() => NAV.filter(this.allowed()));

  protected readonly selected = computed(
    () => NAV.find((row) => row.owns.includes(this.child()))?.key ?? null,
  );

  protected open(path: string): void {
    void this.router.navigateByUrl(path);
  }

  protected close(): void {
    void this.router.navigateByUrl('/karte');
  }

  protected signIn(): void {
    void this.auth.signIn('/konto');
  }

  protected signOut(): void {
    void this.auth.signOut();
  }
}
