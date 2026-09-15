import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import type { TranslationKey } from '../../core/i18n/translations';
import type { IconName } from '../../ui/svg-icon/icons';
import { SvgIconComponent } from '../../ui/svg-icon/svg-icon.component';

/** Was der Plus-Knopf anbietet. */
export type AddAction = 'find' | 'marker' | 'zone';

interface Choice {
  readonly key: AddAction;
  readonly icon: IconName;
  readonly label: TranslationKey;
}

const CHOICES: readonly Choice[] = [
  { key: 'find', icon: 'entries', label: 'entry.reportFind.title' },
  { key: 'marker', icon: 'location', label: 'entry.setMarker.title' },
  { key: 'zone', icon: 'zone', label: 'entry.drawZone.title' },
];

/** Die drei Wege des Eintragens als Zeilen mit Icon-Kachel (Board `AddActions`). */
@Component({
  selector: 'app-add-actions',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SvgIconComponent, TranslatePipe],
  templateUrl: './add-actions.component.html',
  styleUrl: './add-actions.component.scss',
})
export class AddActionsComponent {
  readonly chosen = output<AddAction>();

  protected readonly choices = CHOICES;
}
