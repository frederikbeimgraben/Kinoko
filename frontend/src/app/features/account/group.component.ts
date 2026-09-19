import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { BadgeComponent } from '@stupa-makers/ui-kit';
import { AccountService } from '../../core/access/account.service';
import { GroupsState } from '../../core/access/groups.state';
import { shortDay } from '../../core/i18n/dates';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ActionBarComponent } from '../../ui/action-bar/action-bar.component';
import { ConfirmDialogComponent } from '../../ui/confirm-dialog/confirm-dialog.component';
import { IconButtonComponent } from '../../ui/icon-button/icon-button.component';
import { ListRowComponent } from '../../ui/list-row/list-row.component';
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';

/** Eine Zeile der Mitgliederliste. */
interface Row {
  userId: string;
  name: string;
  since: string;
  owner: boolean;
}

/** Eine Gruppe: Code, Mitglieder, verlassen oder löschen. */
@Component({
  selector: 'app-group',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ActionBarComponent,
    BadgeComponent,
    ConfirmDialogComponent,
    IconButtonComponent,
    ListRowComponent,
    PageHeaderComponent,
    TranslatePipe,
  ],
  templateUrl: './group.component.html',
  styleUrl: './group.component.scss',
})
export class GroupComponent {
  readonly id = input.required<string>();

  private readonly account = inject(AccountService);
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly state = inject(GroupsState);

  protected readonly asking = signal(false);

  protected readonly group = computed(() => this.state.one(this.id()));
  protected readonly mine = computed(() => this.account.owns(this.group()?.ownerId ?? null));
  protected readonly title = computed(() => this.group()?.name ?? this.i18n.translate('group.title'));

  protected readonly members = computed<Row[]>(() => {
    const group = this.group();
    if (group === null) return [];
    return group.members.map((member) => ({
      userId: member.userId,
      name: member.name,
      since: this.i18n.translate('group.since', {
        date: shortDay(new Date(member.joinedAt), this.i18n),
      }),
      owner: member.userId === group.ownerId,
    }));
  });

  protected readonly question = computed(
    () => `${this.title()} ${this.i18n.translate('group.deleteConfirm')}`,
  );

  constructor() {
    if (this.state.groups() === null) this.state.load();
  }

  protected shareCode(code: string): void {
    void navigator.clipboard.writeText(code);
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
