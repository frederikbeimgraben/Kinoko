import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AccountStore } from '../../core/access/account.store';
import { GroupsStore } from '../../core/access/groups.store';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ButtonComponent } from '../../ui/button/button.component';
import { ConfirmDialogComponent } from '../../ui/confirm-dialog/confirm-dialog.component';
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';
import { RowGroupSkeletonComponent } from '../../ui/skeleton/row-group-skeleton.component';
import { StateViewComponent } from '../../ui/state-view/state-view.component';
import { GroupMembersComponent } from './group-members.component';

/** One group, per `GroupPage.dc.html`: code, members, leave or delete. */
@Component({
  selector: 'app-group',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ButtonComponent,
    ConfirmDialogComponent,
    GroupMembersComponent,
    PageHeaderComponent,
    RowGroupSkeletonComponent,
    StateViewComponent,
    TranslatePipe,
  ],
  templateUrl: './group.component.html',
  styleUrl: './account-page.scss',
})
export class GroupComponent {
  readonly id = input.required<string>();

  private readonly account = inject(AccountStore);
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly store = inject(GroupsStore);

  protected readonly asking = signal(false);
  protected readonly busy = this.store.writing;

  /** The list is pending: the page shows a skeleton, not "not found". */
  protected readonly loading = computed(() => this.store.groups() === null);
  protected readonly group = computed(() => this.store.one(this.id()));
  protected readonly mine = computed(() => this.account.owns(this.group()?.ownerId ?? null));
  protected readonly title = computed(
    () => this.group()?.name ?? (this.loading() ? '' : this.i18n.translate('group.title')),
  );

  protected readonly question = computed(() =>
    this.mine()
      ? `${this.title()} ${this.i18n.translate('group.deleteConfirm')}`
      : this.i18n.translate('group.leaveConfirm', { name: this.title() }),
  );

  constructor() {
    if (this.store.groups() === null) this.store.load();
  }

  protected removeMember(userId: string): void {
    void this.store.removeMember(this.id(), userId);
  }

  protected async confirm(): Promise<void> {
    const me = this.account.userId();
    const done = this.mine()
      ? await this.store.remove(this.id())
      : me !== null && (await this.store.removeMember(this.id(), me));
    if (!done) return;
    this.asking.set(false);
    this.back();
  }

  protected back(): void {
    void this.router.navigateByUrl('/konto/gruppen');
  }
}
