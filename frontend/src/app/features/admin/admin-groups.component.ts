import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { GroupsState } from '../../core/access/groups.state';
import { I18nService } from '../../core/i18n/i18n.service';
import { joined } from '../../core/i18n/numbers';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ListRowComponent } from '../../ui/list-row/list-row.component';
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';
import { SearchFieldComponent } from '../../ui/search-field/search-field.component';
import { memberCount, ownerOf } from '../account/group-text';

/** Eine Zeile der Gruppenliste der Verwaltung. */
interface Row {
  id: string;
  name: string;
  subline: string;
}

/** Alle Gruppen: suchen und eine öffnen. Braucht das Recht `group.manage`. */
@Component({
  selector: 'app-admin-groups',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ListRowComponent, PageHeaderComponent, SearchFieldComponent, TranslatePipe],
  templateUrl: './admin-groups.component.html',
  styleUrl: './admin-groups.component.scss',
})
export class AdminGroupsComponent {
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly state = inject(GroupsState);

  protected readonly search = this.state.search;

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
