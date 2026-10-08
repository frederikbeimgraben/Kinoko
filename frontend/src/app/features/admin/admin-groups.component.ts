import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { GroupsState } from '../../core/access/groups.state';
import { I18nService } from '../../core/i18n/i18n.service';
import { joined } from '../../core/i18n/numbers';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ViewportService } from '../../core/layout/viewport.service';
import { ListRowComponent } from '../../ui/list-row/list-row.component';
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';
import { RowGroupComponent } from '../../ui/row-group/row-group.component';
import { SearchFieldComponent } from '../../ui/search-field/search-field.component';
import { RowGroupSkeletonComponent } from '../../ui/skeleton/row-group-skeleton.component';
import { StateViewComponent } from '../../ui/state-view/state-view.component';
import { memberCount, ownerOf } from '../account/group-text';

/** A row of the group list of the administration. */
interface Row {
  id: string;
  name: string;
  subline: string;
}

/** All groups: search and open one. Needs the permission `group.manage`. */
@Component({
  selector: 'app-admin-groups',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ListRowComponent,
    PageHeaderComponent,
    RowGroupComponent,
    RowGroupSkeletonComponent,
    SearchFieldComponent,
    StateViewComponent,
    TranslatePipe,
  ],
  templateUrl: './admin-groups.component.html',
  styleUrl: './admin-groups.component.scss',
})
export class AdminGroupsComponent {
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly state = inject(GroupsState);

  protected readonly wide = inject(ViewportService).wide;
  protected readonly search = this.state.search;
  protected readonly loaded = computed(() => this.state.groups() !== null);

  protected readonly rows = computed<Row[]>(() =>
    this.state.found().map((group) => ({
      id: group.id,
      name: group.name,
      subline: joined([ownerOf(this.i18n, group), memberCount(this.i18n, group.members.length)]),
    })),
  );

  constructor() {
    this.state.load(true);
  }

  protected onSearch(value: string): void {
    this.state.setSearch(value);
  }

  protected open(id: string): void {
    void this.router.navigate(['/verwaltung/gruppen', id]);
  }

  protected back(): void {
    void this.router.navigateByUrl('/verwaltung');
  }
}
