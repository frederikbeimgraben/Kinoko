import {
  DOCUMENT,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { SessionStore } from '../core/auth';
import { ViewportService } from '../core/layout/viewport.service';
import { I18nService } from '../core/i18n/i18n.service';
// This file loads at start. It imports each part directly and not from `ui/index.ts`:
// the barrel puts every part into the first bundle (81 kB more).
import { AvatarButtonComponent } from '../ui/avatar-button/avatar-button.component';
import { NavComponent } from '../ui/nav/nav.component';
import { BannerComponent } from '../ui/banner/banner.component';
import { MapComponent } from '../features/map/map.component';
import { MapStore } from '../features/map/map.store';
import { AddEntryStore } from '../features/add-entry/add-entry.store';
import { SyncStore } from '../core/offline/sync.store';
import { PwaStore } from '../core/pwa/pwa.store';
import { deskFrame, paneWidth, type DeskFrame } from './desk-frame';

/** Paths without the tab bar. The rule is on the path, not in the page. */
const WITHOUT_NAV: readonly RegExp[] = [
  /^\/bausteine(\/|$)/,
  /^\/arten\/[^/]+/,
  /^\/taxonomie(\/|$)/,
  /^\/verwaltung(\/|$)/,
  /^\/konto(\/|$)/,
];

/** The space that a floating banner takes at the top of the map: `MapControls top=60` on the boards. */
const FLOAT_BANNER_OFFSET = 'calc(60px + env(safe-area-inset-top, 0px))';

/** The frame around each tab. The map lives here and stays in memory when the tab changes. */
@Component({
  selector: 'app-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AvatarButtonComponent, NavComponent, BannerComponent, MapComponent, RouterOutlet],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent {
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  private readonly i18n = inject(I18nService);
  private readonly viewport = inject(ViewportService);
  private readonly session = inject(SessionStore);
  private readonly map = inject(MapStore);
  private readonly addEntry = inject(AddEntryStore);
  private readonly sync = inject(SyncStore);
  private readonly pwa = inject(PwaStore);

  protected readonly updateReady = this.pwa.updateReady;

  private readonly address = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );

  /** True after the first real navigation. */
  private readonly navigated = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => true),
    ),
    { initialValue: false },
  );

  protected readonly wide = this.viewport.wide;

  /** The first part of the path, without the query: `/karte?art=…` → `/karte`. */
  protected readonly active = computed(() => `/${this.address().split(/[?#/]/)[1] || 'karte'}`);

  protected readonly onTheMap = computed(() => this.active() === '/karte');

  private readonly _mapWanted = signal(false);
  /** Becomes true on the first visit of the map or at desktop width, and stays true. */
  protected readonly mapWanted = this._mapWanted.asReadonly();

  /** On the phone, outside the map tab, the map is not visible and does no work. */
  protected readonly mapHidden = computed(() => !this.wide() && !this.onTheMap());

  /** On the desktop the rail holds the avatar, so the map shows none (board `MapDesktop`). */
  protected readonly showAvatar = computed(
    () => this.onTheMap() && !this.wide() && !this.addEntry.showsCrosshair(),
  );

  /** The map shows its own banner when there is no network on the map tab. */
  private readonly mapOffline = computed(() => this.onTheMap() && !this.sync.online());

  /** Over the phone map the banner floats at the top; elsewhere it sits above the nav. */
  protected readonly bannerFloats = computed(() => this.onTheMap() && !this.wide());

  /** The space of a banner at the top of the map. Floating parts and the avatar move down by it. */
  protected readonly topBarHeight = computed(() =>
    (this.updateReady() && this.bannerFloats()) || this.mapOffline() ? FLOAT_BANNER_OFFSET : '0px',
  );

  /** The desktop frame of the section: column width and what fills the rest. */
  protected readonly frame = computed<DeskFrame>(() => deskFrame(this.active()));

  /** No tab, no bar below. The desktop keeps the rail. */
  protected readonly bare = computed(() => {
    const path = this.address().split(/[?#]/)[0];
    return !this.wide() && WITHOUT_NAV.some((rule) => rule.test(path));
  });

  /** While a map sheet is open, the map is in front of the tab. On the desktop the
   * map buttons show on each tab, and their sheets go in the left column. */
  protected readonly mapInFront = computed(() => this.map.layersSheetOpen() || this.addEntry.running());

  /** The first letter of the name, "G" for a guest, `null` while the session is not known. */
  protected readonly avatarName = computed(() => {
    if (this.session.status() === 'unknown') return null;
    return this.session.name() ?? this.i18n.translate('konto.gast');
  });

  protected readonly avatarLabel = computed(() => {
    const name = this.session.status() === 'signedIn' ? this.session.name() : null;
    return name === null
      ? this.i18n.translate('nav.konto')
      : this.i18n.translate('konto.avatarAngemeldet', { name });
  });

  constructor() {
    effect(() => {
      if (this.navigated() && (this.wide() || this.onTheMap())) this._mapWanted.set(true);
    });
    // Modals outside the shell also read the column width, so it goes on the root element.
    effect(() => {
      const width = this.wide() ? paneWidth(this.frame().pane) : null;
      const root = this.document.documentElement.style;
      if (width === null) root.removeProperty('--size-column');
      else root.setProperty('--size-column', width);
    });
  }

  protected toAccount(): void {
    void this.router.navigate(['/konto']);
  }

  protected reload(): void {
    void this.pwa.activate();
  }
}
