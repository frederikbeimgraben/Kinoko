import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { PrivateImageComponent } from '../private-image/private-image.component';
import { RippleDirective } from '../ripple/ripple.directive';
import { SvgIconComponent, type IconName } from '../svg-icon/svg-icon.component';

/** A find, marker or zone, per the entry row of `kit.css` `.item`. */
export interface EntryRowEntry {
  readonly title: string;
  readonly meta: string;
  readonly note?: string;
  readonly colour?: string;
  readonly photo?: string;
  readonly icon?: IconName;
}

/** Entry row with a thumbnail, title, meta, note and an upload or chevron mark. */
@Component({
  selector: 'app-entry-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PrivateImageComponent, RippleDirective, SvgIconComponent, TranslatePipe],
  templateUrl: './entry-row.component.html',
  styleUrl: './entry-row.component.scss',
})
export class EntryRowComponent {
  readonly entry = input.required<EntryRowEntry>();
  readonly pending = input(false);
  readonly selected = input(false);

  readonly chosen = output();
}
