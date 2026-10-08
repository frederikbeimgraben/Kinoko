import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { I18nService } from '../../core/i18n/i18n.service';
import { grouped, joined } from '../../core/i18n/numbers';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ViewportService } from '../../core/layout/viewport.service';
import { AddRowComponent } from '../../ui/add-row/add-row.component';
import { ListRowComponent } from '../../ui/list-row/list-row.component';
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';
import { RowGroupComponent } from '../../ui/row-group/row-group.component';
import { RowGroupSkeletonComponent } from '../../ui/skeleton/row-group-skeleton.component';
import { SvgIconComponent } from '../../ui/svg-icon/svg-icon.component';
import { AdminStore } from './admin.store';
import { roleName } from './role-name';

/** A row of the role list. */
interface Row {
  id: string;
  name: string;
  subline: string;
  /** A built-in role shows a lock. */
  locked: boolean;
}

/** The role list: a row opens the role, the last row adds a role. */
@Component({
  selector: 'app-roles',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AddRowComponent,
    ListRowComponent,
    PageHeaderComponent,
    RowGroupComponent,
    RowGroupSkeletonComponent,
    SvgIconComponent,
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

  protected readonly rows = computed<Row[]>(() =>
    (this.store.roles() ?? []).map((role) => ({
      id: role.id,
      name: roleName(this.i18n, role.name),
      subline: joined([role.description, this.people(role.peopleCount)]),
      locked: role.builtIn,
    })),
  );

  protected readonly lockLabel = computed(() => this.i18n.translate('admin.roles.locked'));

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

  /** A role without a person shows no count. */
  private people(count: number): string | null {
    if (count === 0) return null;
    if (count === 1) return this.i18n.translate('admin.roles.onePerson');
    return this.i18n.translate('admin.roles.people', { count: grouped(count) });
  }
}
