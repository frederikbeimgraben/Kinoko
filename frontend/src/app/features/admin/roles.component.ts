import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { I18nService } from '../../core/i18n/i18n.service';
import { grouped, joined } from '../../core/i18n/numbers';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import type { TranslationKey } from '../../core/i18n/translations';
import { AddRowComponent } from '../../ui/add-row/add-row.component';
import { ListRowComponent } from '../../ui/list-row/list-row.component';
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';
import { SvgIconComponent } from '../../ui/svg-icon/svg-icon.component';
import { AdminState } from './admin.state';

/** Eine Zeile der Rollenliste. */
interface Row {
  id: string;
  name: string;
  subline: string;
  /** Eine feste Rolle trägt ein Schloss statt eines Wegs zum Ändern. */
  locked: boolean;
}

/** Die Rollenliste: eine Zeile führt in die Rolle, die letzte legt eine an. */
@Component({
  selector: 'app-roles',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AddRowComponent, ListRowComponent, PageHeaderComponent, SvgIconComponent, TranslatePipe],
  templateUrl: './roles.component.html',
  styleUrl: './roles.component.scss',
})
export class RolesComponent {
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly state = inject(AdminState);

  protected readonly rows = computed<Row[]>(() =>
    (this.state.roles() ?? []).map((role) => ({
      id: role.id,
      name: this.i18n.translate(role.name as TranslationKey),
      subline: joined([role.description, this.people(role.peopleCount)]),
      locked: role.builtIn,
    })),
  );

  protected readonly lockLabel = computed(() => this.i18n.translate('admin.roles.locked'));

  constructor() {
    this.state.loadRoles();
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

  /** Eine Rolle ohne Person nennt keine Zahl. */
  private people(count: number): string | null {
    if (count === 0) return null;
    if (count === 1) return this.i18n.translate('admin.roles.onePerson');
    return this.i18n.translate('admin.roles.people', { count: grouped(count) });
  }
}
