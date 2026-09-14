import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CardComponent } from '@stupa-makers/ui-kit';
import type { Role } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ActionBarComponent } from '../../ui/action-bar/action-bar.component';
import { EmptyStateComponent } from '../../ui/empty-state/empty-state.component';
import { ListRowComponent } from '../../ui/list-row/list-row.component';
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';
import { SvgIconComponent } from '../../ui/svg-icon/svg-icon.component';
import { AdminState } from './admin.state';

/** Eine Zeile der Rollenliste. */
interface Row {
  id: string;
  name: string;
  subline: string;
  /** Admin und Nutzer tragen ein Schloss statt eines Wegs zum Ändern. */
  locked: boolean;
}

/**
 * Die Rollenliste (Artboard `Rollen`). Anlegen unten, Umbenennen und Löschen
 * auf der Rolle selbst.
 *
 * Die feste Rolle Admin und die feste Rolle Nutzer tragen ein Schloss links
 * neben dem Pfeil. Sie lassen sich öffnen und lesen, aber nicht ändern.
 */
@Component({
  selector: 'app-roles',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ActionBarComponent,
    CardComponent,
    EmptyStateComponent,
    ListRowComponent,
    PageHeaderComponent,
    SvgIconComponent,
    TranslatePipe,
  ],
  templateUrl: './roles.component.html',
  styleUrl: './roles.component.scss',
})
export class RolesComponent {
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly state = inject(AdminState);

  protected readonly loaded = computed(() => this.state.roles() !== null);
  protected readonly rows = computed<Row[]>(() =>
    (this.state.roles() ?? []).map((role) => ({
      id: role.id,
      name: role.name,
      subline: this.i18n.translate('rollen.unter', {
        rechte: this.rights(role),
        personen: this.people(role.people),
      }),
      locked: role.builtIn,
    })),
  );

  protected readonly lockLabel = computed(() => this.i18n.translate('rollen.fest'));

  constructor() {
    this.state.loadRoles();
    this.state.loadCatalogue();
  }

  protected open(id: string): void {
    void this.router.navigate(['/verwaltung/rollen', id]);
  }

  protected create(): void {
    void this.router.navigate(['/verwaltung/rollen', 'neu']);
  }

  protected back(): void {
    void this.router.navigateByUrl('/verwaltung');
  }

  /** „Alle Rechte“ für Admin, sonst die Zahl. Die Rolle Admin trägt keine Zeilen. */
  private rights(role: Role): string {
    const catalogue = this.state.catalogue();
    if (catalogue !== null && role.permissions.length === catalogue.length) {
      return this.i18n.translate('rollen.alleRechte');
    }
    if (role.permissions.length === 0) return this.i18n.translate('rollen.keinRecht');
    if (role.permissions.length === 1) return this.i18n.translate('rollen.einRecht');
    return this.i18n.translate('rollen.rechte', { anzahl: role.permissions.length });
  }

  private people(count: number): string {
    if (count === 0) return this.i18n.translate('rollen.keinePerson');
    if (count === 1) return this.i18n.translate('rollen.einePerson');
    return this.i18n.translate('rollen.personen', { anzahl: count });
  }
}
