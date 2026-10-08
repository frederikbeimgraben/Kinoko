import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RippleDirective } from '../ripple/ripple.directive';
import { SvgIconComponent, type IconName } from '../svg-icon/svg-icon.component';

/** The six variants of `kit.css` `.btn`. */
export type ButtonKind = 'primary' | 'tonal' | 'outline' | 'text' | 'danger' | 'textdanger';

/** The kit button, styled by `kit.css` `.btn`. */
@Component({
  selector: 'app-push-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RippleDirective, SvgIconComponent],
  templateUrl: './button.component.html',
  styleUrl: './button.component.scss',
})
export class ButtonComponent {
  readonly kind = input<ButtonKind>('primary');
  readonly icon = input<IconName>();
  /** Uses the full width of the host. */
  readonly wide = input(false);
  /** Shows a spinner in place of the label. */
  readonly busy = input(false);
  readonly disabled = input(false);
  readonly type = input<'button' | 'submit'>('button');
}
