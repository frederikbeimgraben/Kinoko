import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { RippleDirective } from '../ripple/ripple.directive';
import { SvgIconComponent } from '../svg-icon/svg-icon.component';

/** The head of a sheet or a modal, per `kit.css` `.shead`: back, title, close. */
@Component({
  selector: 'app-overlay-head',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RippleDirective, SvgIconComponent, TranslatePipe],
  templateUrl: './overlay-head.component.html',
  styleUrl: './overlay-head.component.scss',
  host: { '[class.overlay-head--lead]': 'back()' },
})
export class OverlayHeadComponent {
  readonly title = input('');
  /** The muted line below the title, for example the coordinates. */
  readonly note = input('');
  readonly back = input(false);
  readonly close = input(true);

  readonly backClick = output();
  readonly closeClick = output();
}
