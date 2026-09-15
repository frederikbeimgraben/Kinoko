import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { PermissionsService } from '../../core/access/permissions.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { grouped, joined } from '../../core/i18n/numbers';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ViewportService } from '../../core/layout/viewport.service';
import { ListRowComponent } from '../../ui/list-row/list-row.component';
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';
import { AdminState } from './admin.state';
import { ADMIN_ENTRIES, ADMIN_SECTIONS, SECTION_TITLE, type AdminEntry } from './admin.entries';

/** Ein Block der Übersicht mit seinen Zeilen. */
interface Block {
  title: string;
  rows: readonly Row[];
}

/** Eine Zeile der Übersicht. */
interface Row {
  title: string;
  counts: string;
  path: string;
  ready: boolean;
}

/** Die Verwaltung: am Telefon die Liste, am Rechner Liste und Punkt zugleich. */
@Component({
  selector: 'app-admin',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ListRowComponent, PageHeaderComponent, RouterOutlet, TranslatePipe],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.scss',
})
export class AdminComponent {
  private readonly i18n = inject(I18nService);
  private readonly rights = inject(PermissionsService);
  private readonly router = inject(Router);
  private readonly state = inject(AdminState);
  private readonly viewport = inject(ViewportService);

  protected readonly wide = this.viewport.wide;

  private readonly address = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );

  /** Ein gewählter Punkt schiebt am Telefon die Liste beiseite. */
  protected readonly onEntry = computed(() => this.address().startsWith('/verwaltung/'));
  protected readonly showList = computed(() => this.wide() || !this.onEntry());

  protected readonly blocks = computed<readonly Block[]>(() =>
    ADMIN_SECTIONS.map((section) => ({
      title: this.i18n.translate(SECTION_TITLE[section]),
      rows: this.rows(section),
    })).filter((block) => block.rows.length > 0),
  );

  constructor() {
    effect(() => {
      if (this.rights.permissions() !== null) this.state.loadSummary();
    });
  }

  protected chosen(path: string): boolean {
    return this.address().startsWith(path);
  }

  /** Ein Punkt führt weiter, sobald sein Weg in der Routentabelle steht. */
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

  /** Die Zahlen des Punktes. Solange die Antwort aussteht, steht keine da. */
  private counts(entry: AdminEntry): string {
    const held = this.state.summary();
    if (held === null) return '';
    return joined(entry.counts.map((key) => (held[key] === undefined ? null : grouped(held[key]))));
  }
}
