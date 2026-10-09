import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { I18nService } from '../../core/i18n/i18n.service';
import { grouped } from '../../core/i18n/numbers';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ViewportService } from '../../core/layout/viewport.service';
import { FloatingButtonComponent } from '../../ui/floating-button/floating-button.component';
import { ListRowComponent } from '../../ui/list-row/list-row.component';
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';
import { RowGroupComponent } from '../../ui/row-group/row-group.component';
import { RowGroupSkeletonComponent } from '../../ui/skeleton/row-group-skeleton.component';
import { AdminStore } from './admin.store';
import { roleName } from './role-name';

/** A row of the role list. */
interface Row {
  id: string;
  name: string;
  subline: string;
}

/** The role list: a row opens the role, the floating button adds a role. */
@Component({
  selector: 'app-roles',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FloatingButtonComponent,
    ListRowComponent,
    PageHeaderComponent,
    RowGroupComponent,
    RowGroupSkeletonComponent,
    TranslatePipe,
  ],
  templateUrl: './roles.component.html',
  styleUrl: './roles.component.scss',
})
export class RolesComponent {
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly store = inject(AdminStore);

  protected readonly wide = inject(ViewportService).wide;
  protected readonly loaded = computed(() => this.store.roles() !== null);

  /** The rows in the order of their names, as the board shows them. */
  protected readonly rows = computed<Row[]>(() => {
    const locale = this.i18n.locale();
    return (this.store.roles() ?? [])
      .map((role) => ({
        id: role.id,
        name: roleName(this.i18n, role.name),
        subline: this.people(role.peopleCount),
      }))
      .sort((one, other) => one.name.localeCompare(other.name, locale));
  });

  constructor() {
    this.store.loadRoles();
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

  /** The count of persons with the role, as the board shows it below the name. */
  private people(count: number): string {
    if (count === 1) return this.i18n.translate('admin.roles.onePerson');
    return this.i18n.translate('admin.roles.people', { count: grouped(count) });
  }
}
