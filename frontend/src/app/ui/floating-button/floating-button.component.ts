import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RippleDirective } from '../ripple/ripple.directive';
import { SvgIconComponent, type IconName } from '../svg-icon/svg-icon.component';

/** The floating button above the map, as `kit.css` `.fab`. */
@Component({
  selector: 'app-floating-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RippleDirective, SvgIconComponent],
  templateUrl: './floating-button.component.html',
  styleUrl: './floating-button.component.scss',
})
export class FloatingButtonComponent {
  readonly icon = input.required<IconName>();
  /** The accessible name. Without `iconOnly`, it also shows as text. */
  readonly label = input.required<string>();
  /** Shows only the round icon, without text. */
  readonly iconOnly = input(false);
  readonly disabled = input(false);
  /** Turns only the icon, not the button, for the compass needle. */
  readonly rotation = input(0);

  readonly pressed = output();
}
