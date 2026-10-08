import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { PermissionsStore } from '../../core/access/permissions.store';
import { I18nService } from '../../core/i18n/i18n.service';
import { grouped, joined } from '../../core/i18n/numbers';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ViewportService } from '../../core/layout/viewport.service';
import { ListRowComponent } from '../../ui/list-row/list-row.component';
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';
import { RowGroupComponent } from '../../ui/row-group/row-group.component';
import { SectionComponent } from '../../ui/section/section.component';
import { RowGroupSkeletonComponent } from '../../ui/skeleton/row-group-skeleton.component';
import { AdminStore } from './admin.store';
import { ADMIN_ENTRIES, ADMIN_SECTIONS, SECTION_TITLE, type AdminEntry } from './admin.entries';

/** A block of the overview with its rows. */
interface Block {
  title: string;
  rows: readonly Row[];
}

/** A row of the overview. */
interface Row {
  title: string;
  counts: string;
  path: string;
  ready: boolean;
}

/** The administration: the list on the phone, the list and the chosen item side by side on the desktop. */
@Component({
  selector: 'app-admin',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ListRowComponent,
    PageHeaderComponent,
    RouterOutlet,
    RowGroupComponent,
    RowGroupSkeletonComponent,
    SectionComponent,
    TranslatePipe,
  ],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.scss',
})
export class AdminComponent {
  private readonly i18n = inject(I18nService);
  private readonly rights = inject(PermissionsStore);
  private readonly router = inject(Router);
  private readonly store = inject(AdminStore);
  private readonly viewport = inject(ViewportService);

  protected readonly wide = this.viewport.wide;

  private readonly address = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );

  /** On the phone, a chosen item replaces the list. */
  protected readonly onEntry = computed(() => this.address().startsWith('/verwaltung/'));
  protected readonly showList = computed(() => this.wide() || !this.onEntry());

  /** The rows wait for the own permissions: without them, the overview does not know its items. */
  protected readonly waiting = computed(() => this.rights.permissions() === null);

  protected readonly blocks = computed<readonly Block[]>(() =>
    ADMIN_SECTIONS.map((section) => ({
      title: this.i18n.translate(SECTION_TITLE[section]),
      rows: this.rows(section),
    })).filter((block) => block.rows.length > 0),
  );

  constructor() {
    this.store.followSummary(this.rights.permissions);
  }

  protected chosen(path: string): boolean {
    return this.address().startsWith(path);
  }

  /** An item opens when its route is in the route table. */
  private ready(path: string): boolean {
    const children = this.router.config.find((route) => route.path === 'verwaltung')?.children ?? [];
    return children.some((child) => `/verwaltung/${child.path ?? ''}` === path);
  }

  protected open(path: string): void {
    void this.router.navigateByUrl(path);
  }

  protected back(): void {
    void this.router.navigateByUrl('/konto');
  }

  private rows(section: AdminEntry['section']): Row[] {
    return ADMIN_ENTRIES.filter(
      (entry) => entry.section === section && this.rights.can(entry.permission),
    ).map((entry) => ({
      title: this.i18n.translate(entry.title),
      counts: this.counts(entry),
      path: entry.path,
      ready: this.ready(entry.path),
    }));
  }

  /** The counters of the item. While the response is pending, the row shows none. */
  private counts(entry: AdminEntry): string {
    const held = this.store.summary();
    if (held === null) return '';
    return joined(entry.counts.map((key) => (held[key] === undefined ? null : grouped(held[key]))));
  }
}
