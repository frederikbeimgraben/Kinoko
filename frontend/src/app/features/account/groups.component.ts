import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AccountStore } from '../../core/access/account.store';
import { GroupsStore } from '../../core/access/groups.store';
import { I18nService } from '../../core/i18n/i18n.service';
import { joined } from '../../core/i18n/numbers';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ViewportService } from '../../core/layout/viewport.service';
import { AddRowComponent } from '../../ui/add-row/add-row.component';
import { FloatingButtonComponent } from '../../ui/floating-button/floating-button.component';
import { ListRowComponent } from '../../ui/list-row/list-row.component';
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';
import { RowGroupComponent } from '../../ui/row-group/row-group.component';
import { RowGroupSkeletonComponent } from '../../ui/skeleton/row-group-skeleton.component';
import { GroupSheetComponent } from './group-sheet.component';
import { memberCount } from './group-text';

/** One row of the group list. */
interface Row {
  readonly id: string;
  readonly name: string;
  readonly sub: string;
}

/** The sheet that is open: create a group, join a group, or none. */
type Sheet = 'create' | 'join' | null;

/** The groups of the account, per `Groups.dc.html`: open, join, create. */
@Component({
  selector: 'app-groups',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AddRowComponent,
    FloatingButtonComponent,
    GroupSheetComponent,
    ListRowComponent,
    PageHeaderComponent,
    RowGroupComponent,
    RowGroupSkeletonComponent,
    TranslatePipe,
  ],
  templateUrl: './groups.component.html',
  styleUrl: './account-area-page.scss',
})
export class GroupsComponent {
  private readonly account = inject(AccountStore);
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly store = inject(GroupsStore);
  private readonly wide = inject(ViewportService).wide;

  protected readonly back = computed(() => !this.wide());
  protected readonly sheet = signal<Sheet>(null);
  protected readonly busy = this.store.writing;
  protected readonly loaded = computed(() => this.store.groups() !== null);

  /** The own groups come first, then the others, each by name. */
  protected readonly rows = computed<readonly Row[]>(() => {
    const groups = this.store.groups() ?? [];
    const owned = (ownerId: string): boolean => this.account.owns(ownerId);
    return [...groups.filter((group) => owned(group.ownerId)), ...groups.filter((group) => !owned(group.ownerId))].map(
      (group) => ({
        id: group.id,
        name: group.name,
        sub: joined([
          memberCount(this.i18n, group.members.length),
          owned(group.ownerId) ? this.i18n.translate('group.owner') : null,
        ]),
      }),
    );
  });

  constructor() {
    this.store.load();
  }

  protected async create(name: string): Promise<void> {
    if (name.trim() === '') return;
    const group = await this.store.create(name.trim());
    if (group !== null) this.sheet.set(null);
  }

  protected async join(code: string): Promise<void> {
    if (code.trim() === '') return;
    const group = await this.store.join(code.trim());
    if (group !== null) this.sheet.set(null);
  }

  protected open(id: string): void {
    void this.router.navigate(['/konto/gruppen', id]);
  }

  protected toAccount(): void {
    void this.router.navigateByUrl('/konto');
  }
}
