import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import type { TranslationKey } from '../../core/i18n/translations';
import { ListRowComponent } from '../../ui/list-row/list-row.component';
import { PopoverItemComponent } from '../../ui/popover/popover-item.component';
import { RowGroupComponent } from '../../ui/row-group/row-group.component';
import type { IconName } from '../../ui/svg-icon/icons';

/** The choices behind the plus button. */
export type AddAction = 'find' | 'marker' | 'zone';

interface Choice {
  readonly key: AddAction;
  readonly icon: IconName;
  readonly label: TranslationKey;
}

const CHOICES: readonly Choice[] = [
  { key: 'find', icon: 'mushroom', label: 'entry.reportFind.title' },
  { key: 'marker', icon: 'flag', label: 'entry.setMarker.title' },
  { key: 'zone', icon: 'zone', label: 'entry.drawZone.title' },
];

/**
 * The three ways to add an entry: a group of rows (board `AddActionsBody`),
 * or the items of a popover at the plus button on the desktop (board `MapDesktopAdd`).
 */
@Component({
  selector: 'app-add-actions',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ListRowComponent, PopoverItemComponent, RowGroupComponent, TranslatePipe],
  templateUrl: './add-actions.component.html',
})
export class AddActionsComponent {
  /** The items of a popover instead of a group of rows. */
  readonly menu = input(false);

  readonly chosen = output<AddAction>();

  protected readonly choices = CHOICES;
}
