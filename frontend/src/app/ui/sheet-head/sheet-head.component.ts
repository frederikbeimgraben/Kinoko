import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { SvgIconComponent, type IconName } from '../svg-icon/svg-icon.component';
import { SkeletonComponent } from '../skeleton/skeleton.component';

/** The head of the sheet: title, week and the timeline below. */
@Component({
  selector: 'app-sheet-head',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SkeletonComponent, SvgIconComponent, TranslatePipe],
  templateUrl: './sheet-head.component.html',
  styleUrl: './sheet-head.component.scss',
})
export class SheetHeadComponent {
  readonly title = input.required<string>();
  /** A muted icon before the title. It shows the group of a layer. */
  readonly icon = input<IconName>();
  readonly titleLink = input(false);
  readonly week = input<string>();
  /** Extra text in a muted font, for example the time span of a layer. */
  readonly note = input<string>();
  readonly hint = input<string>();
  /** A back arrow before the title when the head goes back from a view. */
  readonly back = input(false);
  /** Without data, a placeholder shows in place of the title. */
  readonly loading = input(false);

  readonly titleClick = output();
  readonly backClick = output();
}
