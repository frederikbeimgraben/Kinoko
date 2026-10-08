import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AccountStore } from '../../core/access/account.store';
import { GroupsState } from '../../core/access/groups.state';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ActionBarComponent } from '../../ui/action-bar/action-bar.component';
import { ConfirmDialogComponent } from '../../ui/confirm-dialog/confirm-dialog.component';
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';
import { GroupMembersComponent } from './group-members.component';

/** Eine Gruppe: Code, Mitglieder, verlassen oder löschen. */
@Component({
  selector: 'app-group',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ActionBarComponent,
    ConfirmDialogComponent,
    GroupMembersComponent,
    PageHeaderComponent,
    TranslatePipe,
  ],
  templateUrl: './group.component.html',
  styleUrl: './group.component.scss',
})
export class GroupComponent {
  readonly id = input.required<string>();

  private readonly account = inject(AccountStore);
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly state = inject(GroupsState);

  protected readonly asking = signal(false);

  protected readonly group = computed(() => this.state.one(this.id()));
  protected readonly mine = computed(() => this.account.owns(this.group()?.ownerId ?? null));
  protected readonly title = computed(() => this.group()?.name ?? this.i18n.translate('group.title'));

  protected readonly question = computed(
    () => `${this.title()} ${this.i18n.translate('group.deleteConfirm')}`,
  );

  constructor() {
    if (this.state.groups() === null) this.state.load();
  }

  protected removeMember(userId: string): void {
    this.state.removeMember(this.id(), userId).subscribe();
  }

  protected confirm(): void {
    const done = (): void => {
      this.asking.set(false);
      this.back();
    };
    if (this.mine()) {
      this.state.remove(this.id()).subscribe(done);
      return;
    }
    const me = this.account.userId();
    if (me === null) return;
    this.state.removeMember(this.id(), me).subscribe(done);
  }

  protected back(): void {
    void this.router.navigateByUrl('/konto/gruppen');
  }
}
