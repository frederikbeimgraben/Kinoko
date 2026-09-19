import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { BadgeComponent } from '@stupa-makers/ui-kit';
import type { FriendGroup } from '../../core/api/models';
import { shortDay } from '../../core/i18n/dates';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { IconButtonComponent } from '../../ui/icon-button/icon-button.component';
import { ListRowComponent } from '../../ui/list-row/list-row.component';

/** Eine Zeile der Mitgliederliste. */
interface Row {
  userId: string;
  name: string;
  since: string;
  owner: boolean;
}

/** Einladungscode und Mitglieder: das Innere einer Gruppe, im Konto und in der Verwaltung. */
@Component({
  selector: 'app-group-members',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BadgeComponent, IconButtonComponent, ListRowComponent, TranslatePipe],
  templateUrl: './group-members.component.html',
  styleUrl: './group-members.component.scss',
})
export class GroupMembersComponent {
  readonly group = input.required<FriendGroup>();
  /** Nur der Eigentümer und die Verwaltung nehmen jemanden heraus. */
  readonly removable = input(false);

  readonly removed = output<string>();

  private readonly i18n = inject(I18nService);

  protected readonly rows = computed<Row[]>(() => {
    const group = this.group();
    return group.members.map((member) => ({
      userId: member.userId,
      name: member.name,
      since: this.i18n.translate('group.since', {
        date: shortDay(new Date(member.joinedAt), this.i18n),
      }),
      owner: member.userId === group.ownerId,
    }));
  });

  protected share(): void {
    void navigator.clipboard.writeText(this.group().inviteCode);
  }
}
