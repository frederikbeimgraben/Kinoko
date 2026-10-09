import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import type { FriendGroup } from '../../core/api/models';
import { shortDay } from '../../core/i18n/dates';
import { I18nService } from '../../core/i18n/i18n.service';
import { joined } from '../../core/i18n/numbers';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { IconButtonComponent } from '../../ui/icon-button/icon-button.component';
import { ListRowComponent } from '../../ui/list-row/list-row.component';
import { RowGroupComponent } from '../../ui/row-group/row-group.component';
import { SectionComponent } from '../../ui/section/section.component';
import { ToastService } from '../../ui/toast/toast.service';

/** One row of the member list. */
interface Row {
  readonly userId: string;
  readonly name: string;
  readonly sub: string;
  readonly owner: boolean;
}

/** The invitation code and the members, per `GroupPage.dc.html`. The account and the administration show it. */
@Component({
  selector: 'app-group-members',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconButtonComponent, ListRowComponent, RowGroupComponent, SectionComponent, TranslatePipe],
  templateUrl: './group-members.component.html',
  styleUrl: './group-members.component.scss',
})
export class GroupMembersComponent {
  readonly group = input.required<FriendGroup>();
  /** Only the owner and the administration remove a member. */
  readonly removable = input(false);

  readonly removed = output<string>();

  private readonly i18n = inject(I18nService);
  private readonly toasts = inject(ToastService);

  protected readonly rows = computed<readonly Row[]>(() => {
    const group = this.group();
    return group.members.map((member) => {
      const owner = member.userId === group.ownerId;
      return {
        userId: member.userId,
        name: member.name,
        sub: joined([
          owner ? this.i18n.translate('group.owner') : null,
          this.i18n.translate('group.since', { date: shortDay(new Date(member.joinedAt), this.i18n) }),
        ]),
        owner,
      };
    });
  });

  /** The share sheet of the system, else the clipboard. A cancelled share sheet gives no message. */
  protected async share(): Promise<void> {
    const code = this.group().inviteCode;
    if (typeof navigator.share === 'function') {
      const shared = await navigator.share({ text: code }).then(
        () => true,
        (failure: unknown) => failure instanceof DOMException && failure.name === 'AbortError',
      );
      if (shared) return;
    }
    await this.copy(code);
  }

  private async copy(code: string): Promise<void> {
    const copied = await Promise.resolve()
      .then(() => navigator.clipboard.writeText(code))
      .then(
        () => true,
        () => false,
      );
    if (copied) this.toasts.success(this.i18n.translate('group.codeCopied'));
    else this.toasts.error(this.i18n.translate('group.codeCopyFailed', { code }));
  }
}
