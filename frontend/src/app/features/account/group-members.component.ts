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

  protected share(): void {
    const code = this.group().inviteCode;
    if (typeof navigator.share === 'function') {
      navigator.share({ text: code }).catch(() => undefined);
      return;
    }
    void navigator.clipboard.writeText(code);
  }
}
